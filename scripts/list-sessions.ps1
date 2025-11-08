Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.ToString() -eq 'System.Threading.Tasks.Task`1[TResult] AsTask[TResult](Windows.Foundation.IAsyncOperation`1[TResult])' 
})[0]

Function AwaitAction($WinRtAction) {
    $asTask = $asTaskGeneric.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    $netTask = $asTask.Invoke($null, @($WinRtAction))
    $netTask.Wait() | Out-Null
    $netTask.Result
}

Function Get-ProcessName($appId) {
    $appIdClean = $appId -replace '\.exe$', ''
    
    try {
        $processes = Get-Process -Name $appIdClean -ErrorAction SilentlyContinue
        if ($processes) {
            $proc = $processes[0]
            if ($proc.MainModule.FileVersionInfo.FileDescription) {
                return $proc.MainModule.FileVersionInfo.FileDescription
            }
            return $proc.ProcessName
        }
    } catch {}
    
    if ($appId -match '\.exe$') {
        return $appIdClean
    }
    
    try {
        $package = Get-AppxPackage | Where-Object { 
            $_.PackageFamilyName -like "*$appId*" -or $_.Name -like "*$appId*" 
        } | Select-Object -First 1
        if ($package -and $package.Name) {
            return $package.Name
        }
    } catch {}
    
    if ($appId -notmatch '\.exe$') {
        $firefoxProc = Get-Process -Name firefox -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($firefoxProc) {
            try {
                if ($firefoxProc.MainModule.FileVersionInfo.FileDescription) {
                    return $firefoxProc.MainModule.FileVersionInfo.FileDescription
                }
            } catch {}
            return "Firefox"
        }
    }
    
    return $appId
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media,ContentType=WindowsRuntime] | Out-Null
$sessionManager = AwaitAction([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync())
$sessions = $sessionManager.GetSessions()

$results = @()
foreach ($session in $sessions) {
    $playback = $session.GetPlaybackInfo()
    $appId = $session.SourceAppUserModelId
    $friendlyName = Get-ProcessName $appId
    
    $result = @{
        appName = $friendlyName
        appId = $appId
        title = ''
        artist = ''
        playbackStatus = $playback.PlaybackStatus.ToString()
    }
    
    try {
        $mediaPropsTask = $session.TryGetMediaPropertiesAsync()
        $asTaskMedia = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
            $_.ToString() -match 'AsTask.*IAsyncOperation' 
        })[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsMediaProperties])
        $mediaTask = $asTaskMedia.Invoke($null, @($mediaPropsTask))
        $mediaTask.Wait() | Out-Null
        $media = $mediaTask.Result
        $result.title = $media.Title
        $result.artist = $media.Artist
    } catch {}
    
    $results += $result
}

$results | ConvertTo-Json -Compress

