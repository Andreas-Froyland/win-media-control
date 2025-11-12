# Common PowerShell functions for win-media-control

Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Add Windows API functions for version info extraction (matching Rust implementation)
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class VersionInfo {
    [StructLayout(LayoutKind.Sequential)]
    public struct LangCodePage {
        public ushort wLanguage;
        public ushort wCodePage;
    }

    [DllImport("version.dll", CharSet = CharSet.Unicode)]
    public static extern int GetFileVersionInfoSizeW(string lptstrFilename, IntPtr lpdwHandle);

    [DllImport("version.dll", CharSet = CharSet.Unicode)]
    public static extern bool GetFileVersionInfoW(string lptstrFilename, int dwHandle, int dwLen, IntPtr lpData);

    [DllImport("version.dll", CharSet = CharSet.Unicode)]
    public static extern bool VerQueryValueW(IntPtr pBlock, string lpSubBlock, out IntPtr lplpBuffer, out uint puLen);

    public static string GetFileDescription(string filePath) {
        int size = GetFileVersionInfoSizeW(filePath, IntPtr.Zero);
        if (size == 0) return null;

        IntPtr buffer = Marshal.AllocHGlobal(size);
        try {
            if (!GetFileVersionInfoW(filePath, 0, size, buffer)) {
                return null;
            }

            // Query Translation to get language/code page
            IntPtr langPtr;
            uint langLen;
            if (!VerQueryValueW(buffer, @"\VarFileInfo\Translation", out langPtr, out langLen)) {
                return null;
            }

            if (langLen < 4) return null;

            LangCodePage lang;
            lang = (LangCodePage)Marshal.PtrToStructure(langPtr, typeof(LangCodePage));

            // Construct path with actual language/code page
            string langCode = $@"\StringFileInfo\{lang.wLanguage:X4}{lang.wCodePage:X4}\FileDescription";

            // Query FileDescription
            IntPtr descPtr;
            uint descLen;
            if (!VerQueryValueW(buffer, langCode, out descPtr, out descLen)) {
                return null;
            }

            if (descLen == 0) return null;

            // Read the string (it's null-terminated)
            string description = Marshal.PtrToStringUni(descPtr);
            if (string.IsNullOrEmpty(description)) return null;

            // Remove null terminators
            description = description.TrimEnd('\0');
            return description;
        } finally {
            Marshal.FreeHGlobal(buffer);
        }
    }
}
"@

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

Function Get-FileDescription($filePath) {
    if (-not $filePath -or -not (Test-Path $filePath)) {
        return ""
    }
    
    try {
        $description = [VersionInfo]::GetFileDescription($filePath)
        if ($description -and $description.Trim() -ne "") {
            return $description.Trim()
        }
    } catch {}
    
    # Fall back to file stem (filename without extension)
    try {
        $fileInfo = Get-Item $filePath -ErrorAction SilentlyContinue
        if ($fileInfo) {
            return $fileInfo.BaseName
        }
    } catch {}
    
    return ""
}

