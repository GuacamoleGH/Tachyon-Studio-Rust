import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class CompassWidget implements BaseWidget {
  public id: string = 'compass';
  public type = 'compass' as const;
  public name: string = 'Brújula / Rumbo GPS';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 450, y: 150, width: 120, height: 120 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 120, height / 120);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const titleFontSize = Math.max(7, Math.round(9 * scale));
    const degFontSize = Math.max(9, Math.round(13 * scale));
    const cardinalFontSize = Math.max(8, Math.round(11 * scale));

    const bearing = snapshot.bearingAvailable && snapshot.bearingDeg !== null ? snapshot.bearingDeg : null;

    // Calcular dirección cardinal
    let cardinal = 'N/D';
    if (bearing !== null) {
      const b = (bearing % 360 + 360) % 360;
      if (b >= 337.5 || b < 22.5) cardinal = 'N';
      else if (b < 67.5) cardinal = 'NE';
      else if (b < 112.5) cardinal = 'E';
      else if (b < 157.5) cardinal = 'SE';
      else if (b < 202.5) cardinal = 'S';
      else if (b < 247.5) cardinal = 'SW';
      else if (b < 292.5) cardinal = 'W';
      else cardinal = 'NW';
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

    // Título
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('RUMBO GPS', x + width / 2, y + Math.round(6 * scale));

    const cx = x + width / 2;
    const cy = y + height / 2 + Math.round(4 * scale);
    const radius = Math.min(width, height) / 2 - Math.round(18 * scale);

    // Círculo de la brújula
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(44, 57, 71, 0.6)';
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    if (bearing !== null) {
      const rad = ((bearing - 90) * Math.PI) / 180;
      const arrowLen = radius * 0.75;
      const nx = cx + Math.cos(rad) * arrowLen;
      const ny = cy + Math.sin(rad) * arrowLen;

      // Aguja de brújula (Norte apunta a nx, ny)
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = CockpitColors.neonRed;
      ctx.lineWidth = Math.max(2, Math.round(2.5 * scale));
      ctx.stroke();

      // Extremo opuesto (Sur)
      const sx = cx - Math.cos(rad) * (arrowLen * 0.5);
      const sy = cy - Math.sin(rad) * (arrowLen * 0.5);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = CockpitColors.textSecondary;
      ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));
      ctx.stroke();

      // Punto central
      ctx.beginPath();
      ctx.arc(cx, cy, 3 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Texto de grados y cardinal
      ctx.font = `bold ${degFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${Math.round(bearing)}° ${cardinal}`, cx, y + height - Math.round(6 * scale));
    } else {
      ctx.font = `bold ${cardinalFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N/D', cx, cy);
    }

    ctx.restore();
  }
}
