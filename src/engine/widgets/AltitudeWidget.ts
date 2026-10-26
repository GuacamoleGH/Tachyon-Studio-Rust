import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class AltitudeWidget implements BaseWidget {
  public id: string = 'altitude';
  public type = 'altitude' as const;
  public name: string = 'Altitud GPS';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 100, y: 150, width: 140, height: 75 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, unitSystem } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 140, height / 75);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const titleFontSize = Math.max(8, Math.round(10 * scale));
    const numFontSize = Math.max(16, Math.round(30 * scale));
    const unitFontSize = Math.max(8, Math.round(11 * scale));

    const altM = snapshot.signals.altitude_m?.isAvailable ? snapshot.signals.altitude_m.value : null;
    const isImperial = unitSystem === 'imperial';
    const displayAlt = altM !== null ? (isImperial ? altM * 3.28084 : altM) : null;
    const unitStr = isImperial ? 'FT' : 'M';

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.88)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Título "ALTITUD"
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ALTITUD GPS', x + Math.round(10 * scale), y + Math.round(8 * scale));

    // Valor principal
    ctx.font = `bold ${numFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const numY = y + height - Math.round(14 * scale);
    if (displayAlt !== null) {
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.fillText(Math.round(displayAlt).toString(), x + Math.round(10 * scale), numY);
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', x + Math.round(10 * scale), numY);
    }

    // Unidad en la esquina inferior derecha
    ctx.font = `bold ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'right';
    ctx.fillText(unitStr, x + width - Math.round(10 * scale), numY);

    ctx.restore();
  }
}
