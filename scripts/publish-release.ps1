# Script para publicar Release oficial en GitHub con instalador y portable
$ErrorActionPreference = "Stop"

$repo = "GuacamoleGH/Tachyon-Studio-Rust"
$tag = "v2.5.0"
$title = "Tachyon Studio v2.5 PC"
$body = @"
## 🏎️ Tachyon Studio Desktop v2.2 PC

Esta versión añade soporte nativo completo para todos los parámetros de telemetría y diagnosis del motor de la aplicación móvil Tachyon (documentados en el diccionario de datos oficial).

### 📦 Archivos Disponibles para Descarga:
* **`Tachyon-Studio-v2.2.0-Setup.exe`**: Instalador oficial para Windows con asistente de instalación paso a paso, icono en el Escritorio y registro en el Menú Inicio de Windows.
* **`Tachyon-Studio-v2.2.0-Portable.zip`**: Versión portable lista para usar. Descomprimir y hacer doble clic en `tachyon-studio.exe` sin necesidad de instalación previa.
* **`Tachyon-Studio-v2.2.0.exe`**: Ejecutable autónomo directo de 12 MB.

---

### ✨ Novedades y Mejoras en v2.2 PC:
* **Presión de Sobrealimentación (Turbo / Boost)**: Manómetro digital con lectura de bares/PSI, arco dinámico y niveles de vacío y sobrepresión.
* **Consumo Instantáneo (L/100km / MPG)**: Widget de eficiencia de combustible con barras dinámicas.
* **Temperatura de Aire de Admisión (IAT)**: Monitor térmico de admisión tras intercooler (°C / °F).
* **Dinámica Inercial 3D (IMU)**: Aceleraciones brutas en los 3 ejes X, Y y Z en m/s² para análisis del sensor inercial.
* **Precisión Satelital GNSS / GPS**: Gráfico de cobertura satelital de 4 barras e incertidumbre estimada en metros.
* **Lectura Directa de Marcha de Transmisión**: Soporte para marcha atrás (`R`), punto muerto (`N`) y marchas `1` a `8`.
* **Nueva Plantilla Oficial**: Disposición *⚡ Turbo & Diagnosis OBD-II Pro*.
* **Editor de Vídeo & Exportación**:
  - Botones *"Establecer Inicio"* y *"Establecer Fin"* con tramo resaltado visualmente en la barra de tiempo.
  - Soporte de minutos y segundos (`mm:ss`) para recorte de exportación.
  - Sanitización automática de nombres de archivo de vídeo en Windows (corrección de dos puntos y barras de fecha).
"@

# 1. Leer el markdown de notas de versión en UTF8 puro
$notesPath = Join-Path $PSScriptRoot "RELEASE_NOTES.md"
if (Test-Path $notesPath) {
    $body = [System.IO.File]::ReadAllText($notesPath, [System.Text.Encoding]::UTF8)
} else {
    $body = "Release $tag"
}

# 2. Obtener Token de Git Credential Manager
$credOutput = "protocol=https`nhost=github.com" | git credential fill
$tokenLine = ($credOutput | Select-String "password=").Line
if (-not $tokenLine) {
    throw "No se pudo obtener el token de Git Credential Manager."
}
$token = $tokenLine.Replace("password=", "").Trim()
$headers = @{
    "Authorization" = "token $token"
    "User-Agent" = "Tachyon-Studio-Publisher"
    "Accept" = "application/vnd.github.v3+json"
}

Write-Host "Creando release $tag en GitHub ($repo)..." -ForegroundColor Cyan

# 2. Comprobar si ya existe la release
$release = $null
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/$tag" -Headers $headers -Method Get
    Write-Host "Release existente encontrada (ID: $($release.id))." -ForegroundColor Yellow
} catch {
    Write-Host "Creando nueva release..." -ForegroundColor Yellow
    $payload = @{
        tag_name = $tag
        target_commitish = "main"
        name = $title
        body = $body
        draft = $false
        prerelease = $false
    } | ConvertTo-Json
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)

    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -ContentType "application/json; charset=utf-8" -Body $bodyBytes
    Write-Host "¡Release creada con éxito! (ID: $($release.id))" -ForegroundColor Green
}

$uploadUrlBase = $release.upload_url.Split('{')[0]

# 3. Función para subir archivos binarios
function Upload-Asset($filePath, $assetName) {
    if (-not (Test-Path $filePath)) {
        Write-Warning "Archivo no encontrado: $filePath"
        return
    }

    Write-Host "`nSubiendo asset: $assetName..." -ForegroundColor Cyan
    
    # Comprobar si el asset ya existe en la release para borrarlo si procede
    $existing = $release.assets | Where-Object { $_.name -eq $assetName }
    if ($existing) {
        Write-Host "Asset existente detectado, eliminando version previa..." -ForegroundColor Gray
        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($existing.id)" -Headers $headers -Method Delete
    }

    $uri = "$uploadUrlBase`?name=$assetName"
    $bytes = [System.IO.File]::ReadAllBytes($filePath)

    $uploadHeaders = @{
        "Authorization" = "token $token"
        "User-Agent" = "Tachyon-Studio-Publisher"
        "Content-Type" = "application/octet-stream"
    }

    $uploaded = Invoke-RestMethod -Uri $uri -Headers $uploadHeaders -Method Post -Body $bytes
    $sizeMb = [Math]::Round($bytes.Length / 1MB, 2)
    Write-Host "[OK] $assetName subido con exito ($sizeMb MB)." -ForegroundColor Green
}

# 4. Subir Instalador y Portable
$ver = $tag.TrimStart('v')
$installerPath = "src-tauri/target/release/bundle/nsis/Tachyon Studio_${ver}_x64-setup.exe"
$portableZipPath = "src-tauri/target/release/Tachyon_Studio_v${ver}_PC_Portable.zip"
$portableExePath = "src-tauri/target/release/tachyon-studio.exe"

# Empaquetar versión portable en ZIP
if (Test-Path $portableExePath) {
    if (Test-Path $portableZipPath) { Remove-Item $portableZipPath -Force }
    Write-Host "Empaquetando ejecutable portable en $portableZipPath..." -ForegroundColor Cyan
    Compress-Archive -Path $portableExePath -DestinationPath $portableZipPath -Force
}

Upload-Asset -filePath $installerPath -assetName "Tachyon-Studio-v${ver}-Setup.exe"
Upload-Asset -filePath $portableZipPath -assetName "Tachyon-Studio-v${ver}-Portable.zip"
Upload-Asset -filePath $portableExePath -assetName "Tachyon-Studio-v${ver}.exe"

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "   ¡Release $tag publicada exitosamente en GitHub Releases!" -ForegroundColor Green
Write-Host "   URL: $($release.html_url)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Green
