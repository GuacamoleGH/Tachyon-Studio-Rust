# Guía de Purga de Archivos del Historial Git (git-filter-repo)

Este documento detalla el procedimiento exacto para eliminar de forma definitiva y permanente el archivo con datos reales `samples/real/sesion_real_android.zip` del historial de commits de Git en el repositorio público.

> [!CAUTION]
> Esta operación reescribe los hashes de commit de Git. Debe ejecutarse con una copia de seguridad local previa y requerirá un `git push --force` hacia GitHub.

---

## 1. Requisitos Previos

Tener instalado Python 3 y la herramienta oficial recomendada por Git, `git-filter-repo`:

```bash
pip install git-filter-repo
```

O verificar que está disponible:

```bash
git-filter-repo --version
```

---

## 2. Procedimiento de Purga Paso a Paso

1. **Asegurar que el árbol de trabajo actual esté limpio**:
   Comprueba que no tienes cambios pendientes sin confirmar:
   ```bash
   git status
   ```

2. **Crear una copia de respaldo del repositorio**:
   Haz una copia completa de la carpeta `Tachyon-Studio-Rust` en otra ubicación de tu disco antes de reescribir la historia.

3. **Ejecutar la purga del archivo en todo el historial**:
   Ejecuta el siguiente comando en la raíz del repositorio:
   ```bash
   git filter-repo --path samples/real/sesion_real_android.zip --invert-paths --force
   ```

4. **Verificar que el archivo ya no existe en ningún commit**:
   Comprueba con `git log` que el blob ha desaparecido de toda la historia:
   ```bash
   git log --all --full-history -- "samples/real/sesion_real_android.zip"
   ```
   *(El comando anterior no debe devolver ninguna salida).*

5. **Restablecer el origen remoto (git-filter-repo lo desconecta por seguridad)**:
   ```bash
   git remote add origin https://github.com/GuacamoleGH/Tachyon-Studio-Rust.git
   ```

6. **Forzar la subida a GitHub**:
   ```bash
   git push origin --force --all
   git push origin --force --tags
   ```

---

## 3. Comprobación en GitHub

Una vez completado el push forzado:
1. Accede a tu repositorio en GitHub y navega a la carpeta `samples/`. Solo debe aparecer `sesion_sintetica_prueba.zip`.
2. Los commits antiguos habrán sido reescritos sin rastro del ZIP con coordenadas reales ni vídeo.
