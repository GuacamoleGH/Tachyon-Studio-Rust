import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

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

  // Radio en metros visible para el zoom del minimapa dinámico
  public zoomMeters: number = 400;

  // Caché de la caja delimitadora global de coordenadas de la sesión
  private boundsCache: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null = null;
  // Caché de puntos GPS válidos para evitar recorrer 50.000 muestras con nulos en cada frame
  private cachedGpsPoints: { lat: number; lon: number }[] | null = null;
  private cachedSourcePointsRef: any = null;

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
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    const isChaseMode = this.mode === 'chase_heading' || this.mode === 'chase_north';
    const hasCarPos = snapshot.gpsAvailable && snapshot.latitude != null && snapshot.longitude != null;

    // Etiqueta del widget
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(isChaseMode ? 'MINIMAPA GPS' : 'TRAZADA GPS', x + Math.round(10 * scale), y + Math.round(10 * scale));

    // Indicador de modo / zoom en la esquina superior derecha
    if (isChaseMode) {
      ctx.font = `bold ${Math.max(7, Math.round(9 * scale))}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.textAlign = 'right';
      ctx.fillText(`${this.zoomMeters}m`, x + width - Math.round(10 * scale), y + Math.round(10 * scale));
    }

    if (!allPoints || allPoints.length === 0) {
      const emptyFontSize = Math.max(9, Math.round(11 * scale));
      ctx.font = `bold ${emptyFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sin datos GPS', x + width / 2, y + height / 2);
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
      const carLat = snapshot.latitude!;
      const carLon = snapshot.longitude!;
      const headingDeg = snapshot.bearingAvailable && snapshot.bearingDeg != null ? snapshot.bearingDeg : 0;

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

      // Límite de distancia en metros para descartar puntos lejanos fuera de pantalla
      const maxDistM = this.zoomMeters * 2.2;

      // Paso de muestreo adaptativo si la sesión tiene miles de puntos
      const stride = gpsPoints.length > 3000 ? Math.ceil(gpsPoints.length / 3000) : 1;
      const projected: { px: number; py: number }[] = [];

      for (let i = 0; i < gpsPoints.length; i += stride) {
        const pt = gpsPoints[i];
        const dx = (pt.lon - carLon) * mPerLon;
        const dy = (pt.lat - carLat) * mPerLat;

        // Culling rápido en coordenadas cartesianas locales antes de rotar
        if (Math.abs(dx) > maxDistM || Math.abs(dy) > maxDistM) {
          continue;
        }

        let rx = dx;
        let ry = dy;
        if (rotateWithHeading) {
          rx = dx * cosR - dy * sinR;
          ry = dx * sinR + dy * cosR;
        }

        projected.push({
          px: cx + rx * scaleM,
          py: cy - ry * scaleM,
        });
      }

      if (projected.length > 1) {
        ctx.beginPath();
        ctx.moveTo(projected[0].px, projected[0].py);
        for (let i = 1; i < projected.length; i++) {
          ctx.lineTo(projected[i].px, projected[i].py);
        }

        // Dibujar trazado: 1º halo exterior brillante, 2º línea central
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.28)';
        ctx.lineWidth = Math.max(3.5, Math.round(5.5 * scale));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.strokeStyle = CockpitColors.neonCyan;
        ctx.lineWidth = Math.max(1.5, Math.round(2.5 * scale));
        ctx.stroke();
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

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
    ctx.lineWidth = Math.max(1.5, Math.round(2.5 * scale));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Posición del coche - Puntito limpio
    if (snapshot.gpsAvailable && snapshot.latitude != null && snapshot.longitude != null) {
      const { px, py } = project(snapshot.latitude, snapshot.longitude);

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

    ctx.restore();
  }
}
