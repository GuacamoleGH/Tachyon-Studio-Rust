@echo off
setlocal
title Tachyon Studio - Servidor de Desarrollo con Logs en Vivo

echo ==============================================================================
echo             TACHYON STUDIO - MODO DESARROLLO (LOGS Y RECARGA EN VIVO)
echo ==============================================================================
echo.
echo [*] Configurando entorno de ejecucion...
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

cd /d "%~dp0"

echo [*] Iniciando servidor Vite + ventana nativa Tauri...
echo [*] Los registros y errores de consola apareceran en esta ventana en tiempo real.
echo.

call npm.cmd run tauri:dev

if errorlevel 1 (
    echo.
    echo [ERROR] Se detuvo la ejecucion con errores.
    pause
)
