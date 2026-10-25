# ==============================================================================
# Script de Compilación y Generación de Instalador NSIS para Tachyon Studio
# ==============================================================================

param (
    [switch]$SkipTests = $false,
    [switch]$Debug = $false
)

$ErrorActionPreference = "Stop"

# Fijar directorio de trabajo en la raiz del proyecto Tachyon-Studio-Rust
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "     Tachyon Studio Desktop - Compilacion de Release & Instalador" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Asegurar PATH para Cargo y Rust
$cargoBin = "$env:USERPROFILE\.cargo\bin"
if (Test-Path $cargoBin) {
    if ($env:PATH -notlike "*$cargoBin*") {
        $env:PATH = "$cargoBin;$env:PATH"
        Write-Host "[OK] Agregado $cargoBin al PATH de la sesion." -ForegroundColor Gray
    }
}

# 2. Verificar herramientas
Write-Host "`n[1/4] Comprobando entorno y herramientas..." -ForegroundColor Yellow
$rustVersion = rustc --version 2>$null
if (-not $rustVersion) {
    Write-Error "rustc no encontrado en PATH. Asegurate de instalar Rustup."
}
Write-Host "  - Rust: $rustVersion" -ForegroundColor Green

$nodeVersion = node --version 2>$null
Write-Host "  - Node: $nodeVersion" -ForegroundColor Green

# 3. Tests automatizados
if (-not $SkipTests) {
    Write-Host "`n[2/4] Ejecutando suite de pruebas automatizadas (Vitest)..." -ForegroundColor Yellow
    npm.cmd test
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fallo en los tests de Vitest. Abortando compilacion."
    }
    Write-Host "[OK] Todos los tests pasaron exitosamente." -ForegroundColor Green
} else {
    Write-Host "`n[2/4] Omitiendo tests (-SkipTests activado)." -ForegroundColor DarkGray
}

# 4. Compilacion Frontend
Write-Host "`n[3/4] Compilando Frontend (TypeScript + Vite)..." -ForegroundColor Yellow
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en la compilacion de frontend."
}
Write-Host "[OK] Frontend empaquetado en dist/." -ForegroundColor Green

# 5. Compilacion Tauri & Creacion de Instalador NSIS
Write-Host "`n[4/4] Compilando binario Rust y empaquetando instalador NSIS..." -ForegroundColor Yellow
$tauriArgs = @("tauri", "build")
if ($Debug) {
    $tauriArgs += "--debug"
}

npx.cmd @tauriArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en la generacion del paquete de instalador con Tauri."
}

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "     ¡Instalador y ejecutable generados con exito!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

$bundleDir = Join-Path $PSScriptRoot "..\src-tauri\target\release\bundle"
if (Test-Path $bundleDir) {
    Get-ChildItem -Path $bundleDir -Recurse -File | Where-Object { $_.Extension -in @(".exe", ".msi", ".zip") } | ForEach-Object {
        $sizeMb = [Math]::Round($_.Length / 1MB, 2)
        Write-Host ("  -> {0} ({1} MB)" -f $_.FullName, $sizeMb) -ForegroundColor Cyan
    }
}
