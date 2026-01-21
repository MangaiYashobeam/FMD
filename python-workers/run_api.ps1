# PowerShell script to start the Worker API server
# This API receives tasks from the Node.js backend and manages workers

param(
    [string]$Host = "0.0.0.0",
    [int]$Port = 8001,
    [switch]$Reload
)

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

Write-Host "`n🚀 Starting Worker API Server..." -ForegroundColor Cyan
Write-Host "   Host: $Host"
Write-Host "   Port: $Port"
Write-Host "   Reload: $Reload"
Write-Host ""

$PythonExe = Join-Path $ScriptDir "venv\Scripts\python.exe"

$args = @("-m", "uvicorn", "api.main:app", "--host", $Host, "--port", $Port)
if ($Reload) {
    $args += "--reload"
}

& $PythonExe @args
