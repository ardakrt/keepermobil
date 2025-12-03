# PowerShell script to fix node_modules and build issues
Write-Host "Cleaning up node_modules and caches..." -ForegroundColor Green

# Remove node_modules and cache folders
if (Test-Path "node_modules") {
    Write-Host "Removing node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force node_modules
}

if (Test-Path ".expo") {
    Write-Host "Removing .expo cache..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .expo
}

# Clean npm cache
Write-Host "Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force

# Fresh install with CI for exact versions
Write-Host "Installing dependencies with npm ci..." -ForegroundColor Green
npm ci

# Verify installation
Write-Host "Verifying expo-notifications installation..." -ForegroundColor Green
npm ls expo-notifications

Write-Host "Setup complete! You can now run: eas build --profile development --platform android" -ForegroundColor Green
