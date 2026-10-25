import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class CoolantTempWidget implements BaseWidget {
  public id: string = 'coolant_temp';
  public type = 'coolant_temp' as const;
  public name: string = 'Temperatura de Refrigerante';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 30, y: 150, width: 140, height: 75 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, unitSystem } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 140, height / 75);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const titleFontSize = Math.max(8, Math.round(10 * scale));
    const valFontSize = Math.max(14, Math.round(24 * scale));
    const unitFontSize = Math.max(8, Math.round(11 * scale));

    const coolantSignal = snapshot.signals.coolant_temp_c;
    const isAvailable = coolantSignal?.isAvailable && coolantSignal.value !== null;
    const tempC = isAvailable ? coolantSignal.value! : null;

    const isImperial = unitSystem === 'imperial';
    const displayVal = tempC !== null ? (isImperial ? (tempC * 9) / 5 + 32 : tempC) : null;
    const unitLabel = isImperial ? '°F' : '°C';

    // Determinar estado térmico
    let statusColor: string = CockpitColors.neonCyan;
    if (tempC !== null) {
      if (tempC < 70) {
        statusColor = CockpitColors.neonCyan; // Motor frío
      } else if (tempC <= 102) {
        statusColor = CockpitColors.neonGreen; // Temperatura óptima de trabajo
      } else if (tempC <= 112) {
        statusColor = CockpitColors.neonAmber; // Advertencia calor
      } else {
        statusColor = CockpitColors.neonRed; // Peligro sobrecalentamiento
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
    ctx.fillText('TEMP AGUA', x + Math.round(10 * scale), y + Math.round(8 * scale));

    // Valor numérico
    ctx.font = `bold ${valFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textBaseline = 'middle';
    const valY = y + height / 2 + Math.round(4 * scale);

    if (displayVal !== null) {
      ctx.fillStyle = statusColor;
      ctx.fillText(`${Math.round(displayVal)}`, x + Math.round(10 * scale), valY);

      // Unidad
      ctx.font = `bold ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textSecondary;
      ctx.fillText(unitLabel, x + Math.round(62 * scale), valY + Math.round(2 * scale));
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', x + Math.round(10 * scale), valY);
    }

    // Mini barra horizontal de nivel en la parte inferior
    const barPadX = Math.round(10 * scale);
    const barW = width - barPadX * 2;
    const barH = Math.max(3, Math.round(5 * scale));
    const barY = y + height - Math.round(10 * scale);

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
