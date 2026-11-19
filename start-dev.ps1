# start-dev.ps1 - Launches `npm run tauri dev` with admin privileges (required by the app).
$ErrorActionPreference = "Stop"

# Check if already elevated
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Admin yetkisi gerekli - UAC onayi istenecek..." -ForegroundColor Yellow
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "powershell.exe"
    $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    $psi.Verb = "runas"
    $psi.WorkingDirectory = $PSScriptRoot
    try {
        [System.Diagnostics.Process]::Start($psi) | Out-Null
    } catch {
        Write-Host "Yuksek yetki alinamadi: $_" -ForegroundColor Red
    }
    exit
}

Set-Location $PSScriptRoot
npm run tauri dev