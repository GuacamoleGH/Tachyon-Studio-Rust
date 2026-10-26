export type MapBackgroundProvider = 'none' | 'osm' | 'carto_voyager' | 'carto_dark' | 'carto_light';

export class MapTileManager {
  private static cache: Map<string, HTMLImageElement> = new Map();
  private static listeners: Set<() => void> = new Set();
  private static failedUrls: Set<string> = new Set();
  private static maxCacheSize: number = 300;

  // Clave API de CartoDB (5.000.000 peticiones/mes gratuitas)
  public static cartoApiKey: string = 'cb1_4v3w_1_cc302707f12f6e47376ae5f1';

  /**
   * Suscribe un callback que se invocará cuando cualquier tesela termine de cargarse.
   * Devuelve una función para desuscribirse.
   */
  public static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error en callback de MapTileManager:', err);
      }
    }
  }

  /**
   * Genera la URL de descarga para una tesela (z, x, y) según el proveedor.
   */
  public static getTileUrl(provider: MapBackgroundProvider, z: number, x: number, y: number): string | null {
    if (provider === 'none') return null;
    const n = 1 << z;
    const normX = ((x % n) + n) % n;
    if (y < 0 || y >= n) return null;

    const keyParam = this.cartoApiKey ? `?key=${this.cartoApiKey}` : '';

    switch (provider) {
      case 'osm':
        return `https://tile.openstreetmap.org/${z}/${normX}/${y}.png`;
      case 'carto_voyager':
        return `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${normX}/${y}.png${keyParam}`;
      case 'carto_dark':
        return `https://basemaps.cartocdn.com/rastertiles/dark_all/${z}/${normX}/${y}.png${keyParam}`;
      case 'carto_light':
        return `https://basemaps.cartocdn.com/rastertiles/light_all/${z}/${normX}/${y}.png${keyParam}`;
      default:
        return null;
    }
  }

  /**
   * Obtiene la tesela en caché si ya está lista, o inicia su descarga asíncrona.
   */
  public static getTile(provider: MapBackgroundProvider, z: number, x: number, y: number): HTMLImageElement | null {
    if (provider === 'none') return null;
    const url = this.getTileUrl(provider, z, x, y);
    if (!url) return null;

    if (this.failedUrls.has(url)) return null;

    const cached = this.cache.get(url);
    if (cached) {
      if (cached.complete && cached.naturalWidth > 0) {
        return cached;
      }
      return null;
    }

    // Poda básica de caché LRU para mantener memoria mínima (~6MB)
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    if (typeof Image === 'undefined') {
      return null;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    this.cache.set(url, img);

    img.onload = () => {
      this.notifyListeners();
    };

    img.onerror = () => {
      this.failedUrls.add(url);
      this.cache.delete(url);
    };

    img.src = url;
    return null;
  }

  /**
   * Convierte latitud y longitud (grados) a coordenadas de píxel global Web Mercator en zoom z.
   */
  public static lonLatToWorldPixels(lat: number, lon: number, z: number): { x: number; y: number } {
    const n = 1 << z;
    const x = ((lon + 180) / 360) * n * 256;
    const safeLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
    const safeLatRad = (safeLat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(Math.PI / 4 + safeLatRad / 2)) / Math.PI) / 2) * n * 256;
    return { x, y };
  }

  /**
   * Calcula el zoom entero óptimo z (entre 10 y 19) para una resolución en metros/píxel.
   */
  public static calculateOptimalZoom(metersPerPixel: number, lat: number): number {
    const latRad = (lat * Math.PI) / 180;
    const earthCircumference = 40075016.686 * Math.cos(latRad);
    const targetZ = Math.log2(earthCircumference / (256 * Math.max(0.01, metersPerPixel)));
    return Math.max(10, Math.min(19, Math.round(targetZ)));
  }

  /**
   * Devuelve los metros reales por píxel de una tesela a nivel z y latitud lat.
   */
  public static getMetersPerTilePixel(z: number, lat: number): number {
    const latRad = (lat * Math.PI) / 180;
    const earthCircumference = 40075016.686 * Math.cos(latRad);
    return earthCircumference / (256 * (1 << z));
  }
}
