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
    
    Function Get-ProcessName($appId) {
      $appIdClean = $appId -replace '\\.exe$', '';
      
      try {
        $processes = Get-Process -Name $appIdClean -ErrorAction SilentlyContinue;
        if ($processes) {
          $proc = $processes[0];
          if ($proc.MainModule.FileVersionInfo.FileDescription) {
            return $proc.MainModule.FileVersionInfo.FileDescription;
          }
          return $proc.ProcessName;
        }
      } catch {}
      
      if ($appId -match '\\.exe$') {
        return $appIdClean;
      }
      
      try {
        $package = Get-AppxPackage | Where-Object { $_.PackageFamilyName -like "*$appId*" -or $_.Name -like "*$appId*" } | Select-Object -First 1;
        if ($package -and $package.Name) {
          return $package.Name;
        }
      } catch {}
      
      if ($appId -notmatch '\\.exe$') {
        $firefoxProc = Get-Process -Name firefox -ErrorAction SilentlyContinue | Select-Object -First 1;
        if ($firefoxProc) {
          try {
            if ($firefoxProc.MainModule.FileVersionInfo.FileDescription) {
              return $firefoxProc.MainModule.FileVersionInfo.FileDescription;
            }
          } catch {}
          return \"Firefox\";
        }
      }
      
      return $appId;
    }
    
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media,ContentType=WindowsRuntime] | Out-Null;
    $sessionManager = AwaitAction([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync());
    $sessions = $sessionManager.GetSessions();
    
    $results = @();
    foreach ($session in $sessions) {
      $playback = $session.GetPlaybackInfo();
      $appId = $session.SourceAppUserModelId;
      $friendlyName = Get-ProcessName $appId;
      
      $result = @{
        appName = $friendlyName;
        appId = $appId;
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
 * Control media playback for specific apps or all apps
 */
async function controlMedia(apps, action) {
  // If apps is undefined, control all sessions
  if (apps === undefined) {
    const sessions = await listSessions();
    
    if (sessions.length === 0) {
      console.warn('Warning: No active media sessions found');
      return { success: [], failed: [] };
    }
    
    const appNames = sessions.map(s => s.appName);
    debug(`${action} all sessions:`, appNames);
    
    return controlMedia(appNames, action);
  }
  
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
    // Find matching session (case-insensitive partial match against both friendly name and appId)
    const matchingSession = sessions.find(session => 
      session.appName.toLowerCase().includes(app.toLowerCase()) ||
      session.appId.toLowerCase().includes(app.toLowerCase())
    );
    
    if (!matchingSession) {
      console.warn(`Warning: No media session found for "${app}". Available apps: ${sessions.map(s => s.appName).join(', ')}`);
      result.failed.push({ app, reason: 'Session not found' });
      continue;
    }
    
    try {
      // Use the actual appId for the PowerShell command
      const targetAppId = matchingSession.appId;
      
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
          if ($session.SourceAppUserModelId -eq "${targetAppId}") {
            $actionTask = $session.Try${action}Async();
            AwaitBool $actionTask | Out-Null;
            Write-Output "Success";
            break;
          }
        }
      `.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      
      await executePowerShell(script);
      debug(`Successfully ${action.toLowerCase()}ed:`, matchingSession.appName);
      result.success.push(matchingSession.appName);
    } catch (error) {
      console.warn(`Warning: Failed to ${action.toLowerCase()} "${app}": ${error.message}`);
      result.failed.push({ app, reason: error.message });
    }
  }
  
  return result;
}

/**
 * Play media for specified app(s) or all active sessions
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, controls all active sessions.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function play(apps) {
  return controlMedia(apps, 'Play');
}

/**
 * Pause media for specified app(s) or all active sessions
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, controls all active sessions.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function pause(apps) {
  return controlMedia(apps, 'Pause');
}

/**
 * Skip to next track for specified app(s) or simulate media keyboard key
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, simulates Next Track keyboard key.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function next(apps) {
  if (apps === undefined) {
    return simulateMediaKey('Next Track', 0xB0);
  }
  return controlMedia(apps, 'SkipNext');
}

/**
 * Skip to previous track for specified app(s) or simulate media keyboard key
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, simulates Previous Track keyboard key.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function previous(apps) {
  if (apps === undefined) {
    return simulateMediaKey('Previous Track', 0xB1);
  }
  return controlMedia(apps, 'SkipPrevious');
}

/**
 * Stop playback for specified app(s) or simulate media keyboard key
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, simulates Stop keyboard key.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function stop(apps) {
  if (apps === undefined) {
    return simulateMediaKey('Stop', 0xB2);
  }
  return controlMedia(apps, 'Stop');
}

/**
 * Toggle play/pause for specified app(s) or simulate media keyboard key
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, simulates Play/Pause Toggle keyboard key.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function togglePlayPause(apps) {
  if (apps === undefined) {
    return simulateMediaKey('Play/Pause Toggle', 0xB3);
  }
  return controlMedia(apps, 'TogglePlayPause');
}

/**
 * Simulate media key press via PowerShell
 */
async function simulateMediaKey(keyName, keyCode) {
  debug(`Simulating ${keyName} media key press`);
  
  const script = `
    Add-Type -TypeDefinition @"
    using System.Runtime.InteropServices;
    public class MediaControl {
      [DllImport("user32.dll")]
      private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, System.UIntPtr dwExtraInfo);
      
      private const uint KEYEVENTF_EXTENDEDKEY = 0x1;
      private const uint KEYEVENTF_KEYUP = 0x2;
      
      public static void PressKey(byte vkCode) {
        keybd_event(vkCode, 0, KEYEVENTF_EXTENDEDKEY, System.UIntPtr.Zero);
        keybd_event(vkCode, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, System.UIntPtr.Zero);
      }
    }
"@ -Language CSharp
    
    [MediaControl]::PressKey(${keyCode})
  `.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  try {
    await executePowerShell(script);
    return { success: [keyName], failed: [] };
  } catch (error) {
    debug(`Failed to simulate ${keyName} key:`, error.message);
    return { success: [], failed: [{ app: 'MediaKey', reason: error.message }] };
  }
}


