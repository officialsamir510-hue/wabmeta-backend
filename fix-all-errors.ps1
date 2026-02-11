# fix-all-errors.ps1

Write-Host "🔧 Fixing all TypeScript errors..." -ForegroundColor Green

# Step 1: Install missing packages
Write-Host "`n📦 Installing missing packages..." -ForegroundColor Cyan
npm install uuid
npm install --save-dev @types/uuid

# Step 2: Regenerate Prisma Client
Write-Host "`n🔄 Regenerating Prisma Client..." -ForegroundColor Cyan
npx prisma generate --force

# Step 3: Type check
Write-Host "`n✅ Running TypeScript check..." -ForegroundColor Cyan
npx tsc --noEmit

Write-Host "`n✅ All fixes applied!" -ForegroundColor Green
Write-Host "If errors persist, check the output above." -ForegroundColor Yellow