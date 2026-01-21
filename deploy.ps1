# deploy.ps1 - FaceMyDealer Quick Deploy Script
# Usage: .\deploy.ps1 -message "Your commit message"
# Options: -skipBuild (fast deploy), -force (reset VPS to match GitHub)

param(
    [string]$message = "Update deployment",
    [switch]$skipBuild,
    [switch]$force,
    [string]$service = ""
)

$VPS = "root@46.4.224.182"
$PROJECT = "/opt/facemydealer"
$COMPOSE = "docker-compose.production.yml"

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║  🚀 FaceMyDealer Quick Deploy                 ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Git operations
Write-Host "📦 Step 1: Git Operations" -ForegroundColor Yellow
Write-Host "   Staging all changes..." -ForegroundColor Gray
git add -A

Write-Host "   Committing: $message" -ForegroundColor Gray
git commit -m $message 2>$null
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1) {
    # Exit code 1 means nothing to commit, which is fine
    if ($LASTEXITCODE -ne 1) {
        Write-Host "   ❌ Git commit failed!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "   Pushing to GitHub..." -ForegroundColor Gray
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Git push failed!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Code pushed successfully!" -ForegroundColor Green

# Step 2: Deploy to VPS
Write-Host ""
Write-Host "🔄 Step 2: Deploying to VPS ($VPS)" -ForegroundColor Yellow

# Build the SSH command
if ($force) {
    Write-Host "   Mode: Force sync (reset to origin/main)" -ForegroundColor Magenta
    $cmd = "cd $PROJECT && git fetch origin && git reset --hard origin/main"
} else {
    Write-Host "   Mode: Normal pull" -ForegroundColor Gray
    $cmd = "cd $PROJECT && git pull origin main"
}

# Add docker compose command
if ($service -ne "") {
    Write-Host "   Service: $service only" -ForegroundColor Cyan
    if ($skipBuild) {
        $cmd += " && docker compose -f $COMPOSE up -d $service"
    } else {
        $cmd += " && docker compose -f $COMPOSE up -d --build $service"
    }
} else {
    Write-Host "   Service: All services" -ForegroundColor Cyan
    if ($skipBuild) {
        $cmd += " && docker compose -f $COMPOSE up -d"
        Write-Host "   Build: Skipped (using existing images)" -ForegroundColor Gray
    } else {
        $cmd += " && docker compose -f $COMPOSE up -d --build"
        Write-Host "   Build: Rebuilding images" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "   Connecting to VPS..." -ForegroundColor Gray
ssh $VPS $cmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║  ✅ Deployment Successful!                    ║" -ForegroundColor Green
    Write-Host "  ╚═══════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  🌐 Site: https://dealersface.com" -ForegroundColor Cyan
    Write-Host "  🔧 API:  http://46.4.224.182/health" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "  ║  ❌ Deployment Failed!                        ║" -ForegroundColor Red
    Write-Host "  ╚═══════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Step 3: Show status
Write-Host "📊 Step 3: Container Status" -ForegroundColor Yellow
Write-Host ""
ssh $VPS "docker compose -f $PROJECT/$COMPOSE ps --format 'table {{.Name}}\t{{.Status}}'"
Write-Host ""
