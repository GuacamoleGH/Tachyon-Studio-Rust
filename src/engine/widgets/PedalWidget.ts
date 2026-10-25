import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class PedalWidget implements BaseWidget {
  public id: string = 'throttle';
  public type = 'throttle' as const;
  public name: string = 'Barra de Acelerador / Pedal';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 260, y: 310, width: 60, height: 110 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot } = context;
    const { x, y, width, height } = this.bounds;

    const throttle = snapshot.throttlePct;
    const isAvailable = snapshot.throttleAvailable && throttle !== null;

    const scale = Math.min(width / 55, height / 110);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const labelFontSize = Math.max(8, Math.round(10 * scale));
    const valFontSize = Math.max(9, Math.round(12 * scale));

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Etiqueta
    ctx.font = `bold ${labelFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('PEDAL', x + width / 2, y + Math.round(6 * scale));

    // Barra vertical
    const barPadding = Math.max(6, Math.round(10 * scale));
    const barX = x + barPadding;
    const barW = Math.max(8, width - barPadding * 2);
    const barTop = y + Math.round(20 * scale);
    const barBottom = y + height - Math.round(22 * scale);
    const barH = Math.max(10, barBottom - barTop);

    // Fondo de la barra
    ctx.beginPath();
    ctx.roundRect(barX, barTop, barW, barH, Math.max(2, Math.round(4 * scale)));
    ctx.fillStyle = CockpitColors.cardBg;
    ctx.fill();

    if (isAvailable && throttle !== null) {
      const clampedPct = Math.max(0, Math.min(100, throttle));
      const fillH = (clampedPct / 100) * barH;
      const fillY = barTop + barH - fillH;

      ctx.beginPath();
      ctx.roundRect(barX, fillY, barW, fillH, Math.max(2, Math.round(4 * scale)));
      const gradient = ctx.createLinearGradient(0, barTop + barH, 0, barTop);
      gradient.addColorStop(0, CockpitColors.neonGreen);
      gradient.addColorStop(1, CockpitColors.neonCyan);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Porcentaje numérico
      ctx.font = `bold ${valFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textPrimary;
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${Math.round(clampedPct)}%`, x + width / 2, y + height - Math.round(4 * scale));
    } else {
      ctx.font = `bold ${valFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.textBaseline = 'bottom';
      ctx.fillText('N/D', x + width / 2, y + height - Math.round(4 * scale));
    }

    ctx.restore();
  }
}
