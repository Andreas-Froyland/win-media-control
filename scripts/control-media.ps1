param(
    [Parameter(Mandatory=$true)]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [string[]]$SearchPatterns
)

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

Function AwaitBool($WinRtAction) {
    $asTask = $asTaskGeneric.MakeGenericMethod([bool])
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

