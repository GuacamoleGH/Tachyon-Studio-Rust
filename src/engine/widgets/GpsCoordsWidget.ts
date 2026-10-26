import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class GpsCoordsWidget implements BaseWidget {
  public id: string = 'gps_coords';
  public type = 'gps_coords' as const;
  public name: string = 'Coordenadas GPS (WGS84)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 100, y: 150, width: 190, height: 80 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 190, height / 80);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const titleFontSize = Math.max(8, Math.round(10 * scale));
    const textFontSize = Math.max(8, Math.round(11 * scale));
    const statusFontSize = Math.max(7, Math.round(9 * scale));

    const lat = snapshot.latitude;
    const lon = snapshot.longitude;
    const hasFix = snapshot.gpsAvailable && lat != null && lon != null;

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
    ctx.fillText('POSICIÓN GPS', x + Math.round(10 * scale), y + Math.round(8 * scale));

    // LED de Estado GPS en la esquina superior derecha
    const ledRadius = Math.max(3, Math.round(4 * scale));
    const ledX = x + width - Math.round(14 * scale);
    const ledY = y + Math.round(13 * scale);

    ctx.beginPath();
    ctx.arc(ledX, ledY, ledRadius, 0, Math.PI * 2);
    ctx.fillStyle = hasFix ? CockpitColors.neonGreen : CockpitColors.neonRed;
    ctx.fill();

    ctx.font = `bold ${statusFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = hasFix ? CockpitColors.neonGreen : CockpitColors.neonRed;
    ctx.textAlign = 'right';
    ctx.fillText(hasFix ? 'FIX 3D' : 'SIN SEÑAL', ledX - Math.round(6 * scale), y + Math.round(8 * scale));

    // Valores de Latitud y Longitud
    const line1Y = y + Math.round(30 * scale);
    const line2Y = y + Math.round(48 * scale);

    ctx.font = `bold ${textFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'left';

    if (hasFix && lat !== null && lon !== null) {
      const latHem = lat >= 0 ? 'N' : 'S';
      const lonHem = lon >= 0 ? 'E' : 'O';
      const latStr = `LAT: ${Math.abs(lat).toFixed(5)}° ${latHem}`;
      const lonStr = `LON: ${Math.abs(lon).toFixed(5)}° ${lonHem}`;

      ctx.fillStyle = CockpitColors.textPrimary;
      ctx.fillText(latStr, x + Math.round(10 * scale), line1Y);
      ctx.fillText(lonStr, x + Math.round(10 * scale), line2Y);

      // Subtexto de precisión / datum
      ctx.font = `bold ${Math.max(6, Math.round(8 * scale))}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('DATUM: WGS84', x + Math.round(10 * scale), y + height - Math.round(8 * scale));
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('LAT: --.-----°', x + Math.round(10 * scale), line1Y);
      ctx.fillText('LON: --.-----°', x + Math.round(10 * scale), line2Y);

      ctx.font = `bold ${Math.max(6, Math.round(8 * scale))}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.neonRed;
      ctx.fillText('ESPERANDO SATÉLITES...', x + Math.round(10 * scale), y + height - Math.round(8 * scale));
    }

    ctx.restore();
  }
}
