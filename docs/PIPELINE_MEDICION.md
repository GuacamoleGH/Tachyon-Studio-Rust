# Pipeline de Vídeo con Memoria Acotada (Fase F2)

Este documento detalla la arquitectura del nuevo pipeline de exportación y decodificación de vídeo con **Mediabunny** y **WebCodecs**, la verificación determinista de fotogramas, la preservación de audio y las instrucciones para reproducir las mediciones de memoria.

---

## 1. Problemas Resueltos del Pipeline Previo

| Problema Previo | Diagnóstico | Solución Implementada (Fase F2) |
|---|---|---|
| **Consumo desmedido de RAM** | `mp4-muxer` con `fastStart: 'in-memory'` retenía todas las muestras de vídeo en memoria hasta el `finalize()`. | Migración a Mediabunny con `Mp4OutputFormat({ fastStart: false })` y `StreamTarget`, emitiendo fragmentos en streaming directo sin acumulación en RAM. |
| **Fotogramas incorrectos o desincronizados** | `<video>` oculto con `seekVideoTo` por cada cuadro y timeout arbitrario de 250 ms que saltaba sin confirmar fotograma. | Decodificación secuencial determinista con `VideoSampleSink` de WebCodecs. Verificación estricta de timestamp: si el fotograma no cubre el instante $t \pm \epsilon$, se rechaza con error explícito. |
| **Audio original ausente** | El multiplexor solo registraba la pista de vídeo; el audio original se descartaba por completo. | Extracción de paquetes de audio con `EncodedPacketSink` y multiplexación directa con `EncodedAudioPacketSource` (**AAC Passthrough** sin recodificación, con fidelidad 100% y cero sobrecoste de CPU). |
| **Contrapresión débil** | `if (videoEncoder.encodeQueueSize > 4) setTimeout(10)` permitía saturar la GPU. | `CanvasSource.add()` de Mediabunny aplica contrapresión automática esperando a que el codificador y el target de salida hayan procesado la muestra. Cierre forzoso de muestras con `sample.close()`. |

---

## 2. Generación del Vídeo de Prueba Sintético (4.5 GB)

Para probar la decodificación y exportación con un fichero de gran tamaño y verificar visualmente la sincronía cuadro a cuadro, genera el vídeo de 30 minutos a 20 Mbps con contador de tiempo en pantalla:

```bash
ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30 -vf "drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='TIME %{pts\:hms} FRAME %{frame_num}':x=60:y=60:fontsize=48:fontcolor=white:box=1:boxcolor=black@0.8" -f lavfi -i sine=frequency=220 -t 1800 -c:v libx264 -b:v 20M -pix_fmt yuv420p -c:a aac big_test.mp4
```

> **Nota:** Este comando genera un archivo MP4 estándar de ~4.5 GB con una pista de vídeo H.264 1080p@30fps con código de tiempo grabado y una pista de audio AAC a 220 Hz. El archivo `big_test.mp4` está ignorado por `.gitignore`.

---

## 3. Protocolo de Medición de Memoria

Para monitorear el consumo de memoria real durante el renderizado:

