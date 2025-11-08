param(
    [Parameter(Mandatory=$true)]
    [string]$Action
)

Add-Type -AssemblyName System.Windows.Forms

$keyMap = @{
    'Play' = '{MEDIA_PLAY_PAUSE}'
    'Pause' = '{MEDIA_PLAY_PAUSE}'
    'TogglePlayPause' = '{MEDIA_PLAY_PAUSE}'
    'SkipNext' = '{MEDIA_NEXT_TRACK}'
    'SkipPrevious' = '{MEDIA_PREV_TRACK}'
    'Stop' = '{MEDIA_STOP}'
}

$sendKeyCode = $keyMap[$Action]
if ($null -eq $sendKeyCode) {
    Write-Error "Unknown action: $Action"
    exit 1
}

[System.Windows.Forms.SendKeys]::SendWait($sendKeyCode)
Write-Output "Sent $sendKeyCode"
