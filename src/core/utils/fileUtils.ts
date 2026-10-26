/**
 * Utilidades para manejo seguro de nombres de archivos y rutas en el sistema de archivos.
 */

/**
 * Sanitiza un string para que sea un nombre de archivo completamente seguro y válido
 * en Windows, macOS y Linux.
 *
 * 1. Descompone caracteres acentuados (NFD) y elimina marcas diacríticas (ej. "Sesión" -> "Sesion").
 * 2. Reemplaza caracteres prohibidos en sistemas de archivos (como < > : " / \ | ? * y códigos ASCII 0-31).
 * 3. Normaliza espacios a guiones bajos.
 * 4. Evita nombres reservados en Windows (CON, PRN, AUX, NUL, COM1-9, LPT1-9).
 * 5. Colapsa guiones bajos repetidos y recorta los bordes.
 */
export function sanitizeFilename(input: string, fallback = 'archivo'): string {
  if (!input) return fallback;

  let clean = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos y diacríticos
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Quitar caracteres reservados en Windows / POSIX
    .replace(/\s+/g, '_') // Espacios a guion bajo
    .replace(/_+/g, '_') // Colapsar guiones bajos múltiples
    .replace(/^_+|_+$/g, ''); // Recortar guiones al principio y final

  if (!clean) {
    clean = fallback;
  }

  // Evitar nombres de dispositivos reservados en Windows
  const reservedWindows = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (reservedWindows.test(clean)) {
    clean = `${clean}_file`;
  }

  return clean;
}
