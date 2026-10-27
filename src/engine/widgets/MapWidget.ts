import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';
import { MapBackgroundProvider, MapTileManager } from '../maps/MapTileManager';

export type MapDisplayMode = 'chase_heading' | 'chase_north' | 'full_circuit';

export class MapWidget implements BaseWidget {
  public id: string = 'map';
  public type = 'map' as const;
  public name: string = 'Mapa con Trazada GPS';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  // Modo de visualización de la trazada:
  // 'chase_north': minimapa fluido centrado en el coche con norte arriba (suave, sin tirones de rotación)
  // 'chase_heading': minimapa con rotación según rumbo
  // 'full_circuit': vista de todo el circuito completo estático
  public mode: MapDisplayMode = 'chase_north';

  // Radio en metros visible para el zoom del minimapa dinámico (por defecto 120m para visión cercana y detallada de curvas)
  public zoomMeters: number = 120;

  // Fondo cartográfico callejero descargado por teselas (OpenStreetMap, CartoDB o vectorial oscuro)
  public mapBackground: MapBackgroundProvider = 'none';

  // Caché de la caja delimitadora global de coordenadas de la sesión
  private boundsCache: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null = null;
  // Caché de puntos GPS válidos para evitar recorrer 50.000 muestras con nulos en cada frame
  private cachedGpsPoints: { lat: number; lon: number }[] | null = null;
  private cachedSourcePointsRef: any = null;

  // Suavizado cinemático de coordenadas y rumbo para eliminar tirones (micro-stuttering) de GPS discretos (1Hz-10Hz)
  private smoothLat: number | null = null;
  private smoothLon: number | null = null;
  private smoothHeading: number | null = null;

  constructor(bounds: WidgetBounds = { x: 330, y: 150, width: 200, height: 150 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, allPoints } = context;
    const { x, y, width, height } = this.bounds;
    const scale = Math.min(width / 180, height / 135);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const titleFontSize = Math.max(8, Math.round(10 * scale));

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.88)';
    ctx.fill();

    const isChaseMode = this.mode === 'chase_heading' || this.mode === 'chase_north';
    const hasCarPos = snapshot.gpsAvailable && snapshot.latitude != null && snapshot.longitude != null;

