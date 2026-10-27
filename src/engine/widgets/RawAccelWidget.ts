import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class RawAccelWidget implements BaseWidget {
  public id: string = 'imu_raw';
  public type = 'imu_raw' as const;
  public name: string = 'Aceleración Bruta IMU 3D (X, Y, Z)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 300, y: 350, width: 170, height: 95 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 170, height / 95);
    const cornerRadius = Math.max(3, Math.round(6 * scale));
    const pad = Math.max(6, Math.round(8 * scale));

    const titleFontSize = Math.max(8, Math.round(Math.min(width * 0.08, height * 0.14)));
    const rowFontSize = Math.max(9, Math.round(Math.min(width * 0.09, height * 0.16)));

    const ax = snapshot.accelX ?? null;
    const ay = snapshot.accelY ?? null;
    const az = snapshot.accelZ ?? null;

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
    ctx.fillText('ACEL. IMU 3D (m/s²)', x + pad, y + pad);

    // Ejes X, Y, Z
    const axes = [
      { name: 'X', val: ax, color: CockpitColors.neonCyan },
      { name: 'Y', val: ay, color: CockpitColors.neonGreen },
      { name: 'Z', val: az, color: CockpitColors.neonAmber },
    ];

    const topOffset = y + pad + titleFontSize + Math.round(6 * scale);
    const rowHeight = (height - (topOffset - y) - pad) / 3;

    // Área delimitada para la barra horizontal en la mitad derecha del widget
    const barLeft = x + width * 0.48;
    const barRight = x + width - pad;
    const barCenter = (barLeft + barRight) / 2;
    const maxBarHalfW = (barRight - barLeft) / 2;

    axes.forEach((axis, i) => {
      const rowY = topOffset + i * rowHeight + rowHeight / 2;

      // Letra del eje
      ctx.font = `900 ${rowFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = axis.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(axis.name, x + pad, rowY);

      // Valor numérico (alineado a la derecha antes del inicio de la barra, sin solaparse nunca)
      ctx.font = `bold ${rowFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = axis.val !== null ? '#F0F4F8' : CockpitColors.textMuted;
      ctx.textAlign = 'right';
      const valStr = axis.val !== null ? (axis.val >= 0 ? `+${axis.val.toFixed(1)}` : axis.val.toFixed(1)) : 'N/D';
      ctx.fillText(valStr, barLeft - Math.round(5 * scale), rowY);

      // Mini barra centrada en 0 (-15 a +15 m/s²)
      const barH = Math.max(2, Math.round(3.5 * scale));
      ctx.fillStyle = CockpitColors.cardBg;
      ctx.fillRect(barLeft, rowY - barH / 2, barRight - barLeft, barH);

      // Marca de centro
      ctx.fillStyle = CockpitColors.border;
      ctx.fillRect(barCenter - 0.5, rowY - barH - 1, 1, barH * 2 + 2);

      if (axis.val !== null) {
        const ratio = Math.max(-1, Math.min(1, axis.val / 15.0));
        ctx.fillStyle = axis.color;
        if (ratio >= 0) {
          ctx.fillRect(barCenter, rowY - barH / 2, maxBarHalfW * ratio, barH);
        } else {
          const w = maxBarHalfW * Math.abs(ratio);
          ctx.fillRect(barCenter - w, rowY - barH / 2, w, barH);
        }
      }
    });

    ctx.restore();
  }
}
