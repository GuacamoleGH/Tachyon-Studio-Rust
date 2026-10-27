import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class BoostWidget implements BaseWidget {
  public id: string = 'boost';
  public type = 'boost' as const;
  public name: string = 'Presión de Turbo (Boost)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 100, y: 220, width: 140, height: 75 }) {
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
    const unitFontSize = Math.max(9, Math.round(valFontSize * 0.45));

    const isImperial = unitSystem === 'imperial';
    const boostVal = snapshot.boostBar ?? null;
    const isAvailable = Boolean(snapshot.boostAvailable && boostVal !== null);

    // Convertir bar a psi si es imperial (1 bar = 14.5038 psi)
    const displayVal = boostVal !== null ? (isImperial ? boostVal * 14.5038 : boostVal) : null;
    const unitStr = isImperial ? 'PSI' : 'BAR';

    // Determinar color de presión según carga
    let statusColor: string = CockpitColors.neonCyan;
    let statusLabel = 'ATM';
    if (boostVal !== null) {
      if (boostVal < -0.1) {
        statusColor = CockpitColors.textSecondary; // Vacío en admisión
        statusLabel = 'VACÍO';
      } else if (boostVal <= 0.2) {
        statusColor = CockpitColors.neonCyan; // Presión atmosférica / ralentí
        statusLabel = 'ATM';
      } else if (boostVal <= 1.2) {
        statusColor = CockpitColors.neonGreen; // Sobrealimentación normal
        statusLabel = 'BOOST';
      } else {
        statusColor = CockpitColors.neonRed; // Alta sobrealimentación
        statusLabel = 'PEAK';
      }
    }

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.88)';
    ctx.fill();
    ctx.strokeStyle = boostVal && boostVal > 1.3 ? CockpitColors.neonRed : CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Medición exacta para garantizar que nunca colisionen título y estado
    const fullTitle = 'TURBO / BOOST';
    const shortTitle = 'TURBO';
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
    } else {
      titleToRender = shortTitle;
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

    // Valor numérico de presión con signo (+0.45 bar o -0.65 bar)
    ctx.font = `900 ${valFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const valBaseY = barY - Math.max(3, Math.round(5 * scale));

    if (isAvailable && displayVal !== null) {
      ctx.fillStyle = statusColor;
      const sign = displayVal > 0 ? '+' : '';
      const valStr = `${sign}${displayVal.toFixed(2)}`;
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

    // Mini barra horizontal inferior (-1.0 a +2.0 bar normalizada)
    const barW = width - padX * 2;
    ctx.beginPath();
    ctx.roundRect(x + padX, barY, barW, barH, 2);
    ctx.fillStyle = CockpitColors.cardBg;
    ctx.fill();

    if (boostVal !== null) {
      // Mapear de -1 bar a +2.0 bar (rango común)
      const ratio = Math.max(0, Math.min(1, (boostVal - -1.0) / 3.0));
      ctx.beginPath();
      ctx.roundRect(x + padX, barY, barW * ratio, barH, 2);
      ctx.fillStyle = statusColor;
      ctx.fill();
    }

    ctx.restore();
  }
}
