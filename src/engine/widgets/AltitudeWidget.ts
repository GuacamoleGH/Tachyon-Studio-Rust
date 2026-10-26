import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class AltitudeWidget implements BaseWidget {
  public id: string = 'altitude';
  public type = 'altitude' as const;
  public name: string = 'Altitud GPS';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 100, y: 150, width: 85, height: 68 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, unitSystem } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 85, height / 68);
    const cornerRadius = Math.max(3, Math.round(6 * scale));
    const titleFontSize = Math.max(8, Math.round(Math.min(width * 0.11, height * 0.17)));
    const numFontSize = Math.max(18, Math.round(Math.min(width * 0.32, height * 0.45)));
    const unitFontSize = Math.max(8, Math.round(Math.min(width * 0.12, height * 0.18)));

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

    const pad = Math.max(6, Math.round(8 * scale));

    // Título "ALTITUD"
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ALTITUD', x + pad, y + pad);

    // Valor principal
    const numY = y + height - Math.max(8, Math.round(10 * scale));
    const numText = displayAlt !== null ? Math.round(displayAlt).toString() : 'N/D';

    ctx.font = `900 ${numFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (displayAlt !== null) {
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.fillText(numText, x + pad, numY);

      // Unidad colocada inmediatamente al lado del valor numérico
      const numW = ctx.measureText(numText).width;
      ctx.font = `bold ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textSecondary;
      ctx.fillText(unitStr, x + pad + numW + Math.round(4 * scale), numY);
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', x + pad, numY);
    }

    ctx.restore();
  }
}
