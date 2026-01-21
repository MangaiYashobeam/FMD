# PowerShell script to run Python workers without Docker
# Usage: .\run_worker.ps1 [worker_type] [worker_count]
# Example: .\run_worker.ps1 posting 3

param(
    [string]$WorkerType = "posting",
    [int]$WorkerCount = 1
)

$ErrorActionPreference = "Stop"

# Set working directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Activate virtual environment
$VenvPath = Join-Path $ScriptDir "venv\Scripts\Activate.ps1"
if (-not (Test-Path $VenvPath)) {
    Write-Host "❌ Virtual environment not found. Run: python -m venv venv" -ForegroundColor Red
    exit 1
}

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

# Check Redis connection
Write-Host "`n🔍 Checking Redis connection..." -ForegroundColor Cyan
$RedisUrl = $env:REDIS_URL
if (-not $RedisUrl) {
    $RedisUrl = "redis://localhost:6379"
}
Write-Host "   Redis URL: $RedisUrl"

# Start workers
Write-Host "`n🚀 Starting $WorkerCount $WorkerType worker(s)..." -ForegroundColor Cyan

$Jobs = @()

for ($i = 1; $i -le $WorkerCount; $i++) {
    $WorkerName = "$WorkerType-worker-$i"
    Write-Host "   Starting $WorkerName..." -ForegroundColor Yellow
    
    $Job = Start-Job -Name $WorkerName -ScriptBlock {
        param($ScriptDir, $WorkerType, $WorkerId)
        
        Set-Location $ScriptDir
        
        # Load env
        $EnvFile = Join-Path $ScriptDir ".env"
        if (Test-Path $EnvFile) {
            Get-Content $EnvFile | ForEach-Object {
                if ($_ -match '^([^#=]+)=(.*)$') {
                    $key = $matches[1].Trim()
                    $value = $matches[2].Trim()
                    [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
                }
            }
        }
        
        # Set worker ID
        $env:WORKER_ID = $WorkerId
        
        # Run worker
        $PythonExe = Join-Path $ScriptDir "venv\Scripts\python.exe"
        $Module = "workers.${WorkerType}_worker"
        & $PythonExe -m $Module
    } -ArgumentList $ScriptDir, $WorkerType, $i
    
    $Jobs += $Job
}

Write-Host "`n✅ Started $WorkerCount worker(s)" -ForegroundColor Green
Write-Host "   Press Ctrl+C to stop all workers`n" -ForegroundColor Yellow

# Monitor jobs
try {
    while ($true) {
        foreach ($Job in $Jobs) {
            if ($Job.State -eq "Failed") {
                Write-Host "❌ Worker $($Job.Name) failed!" -ForegroundColor Red
                Receive-Job $Job
            }
            elseif ($Job.State -eq "Completed") {
                Write-Host "⚠️ Worker $($Job.Name) completed unexpectedly" -ForegroundColor Yellow
                Receive-Job $Job
            }
        }
        Start-Sleep -Seconds 5
    }
}
finally {
    Write-Host "`n🛑 Stopping workers..." -ForegroundColor Yellow
    $Jobs | Stop-Job -PassThru | Remove-Job
    Write-Host "✅ All workers stopped" -ForegroundColor Green
}
