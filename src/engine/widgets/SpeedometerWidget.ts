import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class SpeedometerWidget implements BaseWidget {
  public id: string = 'speedometer';
  public type = 'speedometer' as const;
  public name: string = 'Velocímetro Digital';
  public bounds: WidgetBounds;
  public visible: boolean = true;
  public preferredSource: 'GPS' | 'OBD' = 'GPS';

  constructor(bounds: WidgetBounds = { x: 30, y: 310, width: 220, height: 110 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, unitSystem } = context;
    const { x, y, width, height } = this.bounds;

    let rawSpeedKmh: number | null = null;
    let isAvailable = false;
    let sourceLabel = 'GPS SPEED';

    if (this.preferredSource === 'OBD' && snapshot.signals.obd_speed_kmh?.isAvailable) {
      rawSpeedKmh = snapshot.signals.obd_speed_kmh.value;
      isAvailable = true;
      sourceLabel = 'OBD SPEED';
    } else if (snapshot.speedAvailable && snapshot.speedKmh !== null) {
      rawSpeedKmh = snapshot.speedKmh;
      isAvailable = true;
      sourceLabel = 'GPS SPEED';
    }

    const isImperial = unitSystem === 'imperial';
    const displaySpeed = rawSpeedKmh !== null ? (isImperial ? rawSpeedKmh * 0.621371 : rawSpeedKmh) : null;
    const unitLabel = isImperial ? 'MPH' : 'KM/H';

    const scale = Math.min(width / 210, height / 110);
    const cornerRadius = Math.max(4, Math.round(8 * scale));
    const padX = Math.max(10, Math.round(16 * scale));
    const numFontSize = Math.max(20, Math.round(48 * scale));
    const unitFontSize = Math.max(9, Math.round(13 * scale));
    const labelFontSize = Math.max(8, Math.round(10 * scale));

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Número grande de velocidad
    ctx.font = `bold ${numFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const numX = x + padX;
    const numY = y + height - Math.round(32 * scale);

    if (isAvailable && displaySpeed !== null) {
      ctx.fillStyle = CockpitColors.neonGreen;
      ctx.fillText(displaySpeed.toFixed(1), numX, numY);
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', numX, numY);
    }

    // Unidad en la esquina superior derecha
    ctx.font = `bold ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'right';
    ctx.fillText(unitLabel, x + width - padX, y + Math.round(34 * scale));

    // Etiqueta de fuente (GPS SPEED / OBD SPEED)
    ctx.font = `bold ${labelFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = isAvailable ? CockpitColors.neonCyan : CockpitColors.textMuted;
    ctx.textAlign = 'left';
    ctx.fillText(sourceLabel, numX, y + height - Math.round(12 * scale));

    ctx.restore();
  }
}
