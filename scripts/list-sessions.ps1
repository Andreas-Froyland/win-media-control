# Import common functions
. "$PSScriptRoot\common.ps1"

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
        # Load the media properties type
        [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media,ContentType=WindowsRuntime] | Out-Null
        
        $mediaPropsTask = $session.TryGetMediaPropertiesAsync()
        $asTaskMedia = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
            $_.ToString() -match 'AsTask.*IAsyncOperation' 
        })[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $mediaTask = $asTaskMedia.Invoke($null, @($mediaPropsTask))
        $mediaTask.Wait() | Out-Null
        $media = $mediaTask.Result
        $result.title = $media.Title
        $result.artist = $media.Artist
    } catch {}
    
    $results += $result
}

$results | ConvertTo-Json -Compress
