import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class MaxStatsWidget implements BaseWidget {
  public id: string = 'max_stats';
  public type = 'max_stats' as const;
  public name: string = 'Récords de Sesión (Max Stats)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  // Caché de máximos calculados para evitar recalcular en cada frame
  private lastTimeSec: number = -1;
  private cachedVMax: number = 0;
  private cachedGMax: number = 0;
  private cachedRpmMax: number = 0;

  constructor(bounds: WidgetBounds = { x: 80, y: 350, width: 230, height: 80 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, allPoints, timeSec, unitSystem } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 230, height / 80);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const titleFontSize = Math.max(11, Math.round(Math.min(width * 0.055, height * 0.16)));
    const labelFontSize = Math.max(10, Math.round(Math.min(width * 0.05, height * 0.14)));
    const numFontSize = Math.max(22, Math.round(Math.min(width * 0.14, height * 0.38)));
    const unitFontSize = Math.max(9, Math.round(Math.min(width * 0.045, height * 0.13)));

    const isImperial = unitSystem === 'imperial';
    const speedUnit = isImperial ? 'MPH' : 'KM/H';
    const speedMult = isImperial ? 0.621371 : 1.0;

    // Calcular o actualizar máximos acumulados hasta el tiempo actual
    if (allPoints && allPoints.length > 0) {
      if (timeSec < this.lastTimeSec || this.lastTimeSec < 0) {
        // Scrub hacia atrás o primer render: recalcular
        this.cachedVMax = 0;
        this.cachedGMax = 0;
        this.cachedRpmMax = 0;
        for (let i = 0; i < allPoints.length; i++) {
          const pt = allPoints[i];
          if (pt.time_offset_video_sec > timeSec) break;
          const spd = (pt.gps_speed_kmh ?? pt.obd_speed_kmh ?? 0);
          if (spd > this.cachedVMax) this.cachedVMax = spd;
          const latG = Math.abs(pt.lateral_g ?? 0);
          if (latG > this.cachedGMax) this.cachedGMax = latG;
          const rpm = pt.engine_rpm ?? 0;
          if (rpm > this.cachedRpmMax) this.cachedRpmMax = rpm;
        }
      } else {
        // Scrub hacia adelante: actualizar incrementalmente con el snapshot actual
        const curSpd = snapshot.speedKmh ?? 0;
        if (curSpd > this.cachedVMax) this.cachedVMax = curSpd;
        const curLatG = Math.abs(snapshot.lateralG ?? 0);
        if (curLatG > this.cachedGMax) this.cachedGMax = curLatG;
        const curRpm = snapshot.rpm ?? 0;
        if (curRpm > this.cachedRpmMax) this.cachedRpmMax = curRpm;
      }
      this.lastTimeSec = timeSec;
    } else {
      // Fallback con el snapshot si no hay array de puntos
      const curSpd = snapshot.speedKmh ?? 0;
      if (curSpd > this.cachedVMax) this.cachedVMax = curSpd;
      const curLatG = Math.abs(snapshot.lateralG ?? 0);
      if (curLatG > this.cachedGMax) this.cachedGMax = curLatG;
      const curRpm = snapshot.rpm ?? 0;
      if (curRpm > this.cachedRpmMax) this.cachedRpmMax = curRpm;
    }

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.88)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Título superior
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const padX = Math.round(12 * scale);
    ctx.fillText('RÉCORDS DE SESIÓN', x + padX, y + Math.round(height * 0.1));

    // 3 Columnas: V-MAX, LAT G MAX, RPM MAX
    const colWidth = (width - padX * 2) / 3;
    const colY = y + Math.round(height * 0.32);

    const cols = [
      {
        label: 'V-MAX',
        val: Math.round(this.cachedVMax * speedMult).toString(),
        unit: speedUnit,
        color: CockpitColors.neonCyan,
      },
      {
        label: 'LAT G',
        val: this.cachedGMax.toFixed(2),
        unit: 'G',
        color: CockpitColors.neonAmber,
      },
      {
        label: 'RPM MAX',
        val: Math.round(this.cachedRpmMax).toString(),
        unit: 'RPM',
        color: CockpitColors.neonRed,
      },
    ];

    cols.forEach((col, idx) => {
      const colX = x + padX + idx * colWidth;

      // Sub-etiqueta
      ctx.font = `bold ${labelFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(col.label, colX, colY);

      // Valor en negrita 900
      ctx.font = `900 ${numFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = col.color;
      ctx.textBaseline = 'alphabetic';
      const numBaseY = y + height - Math.round(height * 0.16);
      ctx.fillText(col.val, colX, numBaseY);

      // Unidad
      const numWidth = ctx.measureText(col.val).width;
      ctx.font = `bold ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText(col.unit, colX + numWidth + Math.round(4 * scale), numBaseY);
    });

    ctx.restore();
  }
}
