param(
    [Parameter(Mandatory=$true)]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [string[]]$SearchPatterns
)

# Import common functions
. "$PSScriptRoot\common.ps1"

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media,ContentType=WindowsRuntime] | Out-Null
$sessionManager = AwaitAction([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync())
$sessions = $sessionManager.GetSessions()

$results = @{
    controlled = @()
    notFound = @()
    available = @()
}

# Build map of sessions with friendly names
$sessionMap = @{}
foreach ($session in $sessions) {
    $appId = $session.SourceAppUserModelId
    $friendlyName = Get-ProcessName $appId
    $sessionMap[$appId] = $friendlyName
    $results.available += $friendlyName
}

# If no search patterns provided, control all sessions
$controlAll = ($null -eq $SearchPatterns -or $SearchPatterns.Length -eq 0)

# Find which patterns don't match any sessions
if (-not $controlAll) {
    foreach ($pattern in $SearchPatterns) {
        $found = $false
        foreach ($appId in $sessionMap.Keys) {
            $friendlyName = $sessionMap[$appId]
            if ($friendlyName.ToLower().Contains($pattern.ToLower()) -or $appId.ToLower().Contains($pattern.ToLower())) {
                $found = $true
                break
            }
        }
        if (-not $found) {
            $results.notFound += $pattern
        }
    }
}

# Control matching sessions
foreach ($session in $sessions) {
    $appId = $session.SourceAppUserModelId
    $friendlyName = $sessionMap[$appId]
    $shouldControl = $false
    
    if ($controlAll) {
        $shouldControl = $true
    } else {
        foreach ($pattern in $SearchPatterns) {
            if ($friendlyName.ToLower().Contains($pattern.ToLower()) -or $appId.ToLower().Contains($pattern.ToLower())) {
                $shouldControl = $true
                break
            }
        }
    }
    
    if ($shouldControl) {
        try {
            $actionTask = $session."Try$Action`Async"()
            $success = AwaitBool $actionTask
            if ($success) {
                $results.controlled += $friendlyName
            }
        } catch {}
    }
}

$results | ConvertTo-Json -Compress
