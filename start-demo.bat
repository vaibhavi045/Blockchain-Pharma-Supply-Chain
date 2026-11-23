@echo off
title PharmaChain Demo Launcher
color 0A
echo ========================================================
echo   PHARMACHAIN: BLOCKCHAIN PHARMACEUTICAL SUPPLY CHAIN
echo   Automated 1-Click Demonstration Launcher
echo ========================================================
echo.

echo [1/3] Starting Local Ethereum EVM Blockchain Node (Hardhat)...
start "Hardhat Ethereum Node [Chain ID: 31337]" cmd /k "npx hardhat node"

echo Waiting 4 seconds for Ethereum node to initialize...
timeout /t 4 /nobreak >nul

echo [2/3] Deploying PharmaSupplyChain Smart Contract & Seeding Data...
call npx hardhat run scripts/deploy.js --network localhost

echo.
echo [3/3] Starting React Web3 Frontend on http://localhost:5173...
start "PharmaChain Web3 Frontend" cmd /k "cd frontend && npm run dev"

echo Waiting 3 seconds for Vite server...
timeout /t 3 /nobreak >nul

echo Opening browser...
start http://localhost:5173

echo.
echo ========================================================
echo   SUCCESS! PharmaChain is live and running.
echo   - EVM Node RPC: http://127.0.0.1:8545 (Chain ID: 31337)
echo   - Web3 Application: http://localhost:5173
echo ========================================================
pause
