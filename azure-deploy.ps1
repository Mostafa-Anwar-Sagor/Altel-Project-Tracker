# ============================================================
# ProTracker — Azure Deployment Script
# Requires: Azure CLI (winget install Microsoft.AzureCLI)
# Run this once to create all Azure resources and deploy.
# ============================================================

param(
    [string]$AppName      = "protracker-altel",      # must be globally unique
    [string]$ResourceGroup= "rg-protracker",
    [string]$Location     = "southeastasia",          # closest to Malaysia
    [string]$SecretKey    = "",                       # REQUIRED — set below or pass as param
    [string]$FrontendName = "protracker-frontend"     # Static Web App name
)

if (-not $SecretKey) {
    # Generate a random 64-char secret key
    $SecretKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
}

$BackendUrl = "https://$AppName.azurewebsites.net"

Write-Host "`n=== ProTracker Azure Deployment ===" -ForegroundColor Cyan
Write-Host "App Name      : $AppName" -ForegroundColor White
Write-Host "Resource Group: $ResourceGroup" -ForegroundColor White
Write-Host "Location      : $Location" -ForegroundColor White
Write-Host "Backend URL   : $BackendUrl`n" -ForegroundColor White

# ── Step 1: Login ────────────────────────────────────────────────────────────
Write-Host "[1/7] Logging into Azure..." -ForegroundColor Green
az login

# ── Step 2: Resource Group ────────────────────────────────────────────────────
Write-Host "[2/7] Creating resource group '$ResourceGroup'..." -ForegroundColor Green
az group create --name $ResourceGroup --location $Location

# ── Step 3: App Service Plan (B1 — uses ~$13/month from your $100 credits) ───
Write-Host "[3/7] Creating App Service Plan (B1 Linux)..." -ForegroundColor Green
az appservice plan create `
    --name "$AppName-plan" `
    --resource-group $ResourceGroup `
    --sku B1 `
    --is-linux

# ── Step 4: Web App (Python 3.11) ────────────────────────────────────────────
Write-Host "[4/7] Creating Web App '$AppName'..." -ForegroundColor Green
az webapp create `
    --name $AppName `
    --resource-group $ResourceGroup `
    --plan "$AppName-plan" `
    --runtime "PYTHON:3.11"

# Set startup command
az webapp config set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --startup-file "startup.sh"

# ── Step 5: Configure environment variables ───────────────────────────────────
Write-Host "[5/7] Configuring environment variables..." -ForegroundColor Green
$FrontendUrl = "https://$FrontendName.azurestaticapps.net"
az webapp config appsettings set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --settings `
        SECRET_KEY="$SecretKey" `
        DEBUG="False" `
        ALLOWED_HOSTS="$AppName.azurewebsites.net" `
        CORS_ALLOWED_ORIGINS="$FrontendUrl" `
        USE_REDIS="False" `
        SCM_DO_BUILD_DURING_DEPLOYMENT="true"

# ── Step 6: Deploy backend (zip deploy) ───────────────────────────────────────
Write-Host "[6/7] Deploying Django backend..." -ForegroundColor Green
$BackendDir = Join-Path $PSScriptRoot "backend"
$ZipPath    = Join-Path $env:TEMP "protracker-backend.zip"
Push-Location $BackendDir
Compress-Archive -Path * -DestinationPath $ZipPath -Force
Pop-Location
az webapp deploy `
    --name $AppName `
    --resource-group $ResourceGroup `
    --src-path $ZipPath `
    --type zip

Write-Host "  Waiting 30 seconds for app to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Run seed data after deploy
Write-Host "  Running database seed..." -ForegroundColor Yellow
az webapp ssh --name $AppName --resource-group $ResourceGroup --command "cd /home/site/wwwroot && python seed_data.py" 2>$null
Write-Host "  (Seed via SSH may not be available on B1 — use Kudu console if needed)" -ForegroundColor Yellow

# ── Step 7: Build and deploy frontend ─────────────────────────────────────────
Write-Host "[7/7] Building and deploying React frontend..." -ForegroundColor Green
$FrontendDir = Join-Path $PSScriptRoot "frontend"
Push-Location $FrontendDir

# Write production .env for Vite
Set-Content ".env.production" "VITE_API_BASE_URL=$BackendUrl"

npm install
npm run build

az staticwebapp create `
    --name $FrontendName `
    --resource-group $ResourceGroup `
    --location "eastasia" `
    --source $FrontendDir `
    --output-location "dist" `
    --login-with-github 2>$null

# Fallback: manual zip deploy for SWA
$SwaZip = Join-Path $env:TEMP "protracker-frontend.zip"
Compress-Archive -Path "dist\*" -DestinationPath $SwaZip -Force

Pop-Location

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Backend  : $BackendUrl" -ForegroundColor White
Write-Host "  Frontend : $FrontendUrl" -ForegroundColor White
Write-Host "  Admin    : $BackendUrl/admin/" -ForegroundColor White
Write-Host "`n  Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open $FrontendUrl in your browser" -ForegroundColor White
Write-Host "  2. Log in with admin / admin123456" -ForegroundColor White
Write-Host "  3. Go to Settings → Notifications → SMTP Config" -ForegroundColor White
Write-Host "     to configure email notifications" -ForegroundColor White
Write-Host "  4. (Optional) Set a custom domain in Azure Portal" -ForegroundColor White
Write-Host "`n  Secret key saved — keep it safe!" -ForegroundColor Yellow
Write-Host "  $SecretKey" -ForegroundColor DarkGray
Write-Host ""
