/**
 * Utilidades para formateo y parseo bidireccional de tiempos y marcas de corte (mm:ss / segundos).
 */

/**
 * Convierte un número de segundos a formato de minutos y segundos "mm:ss" (o "mm:ss.s").
 * Ejemplo: 67 seg -> "01:07", 842.4 seg -> "14:02.4"
 */
export function formatTimeMinutes(totalSeconds: number, includeTenths = false): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 10);
  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  if (includeTenths && tenths > 0) {
    return `${mm}:${ss}.${tenths}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Parsea una cadena de texto en formato "mm:ss", "mm:ss.s", "hh:mm:ss" o segundos numéricos
 * a un valor numérico en segundos.
 * Ejemplo: "01:07" -> 67, "14:02.5" -> 842.5, "120" -> 120
 */
export function parseTimeToSeconds(input: string): number | null {
  if (!input) return null;
  const str = input.trim();
  if (str.length === 0) return null;

  if (str.includes(':')) {
    const parts = str.split(':').map((p) => parseFloat(p));
    if (parts.some((p) => isNaN(p))) return null;
    if (parts.length === 2) {
      // mm:ss o mm:ss.s
      return Math.max(0, parts[0] * 60 + parts[1]);
    }
    if (parts.length === 3) {
      // hh:mm:ss
      return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : Math.max(0, num);
}

/**
 * Formato amigable de duración (ej. "14m 02s", "45s", "1h 12m")
 */
export function formatDurationHuman(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  if (h > 0) {
    return `${h}h ${m}m ${s > 0 ? `${s}s` : ''}`.trim();
  }
  if (m > 0) {
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }
  return `${s}s`;
}
