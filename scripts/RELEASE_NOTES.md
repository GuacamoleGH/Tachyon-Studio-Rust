## 🏎️ Tachyon Studio Desktop v2.5 PC

Esta versión introduce grandes mejoras de productividad en el **Editor de Plantillas de Telemetría**, selección múltiple con arrastre simultáneo, ajuste pixel a pixel con el teclado, filtrado y categorización inteligente de widgets, corrección visual en el widget de aceleración IMU 3D y un **Minimapa GPS ultra-fluido a 60 FPS**.

### 📦 Archivos Disponibles para Descarga:
* **`Tachyon-Studio-v2.5.0-Setup.exe`**: Instalador oficial para Windows con asistente de instalación paso a paso, icono en el Escritorio y registro en el Menú Inicio de Windows.
* **`Tachyon-Studio-v2.5.0-Portable.zip`**: Versión portable lista para usar. Descomprimir y hacer doble clic en `tachyon-studio.exe` sin necesidad de instalación previa.
* **`Tachyon-Studio-v2.5.0.exe`**: Ejecutable autónomo directo sin dependencias externas.

---

### ✨ Novedades y Mejoras en v2.5 PC:

1. **Selección Múltiple con Ctrl / Cmd en el Editor de Plantillas**:
   - Mantén pulsada la tecla `Ctrl` (o `Cmd` en macOS) para seleccionar múltiples capas o widgets tanto haciendo clic directamente en el lienzo como en la lista de capas izquierda.
   - Arrastra cualquiera de los widgets seleccionados y todo el grupo se moverá en bloque de forma simultánea, respetando sus posiciones relativas y los límites de la resolución del lienzo.
   - Panel de propiedades dinámico con contador de elementos seleccionados y botón de eliminación en lote.

2. **Ajuste Fino Pixel a Pixel con las Flechas del Teclado**:
   - Mueve cualquier widget o grupo de widgets seleccionados con precisión absoluta mediante las teclas de dirección (`←`, `↑`, `→`, `↓`).
   - Movimiento de 1 pixel por pulsación para alineación perfecta, o de 10 píxeles manteniendo pulsado `Shift`.
   - Compatible al 100% con el historial de Deshacer (`Ctrl+Z`) y Rehacer (`Ctrl+Y`).

3. **Selector de Widgets Categorizado y con Filtro de Capas Existentes**:
   - El desplegable *"+ Añadir widget..."* ahora organiza los 24 widgets disponibles en 5 categorías claras:
     - 🏎️ *Tacómetros y Régimen (RPM)*
     - ⚡ *Velocidad, Marchas y Pedales*
     - 🔧 *Diagnosis Motor y Eficiencia OBD-II*
     - 🎯 *Dinámica del Chasis y Fuerzas G*
     - 🗺️ *Navegación Satelital y Tiempo*
   - **Filtro automático**: Los widgets que ya están añadidos a tu plantilla se ocultan automáticamente del menú desplegable para no duplicar capas ni saturar la vista.

4. **Corrección Visual en el Widget IMU 3D (`imu_raw`)**:
   - Solucionado el solapamiento visual entre la barra horizontal centrada en 0 y el valor numérico en m/s².
   - Separación geométrica estricta de las columnas de etiqueta, número y barra de aceleración.

5. **Minimapa GPS Ultra-Fluido (Sin Tirones ni Micro-Stuttering)**:
   - Implementado un suavizador cinemático exponencial (EMA) para la posición del vehículo y el ángulo de rumbo (heading), transformando las señales GPS discretas de 1 Hz, 5 Hz o 10 Hz (de cámaras GoPro, móviles o receptores GNSS) en una animación suave como la seda a 60 FPS.
   - Corregido el algoritmo de culling perimetral para evitar saltos o líneas que cruzaban la pantalla cuando los puntos del circuito entraban y salían del radio del minimapa.

6. **Telemetría a 60 FPS Continuos (Tacómetro, Velocímetro y Marchas)**:
   - Nuevo bucle de sincronización con micro-interpolación sub-frame mediante `requestAnimationFrame`: el tacómetro, el velocímetro digital y las barras de cambio se mueven a la tasa de refresco completa del monitor (60 Hz / 120 Hz / 144 Hz) independientemente de los FPS del vídeo.
   - Eliminado el filtro artificial de retardo en la velocidad, respondiendo inmediatamente a la telemetría a alta frecuencia (hasta 10 Hz OBD y GNSS).
   - Interpolación por pasos discretos (`step`) en el indicador de marchas para cambios limpios e instantáneos.

7. **Herramienta de Unión de Capítulos GoPro (Lossless) y Reproducción Local**:
   - Detección y ordenación automática de secuencias GoPro (`GOPR` + `GP01`, `GP02`...).
   - Vinculación automática directa al reproductor de telemetría al finalizar la unión.
   - Optimización de copiado directo sin recodificación ni reescritura pesada de cabeceras, acelerando drásticamente el proceso en tarjetas microSD y discos externos.
   - Soporte total del protocolo local `http://asset.localhost` en la directiva de seguridad CSP para reproducir vídeos de cualquier tamaño y procedencia sin bloqueos del sistema.

8. **Modo Portable y Optimización de Tamaño**:
   - Ejecutable autónomo directo de solo 6 MB (`Tachyon-Studio.exe`) sin necesidad de instalación.
   - Instalador NSIS oficial de tan solo 4.1 MB.
   - Optimización de los perfiles de desarrollo y producción para evitar la acumulación excesiva de caché en disco.

9. **Ajuste Interactivo de Sincronización Telemetría ↔ Vídeo (GPS / OBD)**:
   - Nuevo control interactivo en la barra superior del reproductor con botones rápidos (`-1s`, `-0.1s`, `+0.1s`, `+1s`, entrada numérica directa y `Reset`).
   - Atajos de teclado rápidos: pulsa `[` para retrasar la telemetría `-0.1s` (o `Shift+[` para `-1s`) y `]` para adelantarla `+0.1s` (o `Shift+]` para `+1s`).
   - **Previsualización instantánea incluso en pausa**: perfecto para pausar el vídeo justo al pasar por una referencia física clara (como una rotonda, cruce o curva) y ajustar la sincronización viendo cómo el icono del vehículo en el minimapa y los relojes se desplazan en tiempo real hasta alinearse al milímetro con lo que ves en el vídeo.
   - La compensación de sincronización (`syncOffsetSec`) se guarda en la sesión y se aplica automáticamente tanto en la reproducción como en el motor de exportación de vídeo (Render).
