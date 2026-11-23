# PharmaChain 1-Click Launch Script for PowerShell
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  PHARMACHAIN: BLOCKCHAIN SUPPLY CHAIN DEMO LAUNCHER" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[1/3] Starting Local Ethereum EVM Blockchain Node..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; npx hardhat node"

Write-Host "Waiting 4 seconds for Ethereum node to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 4

Write-Host "[2/3] Deploying Smart Contracts & Seeding Demo Network..." -ForegroundColor Yellow
Set-Location $projectRoot
npx hardhat run scripts/deploy.js --network localhost

Write-Host ""
Write-Host "[3/3] Starting React Web3 Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\frontend'; npm run dev"

Write-Host "Waiting 3 seconds for Vite server..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host "Opening PharmaChain in your browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  PharmaChain is live!" -ForegroundColor Green
Write-Host "  - EVM JSON-RPC: http://127.0.0.1:8545 (Chain ID 31337)" -ForegroundColor White
Write-Host "  - Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green
