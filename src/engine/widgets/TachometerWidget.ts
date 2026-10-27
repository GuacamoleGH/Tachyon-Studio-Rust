import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class TachometerCircularWidget implements BaseWidget {
  public id: string = 'tachometer_circular';
  public type = 'tachometer_circular' as const;
  public name: string = 'Tacómetro Circular';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 30, y: 30, width: 260, height: 260 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, profile } = context;
    const { x, y, width, height } = this.bounds;

    const rpmConfig = profile.rpm;
    const scaleMax = rpmConfig.scale_max;
    const redlineStart = rpmConfig.redline_start;
    const labelDivisor = rpmConfig.label_divisor || 1000;

    const rawRpm = snapshot.rpm;
    const isAvailable = snapshot.rpmAvailable && rawRpm !== null;

    // Si supera el scale_max, limitamos solo el dibujo, sin alterar el dato
    const displayRpm = isAvailable ? Math.min(scaleMax, Math.max(0, rawRpm!)) : 0;

    const cx = x + width / 2;
    const cy = y + height / 2;
    const scale = Math.min(width, height) / 260;
    const radius = Math.min(width, height) / 2 - Math.max(8, Math.round(16 * scale));
    const arcLineWidth = Math.max(5, Math.round(10 * scale));

    // Ángulo de barrido: desde 135° (3*pi/4) hasta 405° (9*pi/4) = 270 grados totales
    const startAngle = (3 * Math.PI) / 4;
    const sweepAngle = (3 * Math.PI) / 2;
    const endAngle = startAngle + sweepAngle;

    ctx.save();

    // Fondo del reloj con esquinas redondeadas o circular
    ctx.beginPath();
    ctx.arc(cx, cy, radius + Math.max(6, Math.round(12 * scale)), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // 1. Arco base de fondo (inactivo)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = CockpitColors.cardBg;
    ctx.lineWidth = arcLineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Arco de Zona Roja (desde redline_start hasta scale_max)
    const redlineRatio = Math.max(0, Math.min(1, redlineStart / scaleMax));
    const redlineAngle = startAngle + redlineRatio * sweepAngle;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, redlineAngle, endAngle);
    ctx.strokeStyle = CockpitColors.neonRed;
    ctx.lineWidth = arcLineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();

    // 3. Arco de RPM activo
    if (isAvailable && displayRpm > 0) {
      const activeRatio = displayRpm / scaleMax;
      const currentAngle = startAngle + activeRatio * sweepAngle;

      const gradient = ctx.createLinearGradient(x, y + height, x + width, y);
      gradient.addColorStop(0, CockpitColors.neonGreen);
      gradient.addColorStop(0.7, CockpitColors.neonAmber);
      gradient.addColorStop(1, CockpitColors.neonRed);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, currentAngle);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = arcLineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 4. Marcas y etiquetas numéricas
    const majorTick = rpmConfig.major_tick || 1000;
    const totalTicks = Math.floor(scaleMax / majorTick);
    const tickFontSize = Math.max(9, Math.round(12 * scale));

    ctx.font = `bold ${tickFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tickInnerOffset = Math.max(8, Math.round(14 * scale));
    const tickOuterOffset = Math.max(3, Math.round(6 * scale));
    const textRadiusOffset = Math.max(16, Math.round(28 * scale));

    for (let i = 0; i <= totalTicks; i++) {
      const tickRpm = i * majorTick;
      const ratio = tickRpm / scaleMax;
      const angle = startAngle + ratio * sweepAngle;

      const innerR = radius - tickInnerOffset;
      const outerR = radius - tickOuterOffset;

      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * outerR;
      const y2 = cy + Math.sin(angle) * outerR;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = tickRpm >= redlineStart ? CockpitColors.neonRed : CockpitColors.textSecondary;
      ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));
      ctx.stroke();

      // Número de la marca
      const textR = radius - textRadiusOffset;
      const tx = cx + Math.cos(angle) * textR;
      const ty = cy + Math.sin(angle) * textR;
      const label = (tickRpm / labelDivisor).toString();

      ctx.fillStyle = tickRpm >= redlineStart ? CockpitColors.neonRed : CockpitColors.textPrimary;
      ctx.fillText(label, tx, ty);
    }

    // 5. Aguja indicadora
    const needleRatio = isAvailable ? displayRpm / scaleMax : 0;
    const needleAngle = startAngle + needleRatio * sweepAngle;
    const needleLen = radius - Math.max(4, Math.round(8 * scale));

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * needleLen, cy + Math.sin(needleAngle) * needleLen);
    ctx.strokeStyle = isAvailable ? CockpitColors.neonCyan : CockpitColors.textMuted;
    ctx.lineWidth = Math.max(2, Math.round(3.5 * scale));
    ctx.lineCap = 'round';
    ctx.stroke();

    // Centro del eje
    const centerRadius = Math.max(4, Math.round(7 * scale));
    ctx.beginPath();
    ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
    ctx.fillStyle = isAvailable ? CockpitColors.neonCyan : CockpitColors.textMuted;
    ctx.fill();

    // 6. Valor numérico digital de RPM en el centro inferior
    const digitalFontSize = Math.max(14, Math.round(22 * scale));
    ctx.font = `bold ${digitalFontSize}px ui-monospace, SFMono-Regular, monospace`;
    const digitalY = cy + Math.round(38 * scale);
    if (isAvailable) {
      ctx.fillStyle = rawRpm! >= redlineStart ? CockpitColors.neonRed : CockpitColors.textPrimary;
      ctx.fillText(`${Math.round(rawRpm!)}`, cx, digitalY);
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', cx, digitalY);
    }

    const subLabelFontSize = Math.max(8, Math.round(10 * scale));
    ctx.font = `bold ${subLabelFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.fillText('RPM x1000', cx, digitalY + Math.round(18 * scale));

    // 7. Indicador de marcha integrado en el tacómetro circular (recuadro superior central)
    const speed = snapshot.speedKmh;
    let gearStr = '-';
    const directGear = snapshot.gear ?? null;
    if (snapshot.gearAvailable && directGear !== null) {
      gearStr = directGear;
    } else if (isAvailable && snapshot.speedAvailable && speed !== null) {
      if (speed < 2.5) {
        gearStr = rawRpm! > 400 ? 'N' : '0';
      } else {
        const ratio = rawRpm! / Math.max(1, speed);
        if (ratio > 80) gearStr = '1';
        else if (ratio > 52) gearStr = '2';
        else if (ratio > 38) gearStr = '3';
        else if (ratio > 29) gearStr = '4';
        else if (ratio > 22) gearStr = '5';
        else gearStr = '6';
      }
    }

    const gearY = cy - Math.round(44 * scale);
    const badgeW = Math.max(24, Math.round(38 * scale));
    const badgeH = Math.max(24, Math.round(36 * scale));
    const badgeRadius = Math.max(4, Math.round(6 * scale));
    const gearFontSize = Math.max(16, Math.round(26 * scale));

    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, gearY - badgeH / 2, badgeW, badgeH, badgeRadius);
    ctx.fillStyle = 'rgba(10, 14, 18, 0.75)';
    ctx.fill();
    ctx.strokeStyle = rawRpm! >= redlineStart ? CockpitColors.neonRed : 'rgba(44, 57, 71, 0.8)';
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    ctx.font = `900 ${gearFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (rawRpm! >= redlineStart) {
      ctx.fillStyle = CockpitColors.neonRed;
    } else if (gearStr === 'N') {
      ctx.fillStyle = CockpitColors.neonAmber;
    } else if (gearStr === '-') {
      ctx.fillStyle = CockpitColors.textMuted;
    } else {
      ctx.fillStyle = CockpitColors.neonCyan;
    }

    ctx.fillText(gearStr, cx, gearY);

    ctx.restore();
  }
}
