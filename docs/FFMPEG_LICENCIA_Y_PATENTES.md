# Análisis Legal, Licencias y Patentes de FFmpeg como Sidecar

Este documento detalla la arquitectura de integración de FFmpeg en **Tachyon Studio Desktop**, el análisis de sus licencias (LGPL vs. GPL) y las implicaciones sobre patentes de códecs de vídeo y audio (H.264, H.265/HEVC, AAC).

---

## 1. Arquitectura de Integración: Sidecar Aislado (Proceso Externo)

En Tachyon Studio Desktop, FFmpeg **NO** se enlaza estática ni dinámicamente con el ejecutable nativo en Rust ni con el frontend TypeScript:

```
+--------------------------------------------------------------+
|                   Tachyon Studio Desktop                     |
|  - Frontend: React 19 / TypeScript (código propio)           |
|  - Backend: Tauri 2 / Rust (código propio)                   |
|  - Motor de renderizado: Canvas2D + WebCodecs (Mediabunny)   |
+--------------------------------------------------------------+
                               |
                   Llamada IPC / Subproceso
                     (std::process::Command)
                               |
                               v
+--------------------------------------------------------------+
|             Proceso Externo Independiente (Sidecar)          |
|                       ffmpeg.exe                             |
+--------------------------------------------------------------+
```

### Razones Técnicas y Legales del Enfoque Sidecar:
1. **Aislamiento de Licencia (Arm's Length Process):**
   Al comunicarse exclusivamente mediante paso de argumentos de línea de comandos, pipes estándar de entrada/salida (`stdin`/`stdout`/`stderr`) o archivos en disco, el ejecutable de Tachyon Studio y FFmpeg constituyen **dos programas independientes** según las directrices de la *Free Software Foundation (FSF)*.
2. **Sin "Efecto Viral" de la GPL:**
   El código fuente de Tachyon Studio no se convierte en una obra derivada de FFmpeg ni queda sujeto a la GPL.
3. **Flexibilidad de despliegue:**
   Tachyon Studio puede ejecutarse al 100% de su capacidad sin FFmpeg gracias a WebCodecs y Mediabunny. FFmpeg actúa únicamente como un acelerador opcional de hardware (NVENC, QuickSync, AMF) o remuxer secundario.

---

## 2. Régimen de Licencias de FFmpeg

FFmpeg se distribuye bajo dos esquemas principales dependiendo de las banderas de compilación utilizadas:

### A. FFmpeg LGPL v2.1+ (Versión Estándar)
- **Componentes incluidos:** Decodificadores y demuxers nativos de FFmpeg, filtros, aceleración por hardware del sistema operativo y vendors (NVIDIA NVENC, Intel QSV, AMD AMF vía MediaFoundation / DirectX).
- **Características:** No incluye librerías con licencia GPL estricta.
- **Distribución:** Se puede distribuir junto a aplicaciones comerciales o de código cerrado siempre que el binario de FFmpeg no haya sido alterado o se proporcionen los scripts para reconstruirlo.

### B. FFmpeg GPL v2 / v3 (Versiones con librerías externas)
- Si FFmpeg se compila con `--enable-gpl` o `--enable-version3`, activando librerías externas como `libx264` (x264) o `libx265` (x265), **todo el binario de FFmpeg pasa a regirse por la GPL**.
- **Impacto con modelo Sidecar:** Aunque el binario de FFmpeg sea GPL, ejecutarlo como subproceso externo no contamina a Tachyon Studio. Sin embargo, quien redistribuya ese binario compilado de FFmpeg debe proporcionar el código fuente correspondiente de FFmpeg y sus parches.

---

## 3. Patentes de Software y Códecs Multimedia

El aspecto más crítico en la distribución comercial o masiva de herramientas de vídeo no es la licencia de código abierto, sino las **patentes esenciales de estándares (SEPs)** gestionadas por consorcios de patentes:

### A. H.264 / AVC (MPEG LA / Via Licensing Alliance)
- La especificación H.264 está cubierta por patentes esenciales de telecomunicaciones y compresión.
- **Uso de WebCodecs / MediaFoundation (Pipeline por defecto de Tachyon Studio):**
  Al utilizar las APIs del sistema operativo (WebView2, WebCodecs, MediaFoundation), las regalías de patente del codificador/decodificador ya han sido satisfechas por el fabricante del hardware (GPU) o por Microsoft en la licencia de Windows.
- **Uso de FFmpeg con `h264_nvenc` / `h264_qsv` / `h264_amf`:**
  Los bloques NVENC, QSV y AMF residen físicamente en el silicio de la GPU (NVIDIA, Intel, AMD). El driver del fabricante proporciona el acceso y las licencias asociadas al hardware.
- **Uso de `libx264` (Codificador por software CPU):**
  Distribuir binarios comerciales con `libx264` activado puede requerir licencias de regalía con MPEG LA si se superan determinados volúmenes anuales de distribución en jurisdicciones con patentes de software (como EE.UU.).

### B. AAC (Advanced Audio Coding - Via LA)
- La transmisión o passthrough sin recodificación (que es lo que hace Tachyon Studio al copiar los paquetes AAC intactos desde el vídeo original) no requiere licencias de codificación AAC.

---

## 4. Política y Recomendación de Distribución de Tachyon Studio

Para evitar contingencias de patentes y garantizar el cumplimiento estricto de licencias:

1. **El instalador de Tachyon Studio NO empaqueta de forma predeterminada binarios de FFmpeg GPL:**
   - La aplicación funciona de manera autónoma, rápida y con memoria acotada utilizando el pipeline WebCodecs + Mediabunny.
2. **Detección Dinámica (*BYOB - Bring Your Own Binary*):**
   - Tachyon Studio detecta automáticamente si el usuario tiene FFmpeg instalado en su sistema (vía WinGet, Chocolatey, Scoop o PATH de Windows).
   - Si está presente, habilita de inmediato la aceleración GPU por hardware sin complicaciones legales para el distribuidor de Tachyon Studio.
3. **Distribución Opcional de Sidecar:**
   - Si se decidiera empaquetar un binario en el futuro, se recomienda compilar una versión **LGPL estricta** de FFmpeg (sin `libx264`/`libx265`), habilitando únicamente los wrappers de aceleración por hardware (`--enable-nvenc --enable-amf --enable-libvpl --enable-mediafoundation`).
