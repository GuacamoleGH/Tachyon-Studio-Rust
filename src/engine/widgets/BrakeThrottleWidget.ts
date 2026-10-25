import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class BrakeThrottleWidget implements BaseWidget {
  public id: string = 'brake_throttle';
  public type = 'brake_throttle' as const;
  public name: string = 'Pedales Duales (Freno / Gas)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 535, y: 575, width: 85, height: 110 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 85, height / 110);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const titleFontSize = Math.max(7, Math.round(9 * scale));
    const valFontSize = Math.max(8, Math.round(10 * scale));

    const throttle = snapshot.throttlePct;
    const isThrottleAvailable = snapshot.throttleAvailable && throttle !== null;

    // Freno deducido de deceleración longitudinal negativa (< -0.15G) o sensor
    const longG = snapshot.longitudinalG ?? snapshot.derivedGpsLongG;
    let brakePct = 0;
    let isBrakeAvailable = false;

    if (longG !== null && (snapshot.longitudinalGAvailable || snapshot.derivedGpsLongGAvailable)) {
      isBrakeAvailable = true;
      if (longG < -0.1) {
        // -0.1G a -1.3G normalizado a 0 - 100%
        brakePct = Math.min(100, Math.max(0, ((-longG - 0.1) / 1.1) * 100));
      }
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('PEDALES', x + width / 2, y + Math.round(6 * scale));

    const padX = Math.round(10 * scale);
    const gap = Math.round(8 * scale);
    const colW = (width - padX * 2 - gap) / 2;
    const barTop = y + Math.round(20 * scale);
    const barBottom = y + height - Math.round(20 * scale);
    const barH = Math.max(10, barBottom - barTop);

    // 1. Columna Izquierda: FRENO (Rojo)
    const brakeX = x + padX;
    ctx.beginPath();
    ctx.roundRect(brakeX, barTop, colW, barH, Math.max(2, Math.round(3 * scale)));
    ctx.fillStyle = CockpitColors.cardBg;
    ctx.fill();

    if (isBrakeAvailable && brakePct > 0) {
      const fillH = (brakePct / 100) * barH;
      const fillY = barTop + barH - fillH;
      ctx.beginPath();
      ctx.roundRect(brakeX, fillY, colW, fillH, Math.max(2, Math.round(3 * scale)));
      ctx.fillStyle = CockpitColors.neonRed;
      ctx.fill();
    }

    // 2. Columna Derecha: ACELERADOR (Verde)
    const throttleX = brakeX + colW + gap;
    ctx.beginPath();
    ctx.roundRect(throttleX, barTop, colW, barH, Math.max(2, Math.round(3 * scale)));
    ctx.fillStyle = CockpitColors.cardBg;
    ctx.fill();

    if (isThrottleAvailable && throttle !== null && throttle > 0) {
      const fillH = (Math.min(100, Math.max(0, throttle)) / 100) * barH;
      const fillY = barTop + barH - fillH;
      ctx.beginPath();
      ctx.roundRect(throttleX, fillY, colW, fillH, Math.max(2, Math.round(3 * scale)));
      ctx.fillStyle = CockpitColors.neonGreen;
      ctx.fill();
    }

    // Etiquetas inferiores de F / G y %
    ctx.font = `bold ${valFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textBaseline = 'bottom';
    const textY = y + height - Math.round(3 * scale);

    // Freno texto
    ctx.fillStyle = brakePct > 5 ? CockpitColors.neonRed : CockpitColors.textMuted;
    ctx.fillText(isBrakeAvailable ? `${Math.round(brakePct)}` : 'N/D', brakeX + colW / 2, textY);

    // Gas texto
    ctx.fillStyle = isThrottleAvailable && throttle! > 5 ? CockpitColors.neonGreen : CockpitColors.textMuted;
    ctx.fillText(isThrottleAvailable ? `${Math.round(throttle!)}` : 'N/D', throttleX + colW / 2, textY);

    ctx.restore();
  }
}
