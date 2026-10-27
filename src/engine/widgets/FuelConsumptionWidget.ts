import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class FuelConsumptionWidget implements BaseWidget {
  public id: string = 'fuel_consumption';
  public type = 'fuel_consumption' as const;
  public name: string = 'Consumo de Combustible (L/100km)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 100, y: 305, width: 140, height: 75 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, unitSystem } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 140, height / 75);
    const cornerRadius = Math.max(3, Math.round(8 * scale));

    const padX = Math.max(8, Math.round(10 * scale));
    const padY = Math.max(5, Math.round(7 * scale));
    const barH = Math.max(3, Math.round(5 * scale));
    const barY = y + height - padY - barH;
    const availableH = Math.max(20, barY - y - padY);

    const titleFontSize = Math.max(9, Math.round(Math.min(width * 0.11, availableH * 0.28)));
    const valFontSize = Math.max(18, Math.round(Math.min(width * 0.32, availableH * 0.60)));
    const unitFontSize = Math.max(8, Math.round(valFontSize * 0.42));

    const isImperial = unitSystem === 'imperial';
    const fuelVal = snapshot.fuelL100km ?? null;
    const isAvailable = Boolean(snapshot.fuelAvailable && fuelVal !== null);

    // Convertir a MPG si es imperial (235.214 / L_100km)
    let displayVal: number | null = null;
    let unitStr = 'L/100KM';
    if (fuelVal !== null) {
      if (isImperial) {
        displayVal = fuelVal > 0 ? Math.min(99.9, 235.2145 / fuelVal) : 99.9;
        unitStr = 'MPG';
      } else {
        displayVal = fuelVal;
        unitStr = 'L/100KM';
      }
    }

    // Color de eficiencia
    let statusColor: string = CockpitColors.neonGreen;
    let statusLabel = 'ECO';
    if (fuelVal !== null) {
      if (fuelVal < 7.0) {
        statusColor = CockpitColors.neonGreen;
        statusLabel = 'ECO';
      } else if (fuelVal <= 14.0) {
        statusColor = CockpitColors.neonAmber;
        statusLabel = 'MEDIO';
      } else {
        statusColor = CockpitColors.neonRed;
        statusLabel = 'ALTO';
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

    // Título y badge sin colisión
    const fullTitle = 'CONSUMO';
    const badgeText = `[ ${statusLabel} ]`;

    const badgeFontSize = Math.max(8, Math.round(titleFontSize * 0.88));
    ctx.font = `bold ${badgeFontSize}px ui-monospace, SFMono-Regular, monospace`;
    const badgeW = ctx.measureText(badgeText).width;

    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    const fullTitleW = ctx.measureText(fullTitle).width;
    const availableTopW = width - padX * 2;
    const showBadge = fullTitleW + badgeW + 10 <= availableTopW;

    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(fullTitle, x + padX, y + padY);

    if (showBadge) {
      ctx.font = `bold ${badgeFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = statusColor;
      ctx.textAlign = 'right';
      ctx.fillText(badgeText, x + width - padX, y + padY);
    }

    // Valor numérico
    ctx.font = `900 ${valFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const valBaseY = barY - Math.max(3, Math.round(5 * scale));

    if (isAvailable && displayVal !== null) {
      ctx.fillStyle = statusColor;
      const valStr = displayVal.toFixed(1);
      ctx.fillText(valStr, x + padX, valBaseY);

      // Unidad
      const valW = ctx.measureText(valStr).width;
      ctx.font = `bold ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textSecondary;
      ctx.fillText(unitStr, x + padX + valW + Math.round(4 * scale), valBaseY);
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', x + padX, valBaseY);
    }

    // Barra de consumo (0 a 25 L/100km normalizada)
    const barW = width - padX * 2;
    ctx.beginPath();
    ctx.roundRect(x + padX, barY, barW, barH, 2);
    ctx.fillStyle = CockpitColors.cardBg;
    ctx.fill();

    if (fuelVal !== null) {
      const ratio = Math.max(0, Math.min(1, fuelVal / 25.0));
      ctx.beginPath();
      ctx.roundRect(x + padX, barY, barW * ratio, barH, 2);
      ctx.fillStyle = statusColor;
      ctx.fill();
    }

    ctx.restore();
  }
}
