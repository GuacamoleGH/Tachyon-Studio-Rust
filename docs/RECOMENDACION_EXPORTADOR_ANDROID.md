# Recomendaciones Técnicas para el Exportador Android (Tachyon)

Este documento detalla el análisis del módulo de exportación de la app Android (`Tachyon\app\src\main\java\com\telemetria\app\core\export\ZipSessionExporter.kt`) y las mejoras recomendadas para optimizar la exportación, ahorrar batería y permitir un acceso por streaming instantáneo y de memoria acotada desde **Tachyon Studio Desktop**.

> [!IMPORTANT]
> **Estado de los archivos de Android:** Este documento es exclusivamente informativo y de propuesta técnica. La carpeta `..\Tachyon\` permanece intacta y en modo solo lectura.

---

## 1. Diagnóstico del Estado Actual en Android

En `ZipSessionExporter.kt` (líneas 121-133):

```kotlin
private fun addFileToZip(zos: ZipOutputStream, file: File, entryName: String) {
    if (!file.exists()) return
    val entry = ZipEntry(entryName)
    zos.putNextEntry(entry)
    BufferedInputStream(FileInputStream(file)).use { bis ->
        val buffer = ByteArray(64 * 1024)
        var count: Int
        while (bis.read(buffer).also { count = it } != -1) {
            zos.write(buffer, 0, count)
        }
    }
    zos.closeEntry()
}
```

### Problemas identificados:
1. **Compresión ineficiente de MP4:** Al no especificar `entry.method`, `java.util.zip.ZipOutputStream` aplica por defecto compresión `ZipEntry.DEFLATED`. Un archivo de vídeo MP4 (H.264/H.265/AAC) ya es un flujo fuertemente comprimido con entropía cercana a la máxima. Comprimirlo con DEFLATE no reduce su tamaño (a menudo aumenta unos cuantos bytes) y desperdicia tiempo de CPU y batería en el smartphone.
2. **Impedimento para Range Requests directos:** Dado que los bloques DEFLATE son interdependientes, un decodificador en PC no puede realizar lecturas aleatorias por rangos de bytes (*byte-range requests*) directamente sobre el vídeo dentro del ZIP. Para leer un fotograma en el segundo 45, es necesario descomprimir linealmente todos los bytes anteriores.
3. **Pico de espacio temporal:** La aplicación de escritorio debe volcar el vídeo a `%TEMP%` antes de poder pasarlo a WebCodecs/Mediabunny si está comprimido con DEFLATE.

---

## 2. Recomendación A: Almacenar `video.mp4` como `STORED` en el ZIP (Recomendada)

Si `video.mp4` se guarda en el ZIP con método `ZipEntry.STORED` (sin compresión), los bytes del vídeo residen de forma contigua y sin alterar dentro del archivo `.zip`.

### Beneficios:
- **Exportación ultra-rápida en Android:** Copia de bytes secuencial directa sin cálculo de compresión DEFLATE. Menor consumo térmico y de batería.
- **Lectura por rangos nativa en PC:** El motor Rust de Tachyon Studio localiza el offset inicial de los datos de `video.mp4` en el ZIP mediante la cabecera local y sirve cualquier fragmento con `read_file_range` instantáneamente.
- **Cero archivos temporales en disco:** No es necesario descomprimir el vídeo en `%TEMP%`.
- **Memoria acotada (< 50 MB en PC):** Mediabunny solicita únicamente los paquetes del contenedor necesarios para cada fotograma.

### Código sugerido para Android (`ZipSessionExporter.kt`):

En Java/Android, para añadir una entrada `ZipEntry.STORED` en un `ZipOutputStream`, la especificación de `java.util.zip` exige establecer previamente el `size`, `compressedSize` y el `crc` del archivo:

```kotlin
import java.util.zip.CRC32

private fun addFileToZip(
    zos: ZipOutputStream, 
    file: File, 
    entryName: String, 
    storeUncompressed: Boolean = false
) {
    if (!file.exists()) return

    val entry = ZipEntry(entryName)
    
    if (storeUncompressed) {
        entry.method = ZipEntry.STORED
        entry.size = file.length()
        entry.compressedSize = file.length()
        
        // Calcular CRC-32 obligatorio para entradas STORED
        val crc = CRC32()
        BufferedInputStream(FileInputStream(file)).use { bis ->
            val buffer = ByteArray(128 * 1024)
            var count: Int
            while (bis.read(buffer).also { count = it } != -1) {
                crc.update(buffer, 0, count)
            }
        }
        entry.crc = crc.value
    } else {
        entry.method = ZipEntry.DEFLATED
    }

    zos.putNextEntry(entry)
    BufferedInputStream(FileInputStream(file)).use { bis ->
        val buffer = ByteArray(128 * 1024)
        var count: Int
        while (bis.read(buffer).also { count = it } != -1) {
            zos.write(buffer, 0, count)
        }
    }
    zos.closeEntry()
}
```

En la llamada principal:
```kotlin
// Los archivos de texto sí se benefician enormemente de DEFLATE (reducen ~80%)
addFileToZip(zos, csvFile, "telemetria.csv", storeUncompressed = false)
addFileToZip(zos, gpxFile, "ruta.gpx", storeUncompressed = false)
addFileToZip(zos, jsonFile, "session.json", storeUncompressed = false)
addFileToZip(zos, readmeFile, "LEEME_SINCRONIZACION.txt", storeUncompressed = false)

// El vídeo MP4 se almacena SIN compresión (STORED)
session.videoFilePath?.let { videoPath ->
    val videoFile = File(videoPath)
    if (videoFile.exists()) {
        addFileToZip(zos, videoFile, "video.mp4", storeUncompressed = true)
    }
}
```

---

## 3. Recomendación B: Exportar Carpeta de Sesión con Vídeo Suelto

Otra alternativa limpia y estándar en cámaras de acción (GoPro, Garmin VIRB, DJI) es exportar una carpeta o paquete donde el ZIP contenga únicamente la telemetría y metadatos:
- `sesion_20261025_143000.zip` (contiene `telemetria.csv`, `ruta.gpx`, `session.json`, `LEEME_SINCRONIZACION.txt`, tamaño ~50-500 KB).
- `sesion_20261025_143000.mp4` (vídeo en la misma carpeta).

Tachyon Studio ya soporta vincular un vídeo suelto desde disco mediante `openVideoDialog()` sin copiarlo ni duplicarlo.

---

## 4. Compatibilidad Actual Implementada en Tachyon Studio Desktop

Tachyon Studio Desktop ha sido diseñado en la Fase F3 con tolerancia total a ambos casos:
1. **Si el ZIP tiene `video.mp4` como `STORED`:** Rust detecta `CompressionMethod::Stored`, extrae el `data_offset` exacto del archivo y Mediabunny reproduce y renderiza por rangos de bytes directamente desde el ZIP sin temporales.
2. **Si el ZIP tiene `video.mp4` como `DEFLATED`:** Rust notifica `is_stored = false`. Tachyon Studio avisa al usuario o ejecuta `extract_zip_video_to_temp` por streaming nativo hacia `%TEMP%` con barra de progreso, evitando en todo momento alojar el archivo completo en la memoria RAM del proceso.
3. **Si el usuario vincula un MP4 externo:** Se utiliza `createTauriFileSource` con lectura por rangos nativa de 0 bytes en memoria.
