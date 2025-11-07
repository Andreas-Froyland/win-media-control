import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DEBUG = process.env.DEBUG === 'win-media-control';

/**
 * Log debug messages when DEBUG mode is enabled
 */
function debug(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Execute PowerShell command to control media
 */
async function executePowerShell(command) {
  // Escape double quotes for PowerShell
  const escapedCommand = command.replace(/"/g, '\\"');
  const fullCommand = `powershell.exe -NoProfile -Command "${escapedCommand}"`;
  debug('Executing PowerShell:', command);
  
  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      windowsHide: true,
      timeout: 10000
    });
    
    if (stderr && DEBUG) {
      debug('PowerShell stderr:', stderr);
    }
    
    return stdout.trim();
  } catch (error) {
    debug('PowerShell error:', error.message);
    throw new Error(`PowerShell execution failed: ${error.message}`);
  }
}

/**
 * Get all active media sessions
 */
export async function listSessions() {
  const script = `
    Add-Type -AssemblyName System.Runtime.WindowsRuntime;
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.ToString() -eq 'System.Threading.Tasks.Task\`1[TResult] AsTask[TResult](Windows.Foundation.IAsyncOperation\`1[TResult])' })[0];
    
    Function AwaitAction($WinRtAction) {
      $asTask = $asTaskGeneric.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]);
      $netTask = $asTask.Invoke($null, @($WinRtAction));
      $netTask.Wait() | Out-Null;
      $netTask.Result;
    }
    
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media,ContentType=WindowsRuntime] | Out-Null;
    $sessionManager = AwaitAction([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync());
    $sessions = $sessionManager.GetSessions();
    
    $results = @();
    foreach ($session in $sessions) {
      $playback = $session.GetPlaybackInfo();
      
      $result = @{
        appName = $session.SourceAppUserModelId;
        title = '';
        artist = '';
        playbackStatus = $playback.PlaybackStatus.ToString();
      };
      
      try {
        $mediaPropsTask = $session.TryGetMediaPropertiesAsync();
        $asTaskMedia = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.ToString() -match 'AsTask.*IAsyncOperation' })[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsMediaProperties]);
        $mediaTask = $asTaskMedia.Invoke($null, @($mediaPropsTask));
        $mediaTask.Wait() | Out-Null;
        $media = $mediaTask.Result;
        $result.title = $media.Title;
        $result.artist = $media.Artist;
      } catch {}
      
      $results += $result;
    }
    
    $results | ConvertTo-Json -Compress
  `.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  try {
    const output = await executePowerShell(script);
    
    if (!output || output === 'null' || output === '') {
      debug('No active media sessions found');
      return [];
    }
    
    let sessions = JSON.parse(output);
    
    // PowerShell returns single object instead of array when there's only one result
    if (!Array.isArray(sessions)) {
      sessions = [sessions];
    }
    
    debug('Found sessions:', sessions);
    return sessions;
  } catch (error) {
    debug('Error listing sessions:', error.message);
    return [];
  }
}

/**
 * Control media playback for specific apps
 */
async function controlMedia(apps, action) {
  // Normalize input to array
  const appList = Array.isArray(apps) ? apps : [apps];
  
  debug(`Attempting to ${action}:`, appList);
  
  const result = {
    success: [],
    failed: []
  };
  
  // Get all active sessions
  const sessions = await listSessions();
  
  if (sessions.length === 0) {
    for (const app of appList) {
      console.warn(`Warning: No active media sessions found for "${app}"`);
      result.failed.push({ app, reason: 'No active media sessions' });
    }
    return result;
  }
  
  for (const app of appList) {
    // Find matching session (case-insensitive partial match)
    const matchingSession = sessions.find(session => 
      session.appName.toLowerCase().includes(app.toLowerCase())
    );
    
    if (!matchingSession) {
      console.warn(`Warning: No media session found for "${app}". Available apps: ${sessions.map(s => s.appName).join(', ')}`);
      result.failed.push({ app, reason: 'Session not found' });
      continue;
    }
    
    try {
      const script = `
        Add-Type -AssemblyName System.Runtime.WindowsRuntime;
        $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.ToString() -eq 'System.Threading.Tasks.Task\`1[TResult] AsTask[TResult](Windows.Foundation.IAsyncOperation\`1[TResult])' })[0];
        
        Function AwaitAction($WinRtAction) {
          $asTask = $asTaskGeneric.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]);
          $netTask = $asTask.Invoke($null, @($WinRtAction));
          $netTask.Wait() | Out-Null;
          $netTask.Result;
        }
        
        Function AwaitBool($WinRtAction) {
          $asTask = $asTaskGeneric.MakeGenericMethod([bool]);
          $netTask = $asTask.Invoke($null, @($WinRtAction));
          $netTask.Wait() | Out-Null;
          $netTask.Result;
        }
        
        [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media,ContentType=WindowsRuntime] | Out-Null;
        $sessionManager = AwaitAction([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync());
        $sessions = $sessionManager.GetSessions();
        
        foreach ($session in $sessions) {
          if ($session.SourceAppUserModelId -like "*${app}*") {
            $actionTask = $session.Try${action}Async();
            AwaitBool $actionTask | Out-Null;
            Write-Output "Success";
            break;
          }
        }
      `.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      
      await executePowerShell(script);
      debug(`Successfully ${action.toLowerCase()}ed:`, app);
      result.success.push(app);
    } catch (error) {
      console.warn(`Warning: Failed to ${action.toLowerCase()} "${app}": ${error.message}`);
      result.failed.push({ app, reason: error.message });
    }
  }
  
  return result;
}

/**
 * Play media for specified app(s)
 * @param {string|string[]} apps - App name or array of app names
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function play(apps) {
  return controlMedia(apps, 'Play');
}

/**
 * Pause media for specified app(s)
 * @param {string|string[]} apps - App name or array of app names
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function pause(apps) {
  return controlMedia(apps, 'Pause');
}

/**
 * Play all active media sessions
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function globalPlay() {
  const sessions = await listSessions();
  
  if (sessions.length === 0) {
    console.warn('Warning: No active media sessions found');
    return { success: [], failed: [] };
  }
  
  const appNames = sessions.map(s => s.appName);
  debug('Global play for all sessions:', appNames);
  
  return controlMedia(appNames, 'Play');
}

/**
 * Pause all active media sessions
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function globalPause() {
  const sessions = await listSessions();
  
  if (sessions.length === 0) {
    console.warn('Warning: No active media sessions found');
    return { success: [], failed: [] };
  }
  
  const appNames = sessions.map(s => s.appName);
  debug('Global pause for all sessions:', appNames);
  
  return controlMedia(appNames, 'Pause');
}

