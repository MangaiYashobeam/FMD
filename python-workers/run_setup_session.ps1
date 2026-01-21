# PowerShell script to run session setup interactively
# This opens a visible browser for Facebook login with 2FA

$ErrorActionPreference = "Stop"

# Set working directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Load environment variables from .env
$EnvFile = Join-Path $ScriptDir ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "✅ Loaded environment from .env" -ForegroundColor Green
}

Write-Host "`n🔐 FaceMyDealer Session Setup" -ForegroundColor Cyan
Write-Host "   This tool helps you log into Facebook and save the session"
Write-Host "   for automated posting later."
Write-Host ""

$PythonExe = Join-Path $ScriptDir "venv\Scripts\python.exe"

& $PythonExe -m scripts.setup_session
