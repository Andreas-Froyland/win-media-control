# Common PowerShell functions for win-media-control

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

