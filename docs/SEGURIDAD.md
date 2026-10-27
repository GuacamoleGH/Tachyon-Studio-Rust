# Guía de Seguridad y Gestión de Secretos

Este documento describe las políticas de seguridad, gestión de credenciales y buenas prácticas para Tachyon Studio Desktop.

---

## 1. Clave de API de CartoDB (Mapas Base)

### ⚠️ Aviso de Exposición Previa
La clave de API de CartoDB que figuraba en versiones anteriores en `src/engine/maps/MapTileManager.ts` ha quedado expuesta públicamente en el historial del repositorio.

**Acción requerida:**
1. Inicia sesión en tu cuenta de [CARTO](https://app.carto.com/).
2. Accede a la sección de **API Keys / Developers**.
3. **Revoca o elimina** la clave comprometida (`cb1_4v3w_1_...`).
4. Genera una nueva clave con permisos exclusivos de lectura de teselas raster (`rastertiles`).

### Configuración Segura de la Clave
La aplicación ahora lee la clave de forma segura mediante:

1. **Variable de entorno local (Recomendado para desarrollo/build):**
   Crea un archivo `.env.local` en la raíz de `Tachyon-Studio-Rust` (este archivo está excluido en `.gitignore`):
   ```env
   VITE_CARTO_API_KEY=tu_nueva_clave_de_carto
   ```

2. **Ajuste en almacenamiento local del navegador:**
   La aplicación permite configurar la clave mediante `localStorage.setItem('tachyon_carto_api_key', '...')`.

3. **Fallback Automático:**
   Si no se define ninguna clave, Tachyon Studio conmuta automáticamente las capas a **OpenStreetMap (OSM)**, que es un servicio 100% libre y no requiere ninguna clave API ni suscripción.

---

## 2. Publicación de Releases y Token de GitHub

El script de publicación oficial en GitHub (`scripts/publish-release.ps1`) utiliza el mecanismo nativo de **Git Credential Manager**:

- El token se recupera dinámicamente en tiempo de ejecución en memoria volátil mediante el comando del sistema `git credential fill`.
- La variable de PowerShell `$token` **nunca se imprime en pantalla (`Write-Host`) ni se escribe en archivos de registro o logs de salida**.
- No existen tokens personales de GitHub almacenados en archivos de código fuente, scripts ni configuraciones de compilación.

---

## 3. Datos Personales y Grabaciones (Samples)

- La carpeta `samples/real/` está estrictamente ignorada por Git en `.gitignore`.
- Ningún archivo de vídeo personal ni coordenadas GPS reales de usuario deben agregarse al repositorio.
- Todas las pruebas automatizadas del proyecto emplean sesiones sintéticas generadas matemáticamente con el esquema oficial de 20 columnas (`samples/sesion_sintetica_prueba.zip`).