Function Get-ChromeExtensionName($appId) {
    # Known Chrome extension IDs to friendly names mapping
    # Common PWAs and extensions
    $knownExtensions = @{
        "cinhimbnkkghhklpknlkffjgod" = "YouTube Music"
        "agimkijbahpaejmloijcagaamomiljlf" = "YouTube"
        "pkedcjkdefgpdelpbcmbmeomcjbeemfm" = "Chrome Media Router"
    }
    
    # Try to get Chrome extension/PWA name from registry
    # Chrome extensions/PWAs are registered under AppUserModelId
    $registryPaths = @(
        "HKLM:\SOFTWARE\Classes\AppUserModelId\$appId",
        "HKCU:\SOFTWARE\Classes\AppUserModelId\$appId"
    )
    
    foreach ($path in $registryPaths) {
        if (Test-Path $path) {
            try {
                # Try DisplayName first
                $displayName = (Get-ItemProperty -Path $path -Name "DisplayName" -ErrorAction SilentlyContinue).DisplayName
                if ($displayName -and $displayName -ne "") {
                    return $displayName
                }
                
                # Try ApplicationName
                $appName = (Get-ItemProperty -Path $path -Name "ApplicationName" -ErrorAction SilentlyContinue).ApplicationName
                if ($appName -and $appName -ne "") {
                    return $appName
                }
            } catch {}
        }
    }
    
    # For Chrome extensions, the extension ID is in the appId
    # The extension ID format is: Chrome._crx_<extension_id>
    if ($appId -match '^Chrome\._crx_(.+)$') {
        $extensionId = $matches[1]
        
        # Check known extensions mapping
        if ($knownExtensions.ContainsKey($extensionId)) {
            return $knownExtensions[$extensionId]
        }
        
        # Try to find PWA name from Chrome's preferences file
        # Chrome stores PWA info in: %LOCALAPPDATA%\Google\Chrome\User Data\Default\Web Applications
        $chromeDataPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Web Applications"
        if (Test-Path $chromeDataPath) {
            try {
                $webApps = Get-ChildItem -Path $chromeDataPath -Directory -ErrorAction SilentlyContinue
                foreach ($webApp in $webApps) {
                    $manifestPath = Join-Path $webApp.FullName "manifest.json"
                    if (Test-Path $manifestPath) {
                        try {
                            $manifestContent = Get-Content $manifestPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
                            if ($manifestContent -and $manifestContent.app_id -eq $extensionId) {
                                if ($manifestContent.name -and $manifestContent.name -ne "") {
                                    return $manifestContent.name
                                }
                            }
                        } catch {}
                    }
                }
            } catch {}
        }
        
        # Try Chrome's preferences JSON file
        $prefsPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Preferences"
        if (Test-Path $prefsPath) {
            try {
                $prefsContent = Get-Content $prefsPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($prefsContent -and $prefsContent.extensions -and $prefsContent.extensions.settings) {
                    $extSettings = $prefsContent.extensions.settings
                    if ($extSettings.PSObject.Properties.Name -contains $extensionId) {
                        $extInfo = $extSettings.$extensionId
                        if ($extInfo -and $extInfo.name -and $extInfo.name -ne "") {
                            return $extInfo.name
                        }
                    }
                }
                
                # Check for PWAs in preferences
                if ($prefsContent -and $prefsContent.profile -and $prefsContent.profile.web_apps) {
                    foreach ($webApp in $prefsContent.profile.web_apps.PSObject.Properties.Value) {
                        if ($webApp -and $webApp.app_id -eq $extensionId) {
                            if ($webApp.name -and $webApp.name -ne "") {
                                return $webApp.name
                            }
                        }
                    }
                }
            } catch {}
        }
    }
    
    return ""
}

