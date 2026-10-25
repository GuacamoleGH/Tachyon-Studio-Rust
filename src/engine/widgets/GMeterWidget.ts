import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class GMeterWidget implements BaseWidget {
  public id: string = 'g_meter';
  public type = 'g_meter' as const;
  public name: string = 'G-Meter (Círculo de Kamm)';
  public bounds: WidgetBounds;
  public visible: boolean = true;
  public maxScaleG: number = 1.5;
  public preferredLongSource: 'IMU' | 'GPS' = 'IMU';

  constructor(bounds: WidgetBounds = { x: 740, y: 310, width: 140, height: 140 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot } = context;
    const { x, y, width, height } = this.bounds;

    const latG = snapshot.lateralG;
    const longG =
      this.preferredLongSource === 'GPS' && snapshot.derivedGpsLongGAvailable
        ? snapshot.derivedGpsLongG
        : snapshot.longitudinalG;

    const isAvailable =
      snapshot.lateralGAvailable &&
      latG !== null &&
      longG !== null &&
      (this.preferredLongSource === 'GPS' ? snapshot.derivedGpsLongGAvailable : snapshot.longitudinalGAvailable);

    const cx = x + width / 2;
    const cy = y + height / 2;
    const scale = Math.min(width, height) / 145;
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const maxRadius = Math.min(width, height) / 2 - Math.max(8, Math.round(14 * scale));

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Ejes de coordenadas
    ctx.beginPath();
    ctx.moveTo(cx - maxRadius, cy);
    ctx.lineTo(cx + maxRadius, cy);
    ctx.moveTo(cx, cy - maxRadius);
    ctx.lineTo(cx, cy + maxRadius);
    ctx.strokeStyle = 'rgba(44, 57, 71, 0.7)';
    ctx.lineWidth = Math.max(1, Math.round(1 * scale));
    ctx.stroke();

    // Círculos de escala 0.5G y 1.0G
    const r05 = (0.5 / this.maxScaleG) * maxRadius;
    const r10 = (1.0 / this.maxScaleG) * maxRadius;

    ctx.beginPath();
    ctx.arc(cx, cy, r05, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(44, 57, 71, 0.6)';
    ctx.lineWidth = Math.max(0.75, Math.round(1 * scale));
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(61, 79, 99, 0.8)';
    ctx.lineWidth = Math.max(0.75, Math.round(1 * scale));
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Bolita de fuerza G
    if (isAvailable && latG !== null && longG !== null) {
      const latNorm = Math.max(-1, Math.min(1, latG / this.maxScaleG));
      const longNorm = Math.max(-1, Math.min(1, longG / this.maxScaleG));

      const dotX = cx + latNorm * maxRadius;
      const dotY = cy - longNorm * maxRadius; // Arriba = aceleración positiva

      const outerDotR = Math.max(4, Math.round(7 * scale));
      const innerDotR = Math.max(2, Math.round(3 * scale));

      ctx.beginPath();
      ctx.arc(dotX, dotY, outerDotR, 0, Math.PI * 2);
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dotX, dotY, innerDotR, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Textos numéricos
      const textFontSize = Math.max(8, Math.round(10 * scale));
      ctx.font = `bold ${textFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.textAlign = 'left';
      ctx.fillText(`Lat: ${latG >= 0 ? '+' : ''}${latG.toFixed(2)}G`, x + Math.round(8 * scale), y + Math.round(16 * scale));

      ctx.fillStyle = CockpitColors.neonGreen;
      ctx.fillText(`Lon: ${longG >= 0 ? '+' : ''}${longG.toFixed(2)}G`, x + Math.round(8 * scale), y + Math.round(28 * scale));
    } else {
      // Estado N/D
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(3, Math.round(5 * scale)), 0, Math.PI * 2);
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fill();

      const ndFontSize = Math.max(9, Math.round(11 * scale));
      ctx.font = `bold ${ndFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText('N/D', cx, cy + Math.round(18 * scale));
    }

    ctx.restore();
  }
}
