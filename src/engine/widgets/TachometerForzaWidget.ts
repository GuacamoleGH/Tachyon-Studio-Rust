import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class TachometerForzaWidget implements BaseWidget {
  public id: string = 'tachometer_forza';
  public type = 'tachometer_forza' as const;
  public name: string = 'Tacómetro Racing (Estilo Forza)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 30, y: 440, width: 280, height: 260 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, profile, unitSystem } = context;
    const { x, y, width, height } = this.bounds;

    const rpmConfig = profile.rpm;
    const scaleMax = rpmConfig.scale_max;
    const redlineStart = rpmConfig.redline_start;
    const labelDivisor = rpmConfig.label_divisor || 1000;

    const rawRpm = snapshot.rpm;
    const isRpmAvailable = snapshot.rpmAvailable && rawRpm !== null;
    const displayRpm = isRpmAvailable ? Math.min(scaleMax, Math.max(0, rawRpm!)) : 0;

    // Velocidad para el velocímetro integrado
    const isImperial = unitSystem === 'imperial';
    let rawSpeed = snapshot.signals.obd_speed_kmh?.isAvailable
      ? snapshot.signals.obd_speed_kmh.value
      : snapshot.speedKmh;
    if (rawSpeed === null && snapshot.speedAvailable) {
      rawSpeed = snapshot.speedKmh;
    }
    const displaySpeed = rawSpeed !== null ? (isImperial ? rawSpeed * 0.621371 : rawSpeed) : null;
    const unitLabel = isImperial ? 'MPH' : 'KM/H';

    // Marcha para el centro (usar marcha directa OBD o estimación)
    let gearStr = '-';
    const isRedline = isRpmAvailable && rawRpm! >= redlineStart;
    const directGear = snapshot.gear ?? null;
    if (snapshot.gearAvailable && directGear !== null) {
      gearStr = directGear;
    } else if (isRpmAvailable && rawSpeed !== null) {
      if (rawSpeed < 2.5) {
        gearStr = rawRpm! > 400 ? 'N' : '0';
      } else {
        const ratio = rawRpm! / Math.max(1, rawSpeed);
        if (ratio > 80) gearStr = '1';
        else if (ratio > 52) gearStr = '2';
        else if (ratio > 38) gearStr = '3';
        else if (ratio > 29) gearStr = '4';
        else if (ratio > 22) gearStr = '5';
        else gearStr = '6';
      }
    }

    // Dimensionado dinámico ajustado para que el tacómetro llene perfectamente el cuadro de selección sin márgenes muertos
    const pad = Math.max(4, Math.round(6 * (Math.min(width, height) / 260)));
    const radius = Math.max(30, Math.min((width - pad * 2) / 2, (height - pad * 2) / 1.76));
    const scale = radius / 110;

    const cx = x + width / 2;
    // Centrado vertical compensando la parte inferior donde se ubica el velocímetro
    const cy = y + pad + radius + Math.max(0, (height - (pad * 2 + radius * 1.76)) / 2);

    // Ángulo de barrido estilo Forza: desde 140° (2.44 rad) hasta 395° (6.89 rad)
    const startAngle = (140 * Math.PI) / 180;
    const sweepAngle = (255 * Math.PI) / 180;
    const endAngle = startAngle + sweepAngle;

    ctx.save();

    // 1. Fondo sutil oscurecido semi-transparente (diseño limpio y minimalista)
    ctx.beginPath();
    ctx.arc(cx, cy, radius + Math.round(6 * scale), startAngle - 0.1, endAngle + 0.1);
    ctx.fillStyle = 'rgba(12, 16, 22, 0.45)';
    ctx.fill();

    // 2. Arco exterior tenue
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));
    ctx.stroke();

    // 3. Arco de Zona Roja
    const redlineRatio = Math.max(0, Math.min(1, redlineStart / scaleMax));
    const redlineAngle = startAngle + redlineRatio * sweepAngle;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, redlineAngle, endAngle);
    ctx.strokeStyle = CockpitColors.neonRed;
    ctx.lineWidth = Math.max(3.5, Math.round(5.5 * scale));
    ctx.lineCap = 'butt';
    ctx.stroke();

    // 4. Marcas graduadas y números del tacómetro
    const majorTick = rpmConfig.major_tick || 1000;
    const totalTicks = Math.floor(scaleMax / majorTick);
    const tickFontSize = Math.max(8, Math.round(11 * scale));

    ctx.font = `600 ${tickFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tickInner = radius - Math.round(8 * scale);
    const tickOuter = radius - Math.round(2 * scale);
    const textRadius = radius - Math.round(18 * scale);

    for (let i = 0; i <= totalTicks; i++) {
      const tickRpm = i * majorTick;
      const ratio = tickRpm / scaleMax;
      const angle = startAngle + ratio * sweepAngle;

      // Línea de graduación
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(cx + cosA * tickInner, cy + sinA * tickInner);
      ctx.lineTo(cx + cosA * tickOuter, cy + sinA * tickOuter);
      ctx.strokeStyle = tickRpm >= redlineStart ? CockpitColors.neonRed : 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
      ctx.stroke();

      // Número de RPM (0, 1, 2, 3...)
      const label = (tickRpm / labelDivisor).toString();
      ctx.fillStyle = tickRpm >= redlineStart ? CockpitColors.neonRed : 'rgba(240, 244, 248, 0.75)';
      ctx.fillText(label, cx + cosA * textRadius, cy + sinA * textRadius);
    }

    // Hash ticks menores (500 RPM)
    for (let i = 0; i < totalTicks; i++) {
      const halfRpm = i * majorTick + majorTick / 2;
      const ratio = halfRpm / scaleMax;
      const angle = startAngle + ratio * sweepAngle;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(cx + cosA * (radius - Math.round(5 * scale)), cy + sinA * (radius - Math.round(5 * scale)));
      ctx.lineTo(cx + cosA * tickOuter, cy + sinA * tickOuter);
      ctx.strokeStyle = halfRpm >= redlineStart ? 'rgba(255, 23, 68, 0.6)' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 5. Aguja indicadora blanca estilizada (origen en el centro exterior del buje)
    const needleRatio = isRpmAvailable ? displayRpm / scaleMax : 0;
    const needleAngle = startAngle + needleRatio * sweepAngle;
    const hubRadius = Math.max(16, Math.round(28 * scale));
    const needleLen = radius - Math.round(4 * scale);

    const needleCos = Math.cos(needleAngle);
    const needleSin = Math.sin(needleAngle);

    ctx.beginPath();
    ctx.moveTo(cx + needleCos * hubRadius, cy + needleSin * hubRadius);
    ctx.lineTo(cx + needleCos * needleLen, cy + needleSin * needleLen);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(2, Math.round(3.5 * scale));
    ctx.lineCap = 'round';
    ctx.stroke();

    // 6. Buje central con la marcha integrada estilo Forza (círculo neon + número)
    // Fondo oscuro del buje
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 20, 26, 0.92)';
    ctx.fill();

    // Aro exterior del buje con color dinámico de marcha / corte
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
    let gearColor: string = CockpitColors.neonGreen;
    if (isRedline) {
      gearColor = CockpitColors.neonRed;
    } else if (gearStr === 'N') {
      gearColor = CockpitColors.neonAmber;
    } else if (gearStr === '-') {
      gearColor = CockpitColors.textMuted;
    }

    ctx.strokeStyle = gearColor;
    ctx.lineWidth = Math.max(1.5, Math.round(2.5 * scale));
    ctx.stroke();

    // Número de marcha en el centro del buje
    const gearFontSize = Math.max(16, Math.round(30 * scale));
    ctx.font = `italic 900 ${gearFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = gearColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gearStr, cx, cy);

    // 7. Velocímetro integrado en la esquina inferior derecha (estilo Forza italic)
    // Desplazado unos píxeles hacia abajo y a la izquierda para dejar totalmente visible el 8 y no tocar la línea roja
    const targetY = cy + Math.round(radius * 0.74);
    const rightX = Math.min(x + width - Math.round(14 * scale), cx + Math.round(radius * 0.96));

    // Unidad en cursiva (KM/H o MPH) a la derecha
    const unitFontSize = Math.max(9, Math.round(13 * scale));
    ctx.font = `italic bold ${unitFontSize}px system-ui, -apple-system, sans-serif`;
    const unitMetrics = ctx.measureText(unitLabel);
    const unitWidth = unitMetrics.width;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(unitLabel, rightX, targetY);

    // Número grande de velocidad en cursiva brillante, inmediatamente a la izquierda de la unidad
    const speedFontSize = Math.max(22, Math.round(40 * scale));
    ctx.font = `italic 900 ${speedFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';

    const numX = rightX - unitWidth - Math.round(5 * scale);
    const speedStr = displaySpeed !== null ? Math.round(displaySpeed).toString() : '0';

    if (displaySpeed !== null) {
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 8 * scale;
      ctx.fillText(speedStr, numX, targetY);
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText(speedStr, numX, targetY);
    }

    ctx.restore();
  }
}
