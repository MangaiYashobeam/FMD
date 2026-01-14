# FaceMyDealer - Quick Start Script
# This script helps you get started with the project

Write-Host "
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          FaceMyDealer - Quick Start Setup                ║
║     Auto Dealer Facebook Marketplace Automation          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

Write-Host "`n[1/6] Checking Node.js installation..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "  ✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/6] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/6] Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  ✓ .env file exists" -ForegroundColor Green
} else {
    Write-Host "  ! Creating .env from example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "  ⚠ Please edit .env with your configuration before continuing" -ForegroundColor Yellow
    Write-Host "    Required: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET" -ForegroundColor White
    
    $continue = Read-Host "`n  Press Enter when .env is configured, or type 'skip' to continue anyway"
    if ($continue -ne "skip") {
        Write-Host "`n  Opening .env in default editor..." -ForegroundColor Yellow
        Start-Process notepad.exe ".env"
        Read-Host "  Press Enter after saving .env to continue"
    }
}

Write-Host "`n[4/6] Generating Prisma client..." -ForegroundColor Yellow
npm run db:generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Prisma client generated" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to generate Prisma client" -ForegroundColor Red
    Write-Host "    Make sure DATABASE_URL is set in .env" -ForegroundColor Yellow
}

Write-Host "`n[5/6] Checking database connection..." -ForegroundColor Yellow
$dbCheck = Read-Host "  Do you want to push the database schema now? (yes/no)"
if ($dbCheck -eq "yes" -or $dbCheck -eq "y") {
    npm run db:push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Database schema created" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to create database schema" -ForegroundColor Red
        Write-Host "    Check your DATABASE_URL and ensure PostgreSQL is running" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⊘ Skipped database setup" -ForegroundColor Yellow
    Write-Host "    Run 'npm run db:push' when ready" -ForegroundColor White
}

Write-Host "`n[6/6] Setup Summary" -ForegroundColor Yellow
Write-Host "
  ┌─────────────────────────────────────────────────┐
  │  Setup Complete! Here's what to do next:       │
  └─────────────────────────────────────────────────┘

  📚 Read the documentation:
     - README.md          (Overview)
     - SETUP_GUIDE.md     (Detailed setup)
     - PROJECT_SUMMARY.md (What we built)
     - TODO.md            (Next tasks)

  🚀 Start development server:
     npm run dev

  🗄️  Open database GUI:
     npm run db:studio

  🔍 Test the API:
     curl http://localhost:3000/health

  📝 Useful commands:
     npm run dev          - Start dev server
     npm run build        - Build for production
     npm run db:studio    - Database GUI
     npm run db:push      - Push schema changes

  🎯 Next steps:
     1. Configure .env file properly
     2. Setup PostgreSQL database
     3. Setup Redis (for job queue)
     4. Start development server
     5. Test authentication endpoints
     6. Begin building vehicle controller

  ⚠️  Important:
     - Keep your .env file secure
     - Never commit .env to git
     - Use strong JWT secrets
     - Setup Facebook app for OAuth

  📞 Need help?
     - Check SETUP_GUIDE.md for detailed steps
     - Review logs/ directory for errors
     - Check GitHub issues

" -ForegroundColor White

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                           ║" -ForegroundColor Cyan
Write-Host "║           Ready to build! Happy coding! 🚀                ║" -ForegroundColor Cyan
Write-Host "║                                                           ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$startServer = Read-Host "`nStart development server now? (yes/no)"
if ($startServer -eq "yes" -or $startServer -eq "y") {
    Write-Host "`nStarting server..." -ForegroundColor Green
    npm run dev
}
