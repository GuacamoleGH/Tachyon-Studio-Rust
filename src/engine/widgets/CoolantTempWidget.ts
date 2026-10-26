import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class CoolantTempWidget implements BaseWidget {
  public id: string = 'coolant_temp';
  public type = 'coolant_temp' as const;
  public name: string = 'Temperatura de Refrigerante';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 30, y: 150, width: 140, height: 62 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, unitSystem } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 140, height / 62);
    const cornerRadius = Math.max(3, Math.round(8 * scale));

    const padX = Math.max(8, Math.round(10 * scale));
    const padY = Math.max(5, Math.round(7 * scale));
    const barH = Math.max(3, Math.round(5 * scale));
    const barY = y + height - padY - barH;
    const availableH = Math.max(20, barY - y - padY);

    const titleFontSize = Math.max(9, Math.round(Math.min(width * 0.09, availableH * 0.28)));
    const valFontSize = Math.max(20, Math.round(Math.min(width * 0.35, availableH * 0.62)));
    const unitFontSize = Math.max(10, Math.round(valFontSize * 0.44));

    const coolantSignal = snapshot.signals.coolant_temp_c;
    const isAvailable = coolantSignal?.isAvailable && coolantSignal.value !== null;
    const tempC = isAvailable ? coolantSignal.value! : null;

    const isImperial = unitSystem === 'imperial';
    const displayVal = tempC !== null ? (isImperial ? (tempC * 9) / 5 + 32 : tempC) : null;
    const unitLabel = isImperial ? '°F' : '°C';

    // Determinar estado térmico y etiqueta informativa
    let statusColor: string = CockpitColors.neonCyan;
    let statusLabel = 'FRÍO';
    if (tempC !== null) {
      if (tempC < 70) {
        statusColor = CockpitColors.neonCyan; // Motor frío
        statusLabel = 'FRÍO';
      } else if (tempC <= 102) {
        statusColor = CockpitColors.neonGreen; // Temperatura óptima de trabajo
        statusLabel = 'ÓPTIMO';
      } else if (tempC <= 112) {
        statusColor = CockpitColors.neonAmber; // Advertencia calor
        statusLabel = 'ALTO';
      } else {
        statusColor = CockpitColors.neonRed; // Peligro sobrecalentamiento
        statusLabel = 'PELIGRO';
      }
    }

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.88)';
    ctx.fill();
    ctx.strokeStyle = tempC && tempC > 110 ? CockpitColors.neonRed : CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Título
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('TEMP REFRIGERANTE', x + padX, y + padY);

    // Estado en la esquina superior derecha si hay suficiente ancho
    if (width > 160) {
      const badgeFontSize = Math.max(8, Math.round(titleFontSize * 0.9));
      ctx.font = `bold ${badgeFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = statusColor;
      ctx.textAlign = 'right';
      ctx.fillText(`[ ${statusLabel} ]`, x + width - padX, y + padY);
    }

    // Valor numérico posicionado de forma equilibrada ocupando el centro vertical
    ctx.font = `900 ${valFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const valBaseY = barY - Math.max(3, Math.round(5 * scale));

    if (displayVal !== null) {
      ctx.fillStyle = statusColor;
      const valStr = `${Math.round(displayVal)}`;
      ctx.fillText(valStr, x + padX, valBaseY);

      // Unidad (anclada tras el número con separación proporcionada)
      const valW = ctx.measureText(valStr).width;
      ctx.font = `bold ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textSecondary;
      ctx.fillText(unitLabel, x + padX + valW + Math.round(4 * scale), valBaseY);
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', x + padX, valBaseY);
    }

    // Mini barra horizontal de nivel en la parte inferior
    const barPadX = padX;
    const barW = width - barPadX * 2;

    ctx.beginPath();
    ctx.roundRect(x + barPadX, barY, barW, barH, 2);
    ctx.fillStyle = CockpitColors.cardBg;
    ctx.fill();

    if (tempC !== null) {
      // Normalizar 40°C a 120°C
      const ratio = Math.max(0, Math.min(1, (tempC - 40) / (120 - 40)));
      ctx.beginPath();
      ctx.roundRect(x + barPadX, barY, barW * ratio, barH, 2);
      ctx.fillStyle = statusColor;
      ctx.fill();
    }

    ctx.restore();
  }
}
