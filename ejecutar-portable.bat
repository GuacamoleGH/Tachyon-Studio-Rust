@echo off
setlocal enabledelayedexpansion
title Tachyon Studio - Modo Portable (Sin Instalacion)

echo ==============================================================================
echo                      TACHYON STUDIO - MODO PORTABLE
echo ==============================================================================
echo.
echo [*] Iniciando Tachyon Studio directamente desde el ejecutable optimizado...
echo [*] NOTA PARA PRUEBAS: 
echo     - Puedes presionar F12 o hacer clic derecho -^> "Inspeccionar" dentro de 
echo       la aplicacion para abrir la Consola de Desarrollador y ver errores.
echo.

set "EXE_PATH=%~dp0Tachyon-Studio.exe"
if not exist "!EXE_PATH!" (
    set "EXE_PATH=%~dp0src-tauri\target\release\tachyon-studio.exe"
)

if not exist "!EXE_PATH!" (
    echo [!] No se encontro el ejecutable precompilado.
    echo [*] Compilando el ejecutable portable optimizado por primera vez...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-installer.ps1" -SkipTests
    if errorlevel 1 (
        echo.
        echo [ERROR] No se pudo compilar el ejecutable. Revisa los mensajes de arriba.
        pause
        exit /b 1
    )
    if exist "%~dp0src-tauri\target\release\tachyon-studio.exe" (
        copy /y "%~dp0src-tauri\target\release\tachyon-studio.exe" "%~dp0Tachyon-Studio.exe" >nul
        set "EXE_PATH=%~dp0Tachyon-Studio.exe"
    )
)

echo [*] Lanzando aplicacion...
start "" "!EXE_PATH!"

echo [OK] Aplicacion lanzada con exito. Esta ventana se cerrara en 3 segundos...
timeout /t 3 >nul
exit /b 0
