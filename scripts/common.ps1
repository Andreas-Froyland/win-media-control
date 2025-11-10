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
    
    # Try to get process by exact appId match (for .exe processes)
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
    
    # Try to get UWP package info
    try {
        $package = Get-AppxPackage | Where-Object { 
            $_.PackageFamilyName -like "*$appId*" -or $_.Name -like "*$appId*" 
        } | Select-Object -First 1
        if ($package -and $package.Name) {
            return $package.Name
        }
    } catch {}
    
    # Try to extract process name from appId patterns like "CompanyName.AppName_xxx!ProcessName"
    # Examples: "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify" -> "Spotify"
    if ($appId -match '!(.+)$') {
        $processName = $matches[1]
        try {
            $proc = Get-Process -Name $processName -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($proc) {
                if ($proc.MainModule.FileVersionInfo.FileDescription) {
                    return $proc.MainModule.FileVersionInfo.FileDescription
                }
                return $proc.ProcessName
            }
        } catch {}
    }
    
    # Try to extract from "CompanyName.AppName_xxx" pattern
    if ($appId -match '^[^.]+\.([^_]+)') {
        $appName = $matches[1]
        try {
            $proc = Get-Process -Name $appName -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($proc) {
                if ($proc.MainModule.FileVersionInfo.FileDescription) {
                    return $proc.MainModule.FileVersionInfo.FileDescription
                }
                return $proc.ProcessName
            }
        } catch {}
    }
    
    # Firefox fallback: Firefox uses session IDs that don't match any useful pattern
    # Only use this as last resort for unidentifiable appIds
    if ($appId -notmatch '\.exe$' -and $appId -notmatch '^[A-Za-z]+\.[A-Za-z]+') {
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
    
    # Return the appId itself if we couldn't find a friendly name
    return $appId
}