1. Abre un terminal de PowerShell y ejecuta el monitor de memoria:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\measure-memory.ps1
   ```
2. Inicia Tachyon Studio:
   ```bash
   npm run tauri dev
   ```
3. Carga la sesión y el vídeo, pulsa en **Exportar Vídeo** seleccionando el modo **Vídeo MP4 Combinado**.
4. El script registrará cada segundo el consumo `WorkingSet64` y `PrivateMemorySize64` de `tachyon-studio.exe` y de los procesos de WebView2 (`msedgewebview2.exe`), calculando el pico máximo.

---

## 4. Tabla de Comparación de Rendimiento y Mediciones

> **Nota sobre el estado de las mediciones:** Siguiendo la política de rigor técnico, se distingue estrictamente entre lo *implementado*, lo *probado con datos sintéticos en tests* y lo *medido físicamente en la máquina local*. Debido a que el entorno de desarrollo automatizado carece de sesión interactiva de GPU/WebView2 para renderizar interactivamente el vídeo de 4.5 GB, los valores de pico de memoria real quedan marcados como **NO MEDIDO** hasta que ejecutes el protocolo descrito en la sección 3 en tu entorno.

| Métrica | Pipeline Web Anterior (F0) | Pipeline Optimizado (F2) | Estado y Evidencia |
|---|---|---|---|
| **RAM en reposo (Idle)** | [NO MEDIDO] | [NO MEDIDO] | Pendiente de medición con `measure-memory.ps1` |
| **RAM pico `tachyon-studio.exe` (Vídeo 4.5 GB, 30 min)** | N/A (era aplicación web pura) | [NO MEDIDO] | Pendiente de medición local por el usuario |
| **RAM pico `msedgewebview2.exe` (Vídeo 4.5 GB, 30 min)** | > 2.5 GB (Crash / OOM de V8 en navegador) | [NO MEDIDO] | Pendiente de medición local por el usuario |
| **RAM pico combinada total** | Crash / Desbordamiento de memoria | [NO MEDIDO] | Pendiente de medición local por el usuario |
| **Transferencia IPC de datos** | Listas JSON de enteros en RAM | Binario raw con `tauri::ipc::Response` y `Request` | Implementado y verificado en tests unitarios |
| **Pista de Audio en MP4** | ❌ Ninguna (Vídeo mudo sin aviso) | ✅ **AAC Passthrough con advertencias visibles** | Implementado con `EncodedAudioPacketSource` y alertas UI |
| **Garantía de cuadro exacto** | ❌ No (Timeout 250 ms causaba cuadros congelados) | ✅ **Determinista garantizado** (Error explícito si no coincide) | 69/69 Tests Vitest + 8/8 Tests Rust (77 tests superados) |
| **Contrapresión de Codificación** | `if` simple de 10 ms | Promesa nativa en `CanvasSource.add()` | Implementado y verificado |
| **Vídeo STORED en ZIP** | Extraía innecesariamente a `%TEMP%` | ✅ **Lectura directa por rangos sin extraer** | Implementado y probado con tests de integración |
| **Vídeo suelto externo** | No soportado | ✅ **Detección automática en carpeta de sesión** | Implementado y probado en tests |

---

## 5. Procedimiento Paso a Paso para Registrar tus Mediciones Reales

Sigue estos pasos en tu máquina para completar la tabla superior con las cifras reales:

1. **Genera el vídeo sintético de 4.5 GB** (en la raíz de `Tachyon-Studio-Rust`):
   ```powershell
   ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30 -vf "drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='TIME %{pts\:hms} FRAME %{frame_num}':x=60:y=60:fontsize=48:fontcolor=white:box=1:boxcolor=black@0.8" -f lavfi -i sine=frequency=220 -t 1800 -c:v libx264 -b:v 20M -pix_fmt yuv420p -c:a aac big_test.mp4
   ```
2. **Abre un terminal de PowerShell (Terminal A)** y lanza el monitor:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\measure-memory.ps1
   ```
3. **Abre un segundo terminal (Terminal B)** e inicia Tachyon Studio:
   ```powershell
   npm.cmd run tauri dev
   ```
4. En la interfaz gráfica de Tachyon Studio:
   - Carga la sesión de telemetría (o la muestra sintética desde la barra superior).
   - Haz clic en **Vincular Vídeo MP4** y selecciona `big_test.mp4`.
   - Abre la pestaña **Exportar Vídeo** y pulsa **Iniciar Renderizado** (modo Vídeo MP4 Combinado).
5. Observa el Terminal A: registrará el pico de memoria `WorkingSet64` y `PrivateMemorySize64` de `tachyon-studio.exe` y de las instancias de `msedgewebview2.exe`.
6. Al finalizar el renderizado o detener el script, copia los valores de **PICO** en la tabla superior sustituyendo las marcas `[NO MEDIDO]`.
