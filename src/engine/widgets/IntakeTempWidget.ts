import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class IntakeTempWidget implements BaseWidget {
  public id: string = 'intake_temp';
  public type = 'intake_temp' as const;
  public name: string = 'Temp. Aire Admisión (IAT)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 100, y: 390, width: 140, height: 75 }) {
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

    const titleFontSize = Math.max(9, Math.round(Math.min(width * 0.10, availableH * 0.28)));
    const valFontSize = Math.max(18, Math.round(Math.min(width * 0.32, availableH * 0.60)));
    const unitFontSize = Math.max(9, Math.round(valFontSize * 0.44));

    const iatVal = snapshot.intakeTempC ?? null;
    const isAvailable = Boolean(snapshot.intakeTempAvailable && iatVal !== null);

    const isImperial = unitSystem === 'imperial';
    const displayVal = iatVal !== null ? (isImperial ? (iatVal * 9) / 5 + 32 : iatVal) : null;
    const unitLabel = isImperial ? '°F' : '°C';

    let statusColor: string = CockpitColors.neonCyan;
    let statusLabel = 'FRESCO';
    if (iatVal !== null) {
      if (iatVal < 28) {
        statusColor = CockpitColors.neonCyan;
        statusLabel = 'FRESCO';
      } else if (iatVal <= 48) {
        statusColor = CockpitColors.neonGreen;
        statusLabel = 'ÓPTIMO';
      } else if (iatVal <= 62) {
        statusColor = CockpitColors.neonAmber;
        statusLabel = 'ALTO';
      } else {
        statusColor = CockpitColors.neonRed;
        statusLabel = 'CRÍTICO';
      }
    }

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.88)';
    ctx.fill();
    ctx.strokeStyle = iatVal && iatVal > 62 ? CockpitColors.neonRed : CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Medición exacta para garantizar que nunca colisionen título y estado
    const fullTitle = 'TEMP ADMISIÓN (IAT)';
    const shortTitle = 'TEMP IAT';
    const compactTitle = 'IAT';
    const badgeText = `[ ${statusLabel} ]`;

    const badgeFontSize = Math.max(8, Math.round(titleFontSize * 0.88));
    ctx.font = `bold ${badgeFontSize}px ui-monospace, SFMono-Regular, monospace`;
    const badgeW = ctx.measureText(badgeText).width;

    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    const fullTitleW = ctx.measureText(fullTitle).width;
    const shortTitleW = ctx.measureText(shortTitle).width;
    const availableTopW = width - padX * 2;

    let titleToRender = fullTitle;
    let showBadge = false;

    if (fullTitleW + badgeW + 10 <= availableTopW) {
      titleToRender = fullTitle;
      showBadge = true;
    } else if (shortTitleW + badgeW + 10 <= availableTopW) {
      titleToRender = shortTitle;
      showBadge = true;
    } else if (fullTitleW <= availableTopW) {
      titleToRender = fullTitle;
      showBadge = false;
    } else if (shortTitleW <= availableTopW) {
      titleToRender = shortTitle;
      showBadge = false;
    } else {
      titleToRender = compactTitle;
      showBadge = false;
    }

    // Renderizar título
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(titleToRender, x + padX, y + padY);

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
      const valStr = `${Math.round(displayVal)}`;
      ctx.fillText(valStr, x + padX, valBaseY);

      // Unidad
      const valW = ctx.measureText(valStr).width;
      ctx.font = `bold ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textSecondary;
      ctx.fillText(unitLabel, x + padX + valW + Math.round(4 * scale), valBaseY);
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', x + padX, valBaseY);
    }

    // Mini barra horizontal inferior (10°C a 80°C)
    const barW = width - padX * 2;
    ctx.beginPath();
    ctx.roundRect(x + padX, barY, barW, barH, 2);
    ctx.fillStyle = CockpitColors.cardBg;
    ctx.fill();

    if (iatVal !== null) {
      const ratio = Math.max(0, Math.min(1, (iatVal - 10) / (80 - 10)));
      ctx.beginPath();
      ctx.roundRect(x + padX, barY, barW * ratio, barH, 2);
      ctx.fillStyle = statusColor;
      ctx.fill();
    }

    ctx.restore();
  }
}
