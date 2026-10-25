import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class SpeedGraphWidget implements BaseWidget {
  public id: string = 'speed_graph';
  public type = 'speed_graph' as const;
  public name: string = 'Gráfica de Velocidad / Tiempo';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 540, y: 150, width: 220, height: 150 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, allPoints, timeSec } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 480, height / 110);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const titleFontSize = Math.max(8, Math.round(10 * scale));

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Título
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.fillText('PERFIL DE VELOCIDAD', x + Math.round(10 * scale), y + Math.round(15 * scale));

    if (!allPoints || allPoints.length === 0) {
      const emptyFontSize = Math.max(9, Math.round(11 * scale));
      ctx.font = `bold ${emptyFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText('Sin datos', x + width / 2, y + height / 2);
      ctx.restore();
      return;
    }

    const tMin = allPoints[0].time_offset_video_sec;
    const tMax = allPoints[allPoints.length - 1].time_offset_video_sec;
    const tSpan = Math.max(1, tMax - tMin);

    // Calcular velocidad máxima
    let maxSpd = 50;
    for (let i = 0; i < allPoints.length; i++) {
      const spd = allPoints[i].gps_speed_kmh ?? allPoints[i].obd_speed_kmh;
      if (spd != null && spd > maxSpd) maxSpd = spd;
    }
    maxSpd = Math.ceil(maxSpd / 20) * 20;

    const padX = Math.max(8, Math.round(14 * scale));
    const padY = Math.max(14, Math.round(22 * scale));
    const graphW = width - padX * 2;
    const graphH = height - padY - Math.max(6, Math.round(10 * scale));
    const graphX = x + padX;
    const graphY = y + padY;

    // Líneas guía horizontales
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(44, 57, 71, 0.5)';
    ctx.lineWidth = Math.max(0.75, Math.round(1 * scale));
    for (let s = 0; s <= maxSpd; s += maxSpd / 2) {
      const lineY = graphY + graphH - (s / maxSpd) * graphH;
      ctx.moveTo(graphX, lineY);
      ctx.lineTo(graphX + graphW, lineY);
    }
    ctx.stroke();

    // Curva de velocidad
    ctx.beginPath();
    let started = false;

    for (let i = 0; i < allPoints.length; i++) {
      const p = allPoints[i];
      const spd = p.gps_speed_kmh ?? p.obd_speed_kmh;
      if (spd != null) {
        const px = graphX + ((p.time_offset_video_sec - tMin) / tSpan) * graphW;
        const py = graphY + graphH - (spd / maxSpd) * graphH;
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
    }
    ctx.strokeStyle = CockpitColors.neonGreen;
    ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));
    ctx.stroke();

    // Cursor vertical del tiempo actual
    if (timeSec >= tMin && timeSec <= tMax) {
      const cursorX = graphX + ((timeSec - tMin) / tSpan) * graphW;
      ctx.beginPath();
      ctx.moveTo(cursorX, graphY);
      ctx.lineTo(cursorX, graphY + graphH);
      ctx.strokeStyle = CockpitColors.neonCyan;
      ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
      ctx.stroke();

      // Indicador luminoso en la cabecera del cursor
      ctx.beginPath();
      ctx.arc(cursorX, graphY, Math.max(2, Math.round(3 * scale)), 0, Math.PI * 2);
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.fill();
    }

    ctx.restore();
  }
}