    if (!allPoints || allPoints.length === 0) {
      ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textSecondary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(isChaseMode ? 'MINIMAPA GPS' : 'TRAZADA GPS', x + Math.round(10 * scale), y + Math.round(10 * scale));

      const emptyFontSize = Math.max(9, Math.round(11 * scale));
      ctx.font = `bold ${emptyFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sin datos GPS', x + width / 2, y + height / 2);

      ctx.beginPath();
      ctx.roundRect(x, y, width, height, cornerRadius);
      ctx.strokeStyle = CockpitColors.border;
      ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
      ctx.stroke();

      ctx.restore();
      return;
    }

    // Inicializar o refrescar caché de puntos GPS válidos una sola vez
    if (this.cachedSourcePointsRef !== allPoints || !this.cachedGpsPoints) {
      this.cachedSourcePointsRef = allPoints;
      const validPoints: { lat: number; lon: number }[] = [];
      let lastLat = 0;
      let lastLon = 0;
      for (let i = 0; i < allPoints.length; i++) {
        const p = allPoints[i];
        if (p.latitude != null && p.longitude != null) {
          // Filtrar puntos repetidos idénticos para reducir la carga de dibujo
          if (Math.abs(p.latitude - lastLat) > 0.000005 || Math.abs(p.longitude - lastLon) > 0.000005) {
            validPoints.push({ lat: p.latitude, lon: p.longitude });
            lastLat = p.latitude;
            lastLon = p.longitude;
          }
        }
      }
      this.cachedGpsPoints = validPoints;
    }

    const gpsPoints = this.cachedGpsPoints;
    if (gpsPoints.length === 0) {
      ctx.restore();
      return;
    }

    // =========================================================================
    // MODO 1: MINIMAPA DINÁMICO DE VIDEOJUEGO (CHASE ZOOM)
    // =========================================================================
    if (isChaseMode && hasCarPos) {
      const rawLat = snapshot.latitude!;
      const rawLon = snapshot.longitude!;
      const rawHeading = snapshot.bearingAvailable && snapshot.bearingDeg != null ? snapshot.bearingDeg : 0;

      // Suavizado cinemático exponencial (EMA) para eliminar los tirones de GPS de baja frecuencia (1Hz-10Hz)
      if (this.smoothLat === null || this.smoothLon === null) {
        this.smoothLat = rawLat;
        this.smoothLon = rawLon;
        this.smoothHeading = rawHeading;
      } else {
        const distLat = Math.abs(rawLat - this.smoothLat);
        const distLon = Math.abs(rawLon - this.smoothLon);
        if (distLat > 0.05 || distLon > 0.05) {
          this.smoothLat = rawLat;
          this.smoothLon = rawLon;
          this.smoothHeading = rawHeading;
        } else {
          const alphaPos = 0.22;
          this.smoothLat = this.smoothLat + (rawLat - this.smoothLat) * alphaPos;
          this.smoothLon = this.smoothLon + (rawLon - this.smoothLon) * alphaPos;

          if (this.smoothHeading !== null) {
            let diff = (rawHeading - this.smoothHeading) % 360;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            const alphaHeading = 0.18;
            this.smoothHeading = (this.smoothHeading + diff * alphaHeading + 360) % 360;
          } else {
            this.smoothHeading = rawHeading;
          }
        }
      }

      const carLat = this.smoothLat;
      const carLon = this.smoothLon;
      const headingDeg = this.smoothHeading ?? rawHeading;

      const cx = x + width / 2;
      const cy = y + height / 2 + Math.round(6 * scale);
      const radarRadius = Math.min(width, height) / 2 - Math.round(16 * scale);
      const scaleM = radarRadius / Math.max(50, this.zoomMeters);

      const radLat = (carLat * Math.PI) / 180;
      const mPerLat = 111139;
      const mPerLon = 111139 * Math.cos(radLat);

      const rotateWithHeading = this.mode === 'chase_heading';
      const rotRad = rotateWithHeading ? (-headingDeg * Math.PI) / 180 : 0;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, cornerRadius);
      ctx.clip();

      // Renderizado de teselas de mapa (OpenStreetMap o CartoDB) si está activado
      if (this.mapBackground !== 'none') {
        const metersPerPx = Math.max(50, this.zoomMeters) / radarRadius;
        const z = MapTileManager.calculateOptimalZoom(metersPerPx, carLat);
        const metersPerTilePx = MapTileManager.getMetersPerTilePixel(z, carLat);
        const tileScale = metersPerTilePx * scaleM;
        const carWorld = MapTileManager.lonLatToWorldPixels(carLat, carLon, z);

        const maxScreenDist = Math.hypot(width, height) / 2 + 40;
        const maxTileDist = maxScreenDist / tileScale;
        const minTx = Math.floor((carWorld.x - maxTileDist) / 256);
        const maxTx = Math.floor((carWorld.x + maxTileDist) / 256);
        const minTy = Math.floor((carWorld.y - maxTileDist) / 256);
        const maxTy = Math.floor((carWorld.y + maxTileDist) / 256);

        ctx.save();
        if (rotateWithHeading) {
          ctx.translate(cx, cy);
          ctx.rotate(rotRad);
          ctx.translate(-cx, -cy);
        }

        for (let tx = minTx; tx <= maxTx; tx++) {
          for (let ty = minTy; ty <= maxTy; ty++) {
            const tileImg = MapTileManager.getTile(this.mapBackground, z, tx, ty);
            if (tileImg) {
              const screenTileX = cx + (tx * 256 - carWorld.x) * tileScale;
              const screenTileY = cy + (ty * 256 - carWorld.y) * tileScale;
              const screenTileSize = 256 * tileScale;
              ctx.drawImage(tileImg, screenTileX, screenTileY, screenTileSize, screenTileSize);
            }
          }
        }
        ctx.restore();
      }

      if (this.mapBackground === 'none') {
        // Círculos de radar concéntricos
        ctx.beginPath();
        ctx.arc(cx, cy, radarRadius * 0.5, 0, Math.PI * 2);
        ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(44, 57, 71, 0.45)';
        ctx.lineWidth = Math.max(1, Math.round(1 * scale));
        ctx.setLineDash([3 * scale, 3 * scale]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ejes tenues
        ctx.beginPath();
        ctx.moveTo(cx - radarRadius, cy);
        ctx.lineTo(cx + radarRadius, cy);
        ctx.moveTo(cx, cy - radarRadius);
        ctx.lineTo(cx, cy + radarRadius);
        ctx.strokeStyle = 'rgba(44, 57, 71, 0.3)';
        ctx.stroke();
      }

      // Límite de distancia en metros para descartar puntos lejanos fuera de pantalla
      const maxDistM = this.zoomMeters * 2.2;

      // Paso de muestreo adaptativo si la sesión tiene miles de puntos
      const stride = gpsPoints.length > 3000 ? Math.ceil(gpsPoints.length / 3000) : 1;

      ctx.beginPath();
      let isDrawing = false;
      let drawnCount = 0;

      for (let i = 0; i < gpsPoints.length; i += stride) {
        const pt = gpsPoints[i];
        const dx = (pt.lon - carLon) * mPerLon;
        const dy = (pt.lat - carLat) * mPerLat;

        // Culling rápido en coordenadas cartesianas locales antes de rotar
        if (Math.abs(dx) > maxDistM || Math.abs(dy) > maxDistM) {
          // Si el punto queda fuera del visor, desconectamos el trazo para no cruzar líneas
          isDrawing = false;
          continue;
        }

        let rx = dx;
        let ry = dy;
        if (rotateWithHeading) {
          rx = dx * cosR - dy * sinR;
          ry = dx * sinR + dy * cosR;
        }

        const px = cx + rx * scaleM;
        const py = cy - ry * scaleM;

        if (!isDrawing) {
          ctx.moveTo(px, py);
          isDrawing = true;
        } else {
          ctx.lineTo(px, py);
        }
        drawnCount++;
      }

      if (drawnCount > 1) {
        if (this.mapBackground !== 'none') {
          // Borde oscuro grueso para alto contraste sobre calles o fondo claro (estilo app móvil Tachyon)
          ctx.strokeStyle = 'rgba(10, 15, 20, 0.9)';
          ctx.lineWidth = Math.max(4.5, Math.round(6.5 * scale));
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          // Línea interior cian fluorescente brillante
          ctx.strokeStyle = CockpitColors.neonCyan;
          ctx.lineWidth = Math.max(2.0, Math.round(3.0 * scale));
          ctx.stroke();
        } else {
          // Modo vectorial oscuro original
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.28)';
          ctx.lineWidth = Math.max(3.5, Math.round(5.5 * scale));
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          ctx.strokeStyle = CockpitColors.neonCyan;
          ctx.lineWidth = Math.max(1.5, Math.round(2.5 * scale));
          ctx.stroke();
        }
      }

      // Vehículo centrado en (cx, cy)
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(7, Math.round(10 * scale)), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 230, 118, 0.3)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(4, Math.round(5.5 * scale)), 0, Math.PI * 2);
      ctx.fillStyle = CockpitColors.neonGreen;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, Math.round(2 * scale)), 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.restore(); // Termina clip

      // Etiquetas de cabecera (con píldora semitransparente si hay mapa)
      this.renderHeaderLabels(ctx, x, y, width, scale, isChaseMode, titleFontSize);

      // Borde del panel
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, cornerRadius);
      ctx.strokeStyle = CockpitColors.border;
      ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
      ctx.stroke();

      ctx.restore(); // Termina estado principal
      return;
    }

    // =========================================================================
    // MODO 2: CIRCUITO COMPLETO ESTÁTICO (VISTA GLOBAL)
    // =========================================================================
    if (!this.boundsCache) {
      let minLat = Infinity,
        maxLat = -Infinity,
        minLon = Infinity,
        maxLon = -Infinity;

      for (let i = 0; i < gpsPoints.length; i++) {
        const pt = gpsPoints[i];
        if (pt.lat < minLat) minLat = pt.lat;
        if (pt.lat > maxLat) maxLat = pt.lat;
        if (pt.lon < minLon) minLon = pt.lon;
        if (pt.lon > maxLon) maxLon = pt.lon;
      }

      if (isFinite(minLat)) {
        this.boundsCache = { minLat, maxLat, minLon, maxLon };
      }
    }

    if (!this.boundsCache) {
      ctx.restore();
      return;
    }

    const { minLat, maxLat, minLon, maxLon } = this.boundsCache;
    const padding = 18;
    const mapW = width - padding * 2;
    const mapH = height - padding * 2 - 10;
    const mapX = x + padding;
    const mapY = y + padding + 6;

    const latSpan = Math.max(0.0001, maxLat - minLat);
    const lonSpan = Math.max(0.0001, maxLon - minLon);

    const project = (lat: number, lon: number): { px: number; py: number } => {
      const px = mapX + ((lon - minLon) / lonSpan) * mapW;
      const py = mapY + (1 - (lat - minLat) / latSpan) * mapH;
      return { px, py };
    };

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.clip();

    // Teselas en modo circuito completo
    if (this.mapBackground !== 'none') {
      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;
      const latRad = (centerLat * Math.PI) / 180;
      const mPerLat = 111139;
      const mPerLon = 111139 * Math.cos(latRad);
      const spanMeters = Math.max(latSpan * mPerLat, lonSpan * mPerLon);
      const minDimPx = Math.min(mapW, mapH);
      const metersPerPx = spanMeters / Math.max(30, minDimPx);
      const z = MapTileManager.calculateOptimalZoom(metersPerPx, centerLat);
      const metersPerTilePx = MapTileManager.getMetersPerTilePixel(z, centerLat);

      const centerScreenX = mapX + mapW / 2;
      const centerScreenY = mapY + mapH / 2;
      const centerWorld = MapTileManager.lonLatToWorldPixels(centerLat, centerLon, z);
      const tileScale = (1 / metersPerPx) * metersPerTilePx;

      const maxScreenDist = Math.hypot(width, height) / 2 + 40;
      const maxTileDist = maxScreenDist / Math.max(0.01, tileScale);
      const minTx = Math.floor((centerWorld.x - maxTileDist) / 256);
      const maxTx = Math.floor((centerWorld.x + maxTileDist) / 256);
      const minTy = Math.floor((centerWorld.y - maxTileDist) / 256);
      const maxTy = Math.floor((centerWorld.y + maxTileDist) / 256);

      for (let tx = minTx; tx <= maxTx; tx++) {
        for (let ty = minTy; ty <= maxTy; ty++) {
          const tileImg = MapTileManager.getTile(this.mapBackground, z, tx, ty);
          if (tileImg) {
            const screenTileX = centerScreenX + (tx * 256 - centerWorld.x) * tileScale;
            const screenTileY = centerScreenY + (ty * 256 - centerWorld.y) * tileScale;
            const screenTileSize = 256 * tileScale;
            ctx.drawImage(tileImg, screenTileX, screenTileY, screenTileSize, screenTileSize);
          }
        }
      }
    }

    // Polilínea de la trazada completa
    ctx.beginPath();
    let started = false;

    for (let i = 0; i < gpsPoints.length; i++) {
      const pt = gpsPoints[i];
      const { px, py } = project(pt.lat, pt.lon);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }

    if (this.mapBackground !== 'none') {
      ctx.strokeStyle = 'rgba(10, 15, 20, 0.9)';
      ctx.lineWidth = Math.max(4, Math.round(5.5 * scale));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.strokeStyle = CockpitColors.neonCyan;
      ctx.lineWidth = Math.max(1.8, Math.round(2.6 * scale));
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
      ctx.lineWidth = Math.max(1.5, Math.round(2.5 * scale));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Posición del coche - Puntito limpio con interpolación suave
    if (snapshot.gpsAvailable && snapshot.latitude != null && snapshot.longitude != null) {
      const rawLat = snapshot.latitude;
      const rawLon = snapshot.longitude;

      if (this.smoothLat === null || this.smoothLon === null || Math.abs(rawLat - this.smoothLat) > 0.05 || Math.abs(rawLon - this.smoothLon) > 0.05) {
        this.smoothLat = rawLat;
        this.smoothLon = rawLon;
      } else {
        this.smoothLat = this.smoothLat + (rawLat - this.smoothLat) * 0.22;
        this.smoothLon = this.smoothLon + (rawLon - this.smoothLon) * 0.22;
      }

      const { px, py } = project(this.smoothLat, this.smoothLon);

      // Halo exterior
      ctx.beginPath();
      ctx.arc(px, py, Math.max(6, Math.round(8 * scale)), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 230, 118, 0.35)';
      ctx.fill();

      // Punto central verde con núcleo blanco
      ctx.beginPath();
      ctx.arc(px, py, Math.max(3.5, Math.round(5 * scale)), 0, Math.PI * 2);
      ctx.fillStyle = CockpitColors.neonGreen;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.5, Math.round(2 * scale)), 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    } else {
      // Estado de corte GPS
      ctx.font = `bold ${Math.max(8, Math.round(9 * scale))}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.neonRed;
      ctx.textAlign = 'right';
      ctx.fillText('SIN GPS', x + width - Math.round(10 * scale), y + Math.round(15 * scale));
    }

