@echo off
title iPos 4.0 Modern Enterprise Launcher
color 0A
cls
echo ==============================================================================
echo                 iPos 4.0 MODERN ENTERPRISE PLATFORM
echo            PostgreSQL 8.4 Integration - CV. Baruna Artha Lestari
echo ==============================================================================
echo.

cd /d "%~dp0"

echo [*] Memeriksa instalasi runtime Bun...
where bun >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] PERINGATAN: Bun runtime tidak ditemukan di PATH sistem.
    echo     Pastikan Bun telah terpasang (https://bun.sh).
    pause
    exit /b 1
)
echo [OK] Bun runtime terdeteksi.

echo.
echo [*] Memulai REST API Backend (Port 3001)...
start "iPos 4.0 - Backend REST API (Port 3001)" /min cmd /c "cd /d ""%~dp0backend"" && bun run dev"

echo [*] Memulai Next.js Enterprise Frontend (Port 3000)...
start "iPos 4.0 - Frontend Web UI (Port 3000)" /min cmd /c "cd /d ""%~dp0frontend"" && bun run dev"

echo.
echo [*] Menunggu server siap...
timeout /t 3 /nobreak >nul

echo [*] Membuka antarmuka aplikasi di web browser...
start http://localhost:3000/pos

echo.
echo ==============================================================================
echo [SUKSES] Seluruh layanan iPos 4.0 Modern Enterprise telah aktif!
echo.
echo   - Web POS Kasir        : http://localhost:3000/pos
echo   - Dashboard Eksekutif  : http://localhost:3000/admin/dashboard
echo   - Denah Visual WMS     : http://localhost:3000/admin/wms/layout
echo   - WMS Scanner PDA/HP   : http://localhost:3000/wms/scanner
echo   - REST API Engine      : http://localhost:3001/api/system/health
echo ==============================================================================
echo.
echo Jendela ini dapat ditutup dengan aman. Layanan berjalan di latar belakang.
pause >nul
