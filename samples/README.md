# Directorio de Muestras y Sesiones de Telemetría (Samples)

Este directorio contiene sesiones de prueba para los tests automatizados y el desarrollo local de Tachyon Studio.

## Estructura

```
samples/
├── sesion_sintetica_prueba.zip     <- Sesión sintética oficial versionada en Git
├── README.md                       <- Esta documentación
└── real/                           <- IGNORADO POR GIT (Datos personales/reales)
    └── sesion_real_android.zip     <- (Opcional) Tu sesión real exportada desde Tachyon
```

## Pruebas con Sesión Real Local

Por motivos de privacidad y protección de datos personales (coordenadas GPS de domicilios y grabaciones de vídeo), los archivos reales **nunca deben versionarse en Git**.

Si deseas ejecutar la suite de pruebas contra una exportación real de la aplicación Android:
1. Conecta tu teléfono o descarga el archivo `.zip` exportado por la app Tachyon.
2. Crea la carpeta `samples/real/` (si no existe).
3. Renombra o copia tu archivo como `samples/real/sesion_real_android.zip`.
4. Ejecuta `npm test tests/real-session.test.ts`.

La regla `samples/real/` en `.gitignore` garantiza que tus grabaciones y datos GPS privados nunca se subirán al repositorio público.
