import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class TachometerHorizontalWidget implements BaseWidget {
  public id: string = 'tachometer_horizontal';
  public type = 'tachometer_horizontal' as const;
  public name: string = 'Tacómetro Horizontal F1/GT3';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 340, y: 25, width: 600, height: 68 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, profile, unitSystem, timeSec } = context;
    const { x, y, width, height } = this.bounds;

    const scale = Math.min(width / 600, height / 68);
    const cornerRadius = Math.max(3, Math.round(8 * scale));

    const rpm = snapshot.rpm ?? (snapshot.signals.engine_rpm?.value ?? 0);
    const speedKmh = snapshot.speedKmh ?? (snapshot.signals.gps_speed_kmh?.value ?? 0);

    const isImperial = unitSystem === 'imperial';
    const displaySpeed = Math.round(isImperial ? speedKmh * 0.621371 : speedKmh);
    const speedUnit = isImperial ? 'MPH' : 'KM/H';

    const maxRpm = profile.rpm.scale_max || 8000;
    const redlineRpm = profile.rpm.redline_start || maxRpm * 0.85;
    const shiftRpm = profile.shift_lights.flash_rpm || maxRpm * 0.92;

    const isShiftPoint = rpm >= shiftRpm;
    const isFlashActive = isShiftPoint && Math.floor(timeSec * 8) % 2 === 0;

    // Marcha directa OBD o estimación
    let gearText = 'N';
    let gearColor: string = CockpitColors.neonGreen;
    const directGear = snapshot.gear ?? null;
    if (snapshot.gearAvailable && directGear !== null) {
      gearText = directGear;
      gearColor = isShiftPoint ? CockpitColors.neonRed : (gearText === 'N' ? CockpitColors.neonAmber : CockpitColors.neonGreen);
    } else if (speedKmh < 2.5) {
      gearText = rpm > 400 ? 'N' : '-';
      gearColor = CockpitColors.neonAmber;
    } else {
      const ratio = rpm / Math.max(1, speedKmh);
      if (ratio > 80) gearText = '1';
      else if (ratio > 52) gearText = '2';
      else if (ratio > 38) gearText = '3';
      else if (ratio > 29) gearText = '4';
      else if (ratio > 22) gearText = '5';
      else gearText = '6';
      gearColor = isShiftPoint ? CockpitColors.neonRed : CockpitColors.neonGreen;
    }

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    if (isFlashActive) {
      ctx.fillStyle = 'rgba(255, 23, 68, 0.45)';
    } else {
      ctx.fillStyle = 'rgba(19, 24, 30, 0.92)';
    }
    ctx.fill();
    ctx.strokeStyle = isFlashActive ? CockpitColors.neonRed : CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // =========================================================================
    // 1. CAJA DE MARCHA (GEAR) A LA IZQUIERDA
    // =========================================================================
    const gearBoxW = Math.round(56 * scale);
    const gearBoxH = height - Math.round(14 * scale);
    const gearBoxX = x + Math.round(7 * scale);
    const gearBoxY = y + Math.round(7 * scale);

    ctx.beginPath();
    ctx.roundRect(gearBoxX, gearBoxY, gearBoxW, gearBoxH, Math.max(2, Math.round(6 * scale)));
    ctx.fillStyle = 'rgba(9, 12, 14, 0.9)';
    ctx.fill();
    ctx.strokeStyle = isShiftPoint ? CockpitColors.neonRed : 'rgba(44, 57, 71, 0.8)';
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Etiqueta GEAR
    const miniLabelSize = Math.max(6, Math.round(8 * scale));
    ctx.font = `bold ${miniLabelSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('GEAR', gearBoxX + gearBoxW / 2, gearBoxY + Math.round(4 * scale));

    // Valor de la marcha
    const gearFontSize = Math.max(18, Math.round(30 * scale));
    ctx.font = `900 ${gearFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textBaseline = 'middle';

    ctx.fillStyle = gearColor;
    ctx.fillText(gearText, gearBoxX + gearBoxW / 2, gearBoxY + gearBoxH / 2 + Math.round(4 * scale));

    // =========================================================================
    // 2. LECTURA NUMÉRICA DERECHA: VELOCIDAD Y RPM
    // =========================================================================
    const rightBoxW = Math.round(120 * scale);
    const rightBoxX = x + width - rightBoxW - Math.round(8 * scale);

    // Velocidad (Grande)
    ctx.font = `italic 900 ${Math.max(16, Math.round(26 * scale))}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.neonCyan;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(displaySpeed.toString(), rightBoxX + rightBoxW - Math.round(36 * scale), y + Math.round(10 * scale));

    // Unidad KM/H
    ctx.font = `bold ${Math.max(7, Math.round(10 * scale))}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textMuted;
    ctx.textAlign = 'left';
    ctx.fillText(speedUnit, rightBoxX + rightBoxW - Math.round(32 * scale), y + Math.round(14 * scale));

    // RPM Numérico inferior
    ctx.font = `bold ${Math.max(9, Math.round(12 * scale))}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = isShiftPoint ? CockpitColors.neonRed : CockpitColors.textPrimary;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${Math.round(rpm)} RPM`, rightBoxX + rightBoxW - Math.round(4 * scale), y + height - Math.round(10 * scale));

    // =========================================================================
    // 3. BARRA HORIZONTAL DE RPM SEGMENTADA (ESTILO DISPLAY DE CARRERAS)
    // =========================================================================
    const barX = gearBoxX + gearBoxW + Math.round(12 * scale);
    const barW = rightBoxX - barX - Math.round(12 * scale);
    const barH = Math.round(24 * scale);
    const barY = y + (height - barH) / 2;

    const numSegments = 26;
    const gap = Math.max(2, Math.round(3 * scale));
    const segW = (barW - (numSegments - 1) * gap) / numSegments;
    const rpmFrac = Math.max(0, Math.min(1, rpm / maxRpm));
    const activeSegments = Math.round(rpmFrac * numSegments);

    for (let i = 0; i < numSegments; i++) {
      const segX = barX + i * (segW + gap);
      const segFrac = (i + 1) / numSegments;
      const segRpm = segFrac * maxRpm;
      const isActive = i < activeSegments;

      let segColor: string;
      if (segRpm >= shiftRpm) {
        segColor = CockpitColors.neonRed;
      } else if (segRpm >= redlineRpm * 0.85) {
        segColor = CockpitColors.neonAmber;
      } else {
        segColor = CockpitColors.neonGreen;
      }

      ctx.beginPath();
      ctx.roundRect(segX, barY, segW, barH, Math.max(1, Math.round(2 * scale)));
      if (isActive) {
        ctx.fillStyle = segColor;
        ctx.fill();

        // Brillo superior del segmento
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(segX, barY, segW, Math.max(1, Math.round(2 * scale)));
      } else {
        ctx.fillStyle = 'rgba(44, 57, 71, 0.35)';
        ctx.fill();
      }
    }

    // Mini escala de RPM debajo de los segmentos
    const scaleY = barY + barH + Math.round(6 * scale);
    ctx.font = `bold ${Math.max(6, Math.round(8 * scale))}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textMuted;
    ctx.textAlign = 'left';
    ctx.fillText('0', barX, scaleY);
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(maxRpm / 2000)}k`, barX + barW / 2, scaleY);
    ctx.textAlign = 'right';
    ctx.fillStyle = CockpitColors.neonRed;
    ctx.fillText(`${Math.round(maxRpm / 1000)}k`, barX + barW, scaleY);

    ctx.restore();
  }
}
