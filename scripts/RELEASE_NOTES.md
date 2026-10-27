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
