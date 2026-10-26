import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class GearIndicatorWidget implements BaseWidget {
  public id: string = 'gear_indicator';
  public type = 'gear_indicator' as const;
  public name: string = 'Indicador de Marcha (Gear)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 260, y: 440, width: 80, height: 100 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, profile } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 80, height / 100);
    const cornerRadius = Math.max(4, Math.round(8 * scale));
    const titleFontSize = Math.max(9, Math.round(Math.min(width * 0.18, height * 0.13)));
    // La marcha debe ser enorme y ocupar la mayor parte del widget (estilo pantalla GT3 / competición)
    const gearFontSize = Math.max(32, Math.round(Math.min(width * 0.75, height * 0.64)));

    const rpm = snapshot.rpm;
    const speed = snapshot.speedKmh;
    const isRpmAvailable = snapshot.rpmAvailable && rpm !== null;
    const isSpeedAvailable = snapshot.speedAvailable && speed !== null;

    let gearStr = 'N/D';
    let isRedline = false;

    if (isRpmAvailable && isSpeedAvailable) {
      if (rpm! >= profile.rpm.redline_start) {
        isRedline = true;
      }

      if (speed! < 2.5) {
        gearStr = rpm! > 400 ? 'N' : '0';
      } else {
        // Estimación de marcha a partir de la relación de transmisión (RPM / Velocidad km/h)
        const ratio = rpm! / Math.max(1, speed!);
        if (ratio > 80) gearStr = '1';
        else if (ratio > 52) gearStr = '2';
        else if (ratio > 38) gearStr = '3';
        else if (ratio > 29) gearStr = '4';
        else if (ratio > 22) gearStr = '5';
        else gearStr = '6';
      }
    }

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.88)';
    ctx.fill();
    ctx.strokeStyle = isRedline ? CockpitColors.neonRed : CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Título "GEAR"
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('GEAR', x + width / 2, y + Math.max(5, Math.round(6 * scale)));

    // Marcha principal (grande y clara)
    ctx.font = `900 ${gearFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (gearStr === 'N/D') {
      ctx.fillStyle = CockpitColors.textMuted;
    } else if (isRedline) {
      ctx.fillStyle = CockpitColors.neonRed;
      ctx.shadowColor = CockpitColors.neonRed;
      ctx.shadowBlur = 12 * scale;
    } else if (gearStr === 'N') {
      ctx.fillStyle = CockpitColors.neonAmber;
    } else {
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.shadowColor = 'rgba(0, 229, 255, 0.4)';
      ctx.shadowBlur = 8 * scale;
    }

    const gearCenterY = y + height * 0.58;
    ctx.fillText(gearStr, x + width / 2, gearCenterY);

    ctx.restore();
  }
}
