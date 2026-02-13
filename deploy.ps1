# QuickHands Backend Deployment Script

Write-Host "🚀 Deploying QuickHands Backend..." -ForegroundColor Cyan
Write-Host ""

# Navigate to quickhands directory
Set-Location "C:\Users\gamerrdotcom\Desktop\quickhands"

# Check git status
Write-Host "📋 Checking git status..." -ForegroundColor Yellow
git status --short

Write-Host ""
Write-Host "📦 Adding all changes..." -ForegroundColor Yellow
git add .

Write-Host ""
Write-Host "💾 Committing changes..." -ForegroundColor Yellow
git commit -m "Add resilient application endpoint with quotation/conditions support

- Added quotation and conditions fields with graceful fallback
- Implemented 5-application limit per job
- Added test endpoint for diagnostics
- Fixed Socket.IO configuration
- Applications work even if migration not run yet

Co-Authored-By: Warp <agent@warp.dev>"

Write-Host ""
Write-Host "🌐 Pushing to GitHub (Vercel will auto-deploy)..." -ForegroundColor Yellow
git push

Write-Host ""
Write-Host "✅ Code pushed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "⏳ Waiting for Vercel deployment (about 2 minutes)..." -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Check deployment status at:" -ForegroundColor White
Write-Host "   https://vercel.com/dashboard" -ForegroundColor Blue
Write-Host ""
Write-Host "🧪 After deployment completes, test at:" -ForegroundColor White
Write-Host "   https://quickhands-api.vercel.app/api/test/test-apply" -ForegroundColor Blue
Write-Host ""
Write-Host "💡 Tip: If you see 'hasQuotation: false', run the database migration!" -ForegroundColor Yellow
Write-Host "   Go to https://console.neon.tech and run the migration SQL" -ForegroundColor Yellow
Write-Host ""
