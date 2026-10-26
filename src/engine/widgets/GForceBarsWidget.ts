import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class GForceBarsWidget implements BaseWidget {
  public id: string = 'g_force_bars';
  public type = 'g_force_bars' as const;
  public name: string = 'Barras de Fuerzas G';
  public bounds: WidgetBounds;
  public visible: boolean = true;
  public maxG: number = 1.5;

  constructor(bounds: WidgetBounds = { x: 300, y: 150, width: 180, height: 90 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 180, height / 90);
    const cornerRadius = Math.max(3, Math.round(6 * scale));
    const labelFontSize = Math.max(7, Math.round(9 * scale));
    const valueFontSize = Math.max(9, Math.round(11 * scale));

    const latG = snapshot.lateralGAvailable && snapshot.lateralG !== null ? snapshot.lateralG : 0;
    const longG = snapshot.longitudinalGAvailable && snapshot.longitudinalG !== null ? snapshot.longitudinalG : 0;

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.88)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    const pad = Math.max(8, Math.round(10 * scale));
    const contentW = width - pad * 2;
    const barH = Math.max(8, Math.round(10 * scale));

    // 1. Barra Lateral G (Horizontal)
    const latY = y + pad + 2;
    ctx.font = `bold ${labelFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('LATERAL G', x + pad, latY);

    ctx.font = `bold ${valueFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = Math.abs(latG) > 1.0 ? CockpitColors.neonAmber : CockpitColors.neonCyan;
    ctx.textAlign = 'right';
    const latSign = latG > 0 ? 'R +' : latG < 0 ? 'L ' : '';
    ctx.fillText(`${latSign}${Math.abs(latG).toFixed(2)}G`, x + width - pad, latY);

    // Track de barra lateral
    const latBarY = latY + Math.round(14 * scale);
    ctx.fillStyle = 'rgba(44, 57, 71, 0.6)';
    ctx.fillRect(x + pad, latBarY, contentW, barH);

    // Centro
    const midX = x + pad + contentW / 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(midX - 1, latBarY - 1, 2, barH + 2);

    // Relleno lateral desde el centro
    const latClamped = Math.max(-this.maxG, Math.min(this.maxG, latG));
    const latFillW = (Math.abs(latClamped) / this.maxG) * (contentW / 2);
    ctx.fillStyle = Math.abs(latG) > 1.0 ? CockpitColors.neonAmber : CockpitColors.neonCyan;
    if (latClamped > 0) {
      ctx.fillRect(midX, latBarY, latFillW, barH);
    } else {
      ctx.fillRect(midX - latFillW, latBarY, latFillW, barH);
    }

    // 2. Barra Longitudinal G (Aceleración / Frenada)
    const longY = latBarY + barH + Math.round(12 * scale);
    ctx.font = `bold ${labelFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('LONGITUDINAL G', x + pad, longY);

    ctx.font = `bold ${valueFontSize}px ui-monospace, SFMono-Regular, monospace`;
    const isBraking = longG < 0;
    ctx.fillStyle = isBraking ? CockpitColors.neonRed : CockpitColors.neonGreen;
    ctx.textAlign = 'right';
    const longPrefix = isBraking ? 'BRAKE ' : 'ACCEL +';
    ctx.fillText(`${longPrefix}${Math.abs(longG).toFixed(2)}G`, x + width - pad, longY);

    // Track de barra longitudinal
    const longBarY = longY + Math.round(14 * scale);
    ctx.fillStyle = 'rgba(44, 57, 71, 0.6)';
    ctx.fillRect(x + pad, longBarY, contentW, barH);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(midX - 1, longBarY - 1, 2, barH + 2);

    const longClamped = Math.max(-this.maxG, Math.min(this.maxG, longG));
    const longFillW = (Math.abs(longClamped) / this.maxG) * (contentW / 2);
    ctx.fillStyle = isBraking ? CockpitColors.neonRed : CockpitColors.neonGreen;
    if (longClamped >= 0) {
      ctx.fillRect(midX, longBarY, longFillW, barH);
    } else {
      ctx.fillRect(midX - longFillW, longBarY, longFillW, barH);
    }

    ctx.restore();
  }
}
