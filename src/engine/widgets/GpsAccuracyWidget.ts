import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class GpsAccuracyWidget implements BaseWidget {
  public id: string = 'gps_accuracy';
  public type = 'gps_accuracy' as const;
  public name: string = 'Precisión Satelital (GNSS / GPS)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 1065, y: 165, width: 140, height: 60 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, unitSystem } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 140, height / 60);
    const cornerRadius = Math.max(3, Math.round(6 * scale));
    const pad = Math.max(6, Math.round(8 * scale));

    const titleFontSize = Math.max(8, Math.round(Math.min(width * 0.10, height * 0.22)));
    const valFontSize = Math.max(16, Math.round(Math.min(width * 0.28, height * 0.48)));
    const unitFontSize = Math.max(8, Math.round(valFontSize * 0.44));

    const accM = snapshot.accuracyM ?? null;
    const isAvail = Boolean(snapshot.accuracyAvailable && accM !== null);

    const isImperial = unitSystem === 'imperial';
    const displayAcc = accM !== null ? (isImperial ? accM * 3.28084 : accM) : null;
    const unitStr = isImperial ? 'FT' : 'M';

    // Determinar calidad de señal (1 a 4 barras)
    let signalBars = 0;
    let statusColor: string = CockpitColors.textMuted;
    let statusLabel = 'SIN FIX';

    if (accM !== null) {
      if (accM < 2.5) {
        signalBars = 4;
        statusColor = CockpitColors.neonGreen;
        statusLabel = 'ALTA';
      } else if (accM < 5.0) {
        signalBars = 3;
        statusColor = CockpitColors.neonCyan;
        statusLabel = 'BUENA';
      } else if (accM < 10.0) {
        signalBars = 2;
        statusColor = CockpitColors.neonAmber;
        statusLabel = 'MEDIA';
      } else {
        signalBars = 1;
        statusColor = CockpitColors.neonRed;
        statusLabel = 'BAJA';
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

    // Título y barras de señal
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('PRECISIÓN GPS', x + pad, y + pad);

    // Dibujar 4 barritas de señal en la esquina superior derecha
    const barBaseX = x + width - pad - Math.round(20 * scale);
    const barBaseY = y + pad + Math.round(10 * scale);
    const barWidth = Math.max(2, Math.round(3 * scale));
    const barGap = Math.max(1, Math.round(2 * scale));

    for (let b = 1; b <= 4; b++) {
      const bh = Math.round(b * 2.6 * scale);
      const bx = barBaseX + (b - 1) * (barWidth + barGap);
      const by = barBaseY - bh;
      ctx.fillStyle = b <= signalBars ? statusColor : 'rgba(44, 57, 71, 0.5)';
      ctx.fillRect(bx, by, barWidth, bh);
    }

    // Valor numérico
    const valBaseY = y + height - Math.max(6, Math.round(8 * scale));
    ctx.font = `900 ${valFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (isAvail && displayAcc !== null) {
      ctx.fillStyle = statusColor;
      const valStr = `±${displayAcc.toFixed(1)}`;
      ctx.fillText(valStr, x + pad, valBaseY);

      // Unidad
      const valW = ctx.measureText(valStr).width;
      ctx.font = `bold ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textSecondary;
      ctx.fillText(unitStr, x + pad + valW + Math.round(4 * scale), valBaseY);

      // Etiqueta de estado a la derecha
      ctx.font = `bold ${Math.max(8, Math.round(unitFontSize * 0.95))}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = statusColor;
      ctx.textAlign = 'right';
      ctx.fillText(`[ ${statusLabel} ]`, x + width - pad, valBaseY);
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', x + pad, valBaseY);
    }

    ctx.restore();
  }
}