    ctx.restore(); // Termina clip

    // Etiquetas de cabecera
    this.renderHeaderLabels(ctx, x, y, width, scale, isChaseMode, titleFontSize);

    // Borde exterior
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    ctx.restore();
  }

  private renderHeaderLabels(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    scale: number,
    isChaseMode: boolean,
    titleFontSize: number
  ): void {
    const titleText = isChaseMode ? 'MINIMAPA GPS' : 'TRAZADA GPS';
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    const titleWidth = ctx.measureText(titleText).width;

    if (this.mapBackground !== 'none') {
      ctx.fillStyle = 'rgba(12, 16, 22, 0.82)';
      ctx.beginPath();
      ctx.roundRect(x + 7 * scale, y + 6 * scale, titleWidth + 10 * scale, titleFontSize + 6 * scale, 4 * scale);
      ctx.fill();
    }

    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(titleText, x + Math.round(12 * scale), y + Math.round(9 * scale));

    if (isChaseMode) {
      const zoomText = `${this.zoomMeters}m`;
      const zoomFontSize = Math.max(7, Math.round(9 * scale));
      ctx.font = `bold ${zoomFontSize}px ui-monospace, SFMono-Regular, monospace`;
      const zoomWidth = ctx.measureText(zoomText).width;

      if (this.mapBackground !== 'none') {
        ctx.fillStyle = 'rgba(12, 16, 22, 0.82)';
        ctx.beginPath();
        ctx.roundRect(x + width - zoomWidth - 17 * scale, y + 6 * scale, zoomWidth + 10 * scale, zoomFontSize + 6 * scale, 4 * scale);
        ctx.fill();
      }

      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.textAlign = 'right';
      ctx.fillText(zoomText, x + width - Math.round(12 * scale), y + Math.round(9 * scale));
    }
  }
}