Function Get-ProcessName($appId) {
    $appIdClean = $appId -replace '\.exe$', ''
    
    # 1. Try running processes first (most common case, fastest check)
    # Try to get process by exact appId match (for .exe processes)
    try {
        $processes = Get-Process -Name $appIdClean -ErrorAction SilentlyContinue
        if ($processes) {
            $proc = $processes[0]
            try {
                $exePath = $proc.MainModule.FileName
                $fileDescription = Get-FileDescription $exePath
                if ($fileDescription -and $fileDescription -ne "") {
                    return $fileDescription
                }
            } catch {}
            return $proc.ProcessName
        }
    } catch {}
    
    # Try to extract process name from appId patterns like "CompanyName.AppName_xxx!ProcessName"
    # Examples: "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify" -> "Spotify"
    if ($appId -match '!(.+)$') {
        $processName = $matches[1]
        try {
            $proc = Get-Process -Name $processName -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($proc) {
                try {
                    $exePath = $proc.MainModule.FileName
                    $fileDescription = Get-FileDescription $exePath
                    if ($fileDescription -and $fileDescription -ne "") {
                        return $fileDescription
                    }
                } catch {}
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
                try {
                    $exePath = $proc.MainModule.FileName
                    $fileDescription = Get-FileDescription $exePath
                    if ($fileDescription -and $fileDescription -ne "") {
                        return $fileDescription
                    }
                } catch {}
                return $proc.ProcessName
            }
        } catch {}
    }
    
    if ($appId -match '\.exe$') {
        return $appIdClean
    }
    
    # 2. Try Registry for Win32 apps (covers apps that may not be running)
    $registryPaths = @(
        "HKLM:\SOFTWARE\Classes\AppUserModelId\$appId",
        "HKCU:\SOFTWARE\Classes\AppUserModelId\$appId"
    )
    
    foreach ($path in $registryPaths) {
        if (Test-Path $path) {
            try {
                # Try DisplayName first
                $displayName = (Get-ItemProperty -Path $path -Name "DisplayName" -ErrorAction SilentlyContinue).DisplayName
                if ($displayName -and $displayName -ne "") {
                    return $displayName
                }
                
                # Try to get executable path from registry and extract FileDescription
                # Some registry entries may have executable path in different properties
                $regProps = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue
                if ($regProps) {
                    # Check common properties that might contain executable path
                    $exePath = $null
                    if ($regProps.ExecutablePath) { $exePath = $regProps.ExecutablePath }
                    elseif ($regProps.ApplicationExecutable) { $exePath = $regProps.ApplicationExecutable }
                    elseif ($regProps.ApplicationPath) { $exePath = $regProps.ApplicationPath }
                    
                    if ($exePath -and (Test-Path $exePath)) {
                        $fileDescription = Get-FileDescription $exePath
                        if ($fileDescription -and $fileDescription -ne "") {
                            return $fileDescription
                        }
                    }
                }
            } catch {}
        }
    }
    
    # 3. Try UWP/Windows Store/PWA apps via Get-AppxPackage
    # Note: Get-AppxPackage covers both UWP apps (distributed via Microsoft Store) and PWAs
    # This MUST be checked before Firefox fallback to properly identify PWAs
    try {
        # Extract PackageFamilyName from AppUserModelId by splitting on '!'
        $packageFamilyName = $appId.Split('!')[0]
        $app = Get-AppxPackage | Where-Object { $_.PackageFamilyName -eq $packageFamilyName } | Select-Object -First 1
        
        if ($app) {
            # Try to find executable in InstallLocation
            if ($app.InstallLocation) {
                $installPath = $app.InstallLocation
                # Look for .exe files in the package directory
                $exeFiles = Get-ChildItem -Path $installPath -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($exeFiles) {
                    $fileDescription = Get-FileDescription $exeFiles.FullName
                    if ($fileDescription -and $fileDescription -ne "") {
                        return $fileDescription
                    }
                }
            }
            
            # Fall back to package DisplayName
            if ($app.DisplayName) {
                return $app.DisplayName
            }
        }
        
        # Also check for Edge-based PWAs (MSEdge.* patterns)
        # PWAs installed via Edge typically have appIds starting with MSEdge
        if ($appId -match '^MSEdge\.') {
            # Try to find the PWA in installed apps by searching all packages
            # PWAs may have package family names that partially match the appId
            $allApps = Get-AppxPackage | Where-Object { 
                $appId -like "*$($_.PackageFamilyName)*" -or 
                $_.PackageFamilyName -like "*$packageFamilyName*"
            }
            foreach ($pwaApp in $allApps) {
                if ($pwaApp.DisplayName) {
                    return $pwaApp.DisplayName
                }
            }
            
            # Also check registry for Edge PWAs
            $edgePwaRegPath = "HKCU:\SOFTWARE\Classes\Extensions\ContractId\Windows.Protocol\PackageId\$packageFamilyName"
            if (Test-Path $edgePwaRegPath) {
                try {
                    $displayName = (Get-ItemProperty -Path $edgePwaRegPath -Name "DisplayName" -ErrorAction SilentlyContinue).DisplayName
                    if ($displayName -and $displayName -ne "") {
                        return $displayName
                    }
                } catch {}
            }
        }
    } catch {}
    
    # 4. Handle Chrome extensions and PWAs (Chrome._crx_* or Chrome.* patterns)
    if ($appId -match '^Chrome\.') {
        # Try to find Chrome process first
        try {
            $chromeProc = Get-Process -Name chrome -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($chromeProc) {
                try {
                    $exePath = $chromeProc.MainModule.FileName
                    $fileDescription = Get-FileDescription $exePath
                    if ($fileDescription -and $fileDescription -ne "") {
                        # For Chrome extensions/PWAs, try to get the specific app name from registry
                        $chromeAppName = Get-ChromeExtensionName $appId
                        if ($chromeAppName -and $chromeAppName -ne "") {
                            return $chromeAppName
                        }
                        return $fileDescription
                    }
                } catch {}
                # Try to get extension name from registry
                $chromeAppName = Get-ChromeExtensionName $appId
                if ($chromeAppName -and $chromeAppName -ne "") {
                    return $chromeAppName
                }
                return "Chrome"
            }
        } catch {}
        
        # Try registry for Chrome extension/PWA name
        $chromeAppName = Get-ChromeExtensionName $appId
        if ($chromeAppName -and $chromeAppName -ne "") {
            return $chromeAppName
        }
        
        # Fallback to "Chrome" if Chrome process exists
        $chromeProc = Get-Process -Name chrome -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($chromeProc) {
            return "Chrome"
        }
    }
    
    # 5. Firefox fallback: Firefox uses session IDs that don't match any useful pattern
    # Only use this as LAST RESORT after all other checks (including PWAs) have failed
    # Only trigger if appId doesn't match known patterns AND Firefox process exists
    if ($appId -notmatch '\.exe$' -and $appId -notmatch '^[A-Za-z]+\.[A-Za-z]+' -and $appId -notmatch '^MSEdge\.' -and $appId -notmatch '^Chrome\.') {
        $firefoxProc = Get-Process -Name firefox -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($firefoxProc) {
            try {
                $exePath = $firefoxProc.MainModule.FileName
                $fileDescription = Get-FileDescription $exePath
                if ($fileDescription -and $fileDescription -ne "") {
                    return $fileDescription
                }
            } catch {}
            return "Firefox"
        }
    }
    
    # Return the appId itself if we couldn't find a friendly name
    return $appId
}
