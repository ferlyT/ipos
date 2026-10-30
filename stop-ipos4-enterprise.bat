@echo off
title iPos 4.0 Modern Enterprise - Hentikan Layanan
color 0C
cls
echo ==============================================================================
echo                 iPos 4.0 MODERN ENTERPRISE - PENGHENTIAN LAYANAN
echo ==============================================================================
echo.

echo [*] Menghentikan proses Bun (REST API & Next.js Server)...
taskkill /F /IM bun.exe >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] Seluruh proses Bun berhasil dihentikan.
) else (
    echo [i] Tidak ada proses Bun yang sedang berjalan.
)

echo.
echo [SELESAI] Layanan iPos 4.0 Modern Enterprise telah dihentikan.
timeout /t 2 >nul
