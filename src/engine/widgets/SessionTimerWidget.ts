import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class SessionTimerWidget implements BaseWidget {
  public id: string = 'session_timer';
  public type = 'session_timer' as const;
  public name: string = 'Cronómetro de Sesión / Tiempo';
  public bounds: WidgetBounds;
  public visible: boolean = true;
  public label: string = 'TIEMPO';

  constructor(bounds: WidgetBounds = { x: 35, y: 25, width: 140, height: 44 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, timeSec } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 140, height / 44);
    const cornerRadius = Math.max(3, Math.round(6 * scale));
    const labelFontSize = Math.max(7, Math.round(8 * scale));
    const timeFontSize = Math.max(14, Math.round(20 * scale));

    const totalSeconds = Math.max(0, timeSec);
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds % 1) * 10);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;

    ctx.save();

    // Fondo
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.88)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Etiqueta superior
    ctx.font = `bold ${labelFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.label, x + width / 2, y + Math.max(3, Math.round(4 * scale)));

    // Texto de tiempo grande
    ctx.font = `bold ${timeFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.neonGreen;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, x + width / 2, y + height * 0.65);

    ctx.restore();
  }
}
