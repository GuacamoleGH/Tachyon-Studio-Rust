# Guía de Compilación e Instalación 🛠️

Este documento describe los requisitos del sistema, el flujo de desarrollo, la ejecución de pruebas y la generación de binarios para **Tachyon Studio Desktop (v1.3 PC)**.

---

## ⚡ Ejecución Rápida (Sin Instalación)

Si ya dispones de la versión compilada en el repositorio:
- Haz doble clic en el script **`iniciar_tachyon_directo.bat`**, o
- Ejecuta directamente el ejecutable nativo:
  ```powershell
  .\src-tauri\target\release\tachyon-studio.exe
  ```

---

## 📋 Requisitos del Sistema (Windows 10/11 x64)

Para compilar la aplicación desde el código fuente necesitas:

1. **Node.js:** Versión 18 o superior (recomendado Node 20 LTS o superior).
   - Comprobar con: `node -v` y `npm -v`
2. **Rust & Cargo:** Versión 1.80 o superior con el toolchain `stable-x86_64-pc-windows-msvc`.
   - Comprobar con: `rustc -V` y `cargo -V`
   - Instalar desde [rustup.rs](https://rustup.rs/) si no lo tienes.
3. **Visual Studio C++ Build Tools 2022:**
   - Cargas de trabajo necesarias: *"Desarrollo para el escritorio con C++"* (incluye el compilador MSVC `cl.exe` y el SDK de Windows 10/11).
4. **WebView2 Runtime:** Incluido de fábrica en Windows 10 y Windows 11.

---

## 🚀 Flujo de Compilación Paso a Paso

### 1. Clonar el repositorio
```powershell
git clone https://github.com/GuacamoleGH/Tachyon-Studio-Rust.git
cd Tachyon-Studio-Rust
```

### 2. Instalar dependencias de frontend
```powershell
npm.cmd install
```

### 3. Ejecutar en Modo Desarrollo (HMR)
Inicia la ventana nativa de escritorio con recarga en caliente de React, TypeScript y Tailwind CSS:
```powershell
npm.cmd run tauri:dev
```

### 4. Ejecutar la Batería de Pruebas Automatizadas
Ejecuta los **49 tests** unitarios e integrados con Vitest:
```powershell
npm.cmd test
```
*Valida el motor de tiempo determinista (`TimeEngine`), interpolación de señales, análisis de CSV y ZIP64, serialización de plantillas, widgets y exportador de vídeo.*

---

## 📦 Generación de Binarios de Producción

### Opción A: Ejecutable Standalone Único (Recomendado para pruebas y portabilidad)
Compila el binario ejecutable optimizado en modo `release` sin empaquetar en instalador:
```powershell
npm.cmd run tauri:build -- --no-bundle
```
El archivo ejecutable listo para usar quedará ubicado en:
```
src-tauri/target/release/tachyon-studio.exe
```

> [!TIP]
> Si la aplicación ya está abierta y ejecutas este comando, Windows bloqueará el archivo por estar en uso (`os error 5 / Access is denied`). Asegúrate de cerrar la aplicación o ejecutar `taskkill /IM tachyon-studio.exe /F` antes de recompilar.

---

### Opción B: Instalador Completo de Windows (NSIS `.exe`)
Genera el paquete de instalación oficial para Windows con accesos directos en el menú inicio y desinstalador automático:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1
```
O directamente con el CLI de Tauri:
```powershell
npm.cmd run tauri:build
```
El instalador resultante se generará en:
```
src-tauri/target/release/bundle/nsis/Tachyon Studio_1.1.0_x64-setup.exe
```

---

## 🔍 Solución de Problemas Comunes

| Error | Causa Probable | Solución |
| :--- | :--- | :--- |
| `os error 5: Access is denied` durante el build | El archivo `tachyon-studio.exe` está en ejecución y Windows lo tiene bloqueado. | Ejecuta `taskkill /IM tachyon-studio.exe /F` en PowerShell y vuelve a lanzar el comando. |
| `link.exe not found` | Faltan las herramientas de compilación C++ de Visual Studio. | Abre el instalador de Visual Studio y marca la carga *"Desarrollo para el escritorio con C++"*. |
| `failed to run beforeBuildCommand` | Error de tipos en TypeScript o en Vite. | Ejecuta `npm.cmd run build` de forma aislada para revisar los mensajes exactos del compilador `tsc`. |
