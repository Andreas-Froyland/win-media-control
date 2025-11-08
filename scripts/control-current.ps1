param(
    [Parameter(Mandatory=$true)]
    [string]$Action
)

# Import common functions
. "$PSScriptRoot\common.ps1"

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media,ContentType=WindowsRuntime] | Out-Null
$sessionManager = AwaitAction([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync())
$currentSession = $sessionManager.GetCurrentSession()

if ($currentSession) {
    $actionTask = $currentSession."Try$Action`Async"()
    $result = AwaitBool $actionTask
    if ($result) {
        Write-Output "Success"
    } else {
        Write-Error "Action not supported"
    }
} else {
    Write-Error "No current session"
}
