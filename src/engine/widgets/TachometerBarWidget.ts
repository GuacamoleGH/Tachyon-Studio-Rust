import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class TachometerBarWidget implements BaseWidget {
  public id: string = 'tachometer_bar';
  public type = 'tachometer_bar' as const;
  public name: string = 'Tacómetro de Barra Horizontal GT';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 310, y: 520, width: 380, height: 45 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, profile } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 380, height / 45);
    const cornerRadius = Math.max(3, Math.round(6 * scale));
    const titleFontSize = Math.max(8, Math.round(10 * scale));
    const digitalFontSize = Math.max(11, Math.round(14 * scale));

    const rpmConfig = profile.rpm;
    const scaleMax = rpmConfig.scale_max;
    const redlineStart = rpmConfig.redline_start;

    const rawRpm = snapshot.rpm;
    const isAvailable = snapshot.rpmAvailable && rawRpm !== null;
    const displayRpm = isAvailable ? Math.min(scaleMax, Math.max(0, rawRpm!)) : 0;
    const isRedline = isAvailable && rawRpm! >= redlineStart;

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.9)';
    ctx.fill();
    ctx.strokeStyle = isRedline ? CockpitColors.neonRed : CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Cabecera: Título "RPM" a la izquierda, lectura digital a la derecha
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('RPM x1000', x + Math.round(10 * scale), y + Math.round(5 * scale));

    ctx.font = `bold ${digitalFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'right';
    if (isAvailable) {
      ctx.fillStyle = isRedline ? CockpitColors.neonRed : CockpitColors.textPrimary;
      ctx.fillText(`${Math.round(rawRpm!)}`, x + width - Math.round(10 * scale), y + Math.round(4 * scale));
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', x + width - Math.round(10 * scale), y + Math.round(4 * scale));
    }

    // Barra de RPM
    const padX = Math.round(10 * scale);
    const barX = x + padX;
    const barW = width - padX * 2;
    const barH = Math.max(8, Math.round(15 * scale));
    const barY = y + height - barH - Math.round(6 * scale);

    // Fondo inactivo de la barra
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, Math.max(2, Math.round(3 * scale)));
    ctx.fillStyle = CockpitColors.cardBg;
    ctx.fill();

    // Marcador de zona roja en el fondo
    const redlineRatio = Math.max(0, Math.min(1, redlineStart / scaleMax));
    const redlineX = barX + redlineRatio * barW;
    const redlineW = barW - (redlineRatio * barW);

    ctx.beginPath();
    ctx.roundRect(redlineX, barY, redlineW, barH, Math.max(2, Math.round(3 * scale)));
    ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
    ctx.fill();

    // Relleno activo de RPM
    if (isAvailable && displayRpm > 0) {
      const activeRatio = displayRpm / scaleMax;
      const fillW = activeRatio * barW;

      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, Math.max(2, Math.round(3 * scale)));

      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, CockpitColors.neonGreen);
      grad.addColorStop(0.7, CockpitColors.neonAmber);
      grad.addColorStop(1, CockpitColors.neonRed);

      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Marcas de escala cada 1000 RPM
    const majorTick = rpmConfig.major_tick || 1000;
    const totalTicks = Math.floor(scaleMax / majorTick);
    ctx.strokeStyle = '#090C0E';
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));

    for (let i = 1; i < totalTicks; i++) {
      const tx = barX + (i / totalTicks) * barW;
      ctx.beginPath();
      ctx.moveTo(tx, barY);
      ctx.lineTo(tx, barY + barH);
      ctx.stroke();
    }

    ctx.restore();
  }
}
