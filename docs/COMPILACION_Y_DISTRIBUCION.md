# Guía de Compilación y Distribución — Tachyon Studio Desktop

Esta guía documenta los pasos y requisitos para compilar y empaquetar **Tachyon Studio Desktop** (Tauri 2 + Rust + React/TypeScript) en Windows, generando el ejecutable nativo optimizado y el instalador NSIS.

---

## 1. Requisitos del Entorno

1. **Node.js:** Versión 18+ (probado con v26.12.0) y `npm`.
2. **Rust & Cargo:** Versión 1.80+ (probado con `rustc 1.99.1`).
   - El directorio `%USERPROFILE%\.cargo\bin` debe estar en el PATH.
3. **C++ Build Tools:** Visual Studio C++ Build Tools 2022 con el SDK de Windows 10/11 (MSVC `x86_64-pc-windows-msvc`).
4. **WebView2 Runtime:** Incluido por defecto en Windows 10 y Windows 11.

---

## 2. Configuración de la Aplicación y Ventana (`src-tauri/tauri.conf.json`)

- **Título de la ventana:** `Tachyon Studio`
- **Dimensiones por defecto:** 1440 x 900 px (centrada automáticamente).
- **Dimensiones mínimas:** 1024 x 680 px (garantiza visualización adecuada de los paneles de telemetría y canvas).
- **Tema:** Oscuro forzado (`theme: "Dark"`), con color de fondo del marco `#090C0E` para evitar parpadeos blancos durante el inicio.
- **Iconos:** Generados a partir de `public/logo.png` con la suite completa de resoluciones (desde 32x32 hasta 512x512, `.ico` multitamaño para Windows y `.icns` para macOS).

---

## 3. Scripts de Compilación

### A. Modo Desarrollo
Inicia Vite con HMR y la ventana nativa de Tauri:
```powershell
npm run tauri:dev
```

### B. Ejecutar Suite de Tests
Ejecuta las pruebas unitarias y de integración de Vitest (45 tests):
```powershell
npm test
```

### C. Generación Rápida del Instalador (PowerShell)
Se incluye el script automatizado [`scripts/build-installer.ps1`](file:///c:/Proyectos%20VSC/Telemetria/Tachyon-Studio-Rust/scripts/build-installer.ps1), que valida herramientas, ejecuta tests, compila el bundle de Vite y genera el instalador NSIS:

```powershell
# Compilacion completa con verificacion de tests
powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1

# Compilacion directa saltando tests
powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1 -SkipTests
```

### D. Mediante comandos npm
```powershell
npm run build:installer
```

---

## 4. Artefactos de Salida Generados

| Artefacto | Ubicación | Tamaño Aprox. | Propósito |
| :--- | :--- | :--- | :--- |
| **Ejecutable Portable** | `src-tauri/target/release/tachyon-studio.exe` | ~12.3 MB | Binario optimizado sin instalador, listo para ejecutar. |
| **Instalador NSIS** | `src-tauri/target/release/bundle/nsis/Tachyon Studio_0.1.0_x64-setup.exe` | ~4.84 MB | Instalador guiado en español e inglés para usuario actual (sin requerir privilegios de administrador). |

---

## 5. Parámetros del Instalador NSIS

- **Modo de Instalación:** `currentUser` (instala en `%LOCALAPPDATA%\Programs\Tachyon Studio` sin necesidad de elevación UAC de administrador).
- **Idiomas incluidos:** Español e Inglés.
- **Acceso directo:** Crea acceso directo en el Menú Inicio (`Tachyon Studio`) y en el Escritorio con el icono de la aplicación.
