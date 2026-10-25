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

set "EXE_PATH=%~dp0src-tauri\target\release\tachyon-studio.exe"

if not exist "!EXE_PATH!" (
    echo [!] No se encontro el archivo ejecutable en:
    echo     !EXE_PATH!
    echo.
    echo [*] Compilando el ejecutable portable por primera vez...
    call "%~dp0scripts\build-installer.ps1" -SkipTests
    if errorlevel 1 (
        echo.
        echo [ERROR] No se pudo compilar el ejecutable. Revisa los mensajes de arriba.
        pause
        exit /b 1
    )
)

echo [*] Lanzando aplicacion...
start "" "!EXE_PATH!"

echo [OK] Aplicacion lanzada con exito. Esta ventana se cerrara en 5 segundos...
timeout /t 5 >nul
exit /b 0
