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
  // Use PowerShell's -EncodedCommand to avoid escaping issues
  const encodedCommand = Buffer.from(command, 'utf16le').toString('base64');
  const fullCommand = `powershell.exe -NoProfile -EncodedCommand ${encodedCommand}`;
  
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
  // If apps is "all", control all sessions
  if (apps === "all") {
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
 * Play media for specified app(s), all sessions, or control current session
 * @param {string|string[]} [apps] - App name, array of app names, or "all" for all sessions. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function play(apps) {
  if (apps === undefined) {
    return controlCurrentSession('Play');
  }
  return controlMedia(apps, 'Play');
}

/**
 * Pause media for specified app(s), all sessions, or control current session
 * @param {string|string[]} [apps] - App name, array of app names, or "all" for all sessions. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function pause(apps) {
  if (apps === undefined) {
    return controlCurrentSession('Pause');
  }
  return controlMedia(apps, 'Pause');
}

/**
 * Skip to next track for specified app(s) or control current session
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function next(apps) {
  if (apps === undefined) {
    return controlCurrentSession('SkipNext');
  }
  return controlMedia(apps, 'SkipNext');
}

/**
 * Skip to previous track for specified app(s) or control current session
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function previous(apps) {
  if (apps === undefined) {
    return controlCurrentSession('SkipPrevious');
  }
  return controlMedia(apps, 'SkipPrevious');
}

/**
 * Stop playback for specified app(s) or control current session
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function stop(apps) {
  if (apps === undefined) {
    return controlCurrentSession('Stop');
  }
  return controlMedia(apps, 'Stop');
}

/**
 * Toggle play/pause for specified app(s) or control current session
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function togglePlayPause(apps) {
  if (apps === undefined) {
    return controlCurrentSession('TogglePlayPause');
  }
  return controlMedia(apps, 'TogglePlayPause');
}

/**
 * Control the current/default media session
 */
async function controlCurrentSession(action) {
  debug(`Controlling current session with action: ${action}`);
  
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
    $currentSession = $sessionManager.GetCurrentSession();
    
    if ($currentSession) {
      $actionTask = $currentSession.Try${action}Async();
      $result = AwaitBool $actionTask;
      if ($result) {
        Write-Output "Success: Controlled current session";
      } else {
        Write-Error "Failed: Action not supported by current session";
      }
    } else {
      Write-Error "No current session available";
    }
  `.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  try {
    await executePowerShell(script);
    return { success: ['Current Session'], failed: [] };
  } catch (error) {
    debug(`Failed to control current session, falling back to SendKeys:`, error.message);
    // Fallback to SendKeys method
    return simulateMediaKeyWithSendKeys(action);
  }
}

/**
 * Simulate media key press using SendKeys via PowerShell
 */
async function simulateMediaKeyWithSendKeys(action) {
  debug(`Simulating media key for action: ${action} using SendKeys`);
  
  // Map actions to SendKeys codes
  const keyMap = {
    'Play': '{MEDIA_PLAY_PAUSE}',
    'Pause': '{MEDIA_PLAY_PAUSE}',
    'TogglePlayPause': '{MEDIA_PLAY_PAUSE}',
    'SkipNext': '{MEDIA_NEXT_TRACK}',
    'SkipPrevious': '{MEDIA_PREV_TRACK}',
    'Stop': '{MEDIA_STOP}'
  };
  
  const sendKeyCode = keyMap[action];
  if (!sendKeyCode) {
    return { success: [], failed: [{ app: 'MediaKey', reason: 'Unknown action' }] };
  }
  
  const script = `
    Add-Type -AssemblyName System.Windows.Forms;
    [System.Windows.Forms.SendKeys]::SendWait('${sendKeyCode}');
    Write-Output "Sent ${sendKeyCode}";
  `.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  try {
    await executePowerShell(script);
    return { success: [action], failed: [] };
  } catch (error) {
    debug(`Failed to simulate media key:`, error.message);
    return { success: [], failed: [{ app: 'MediaKey', reason: error.message }] };
  }
}


