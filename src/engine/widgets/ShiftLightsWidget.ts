import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class ShiftLightsWidget implements BaseWidget {
  public id: string = 'shift_lights';
  public type = 'shift_lights' as const;
  public name: string = 'Barra de Luces de Cambio (Shift Lights)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 300, y: 30, width: 340, height: 46 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, profile, timeSec } = context;
    const { x, y, width, height } = this.bounds;

    const shiftCfg = profile.shift_lights;
    if (!shiftCfg.enabled) return;

    const rawRpm = snapshot.rpm;
    const isAvailable = snapshot.rpmAvailable && rawRpm !== null;

    const ledCount = shiftCfg.led_count || 10;
    const startRpm = shiftCfg.start_rpm;
    const allOnRpm = shiftCfg.all_on_rpm;
    const flashRpm = shiftCfg.flash_rpm;
    const flashHz = shiftCfg.flash_hz || 8;

    const isShift = isAvailable && rawRpm! >= flashRpm;
    // Parpadeo estroboscópico determinista dependiente únicamente del tiempo de vídeo
    const flashState = (Math.floor(timeSec * flashHz) % 2 === 0);

    const scale = Math.min(width / 340, height / 44);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const paddingX = Math.max(6, Math.round(14 * scale));
    const gap = Math.max(2, Math.round(6 * scale));
    const availableW = width - paddingX * 2;
    const ledW = Math.max(4, (availableW - (ledCount - 1) * gap) / ledCount);
    const ledH = Math.max(6, height - Math.round(16 * scale));
    const ledY = y + (height - ledH) / 2;
    const ledRadius = Math.max(2, Math.round(4 * scale));

    ctx.save();

    // Fondo del panel de shift lights
    ctx.beginPath();
    const borderColor = isShift && flashState ? CockpitColors.neonRed : CockpitColors.border;
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.9)';
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Determinar cuántos LEDs deben encenderse (0 a ledCount)
    let activeLeds = 0;
    if (isAvailable) {
      if (rawRpm! < startRpm) {
        activeLeds = 0;
      } else if (rawRpm! >= allOnRpm) {
        activeLeds = ledCount;
      } else {
        const ratio = (rawRpm! - startRpm) / Math.max(1, allOnRpm - startRpm);
        activeLeds = Math.min(ledCount, Math.max(1, Math.round(ratio * ledCount)));
      }
    }

    for (let i = 0; i < ledCount; i++) {
      let isLedOn = false;

      // Calcular si el LED i está encendido según el patrón
      if (shiftCfg.pattern === 'center_out') {
        const center = (ledCount - 1) / 2;
        const distFromCenter = Math.abs(i - center);
        const maxDist = center;
        const threshold = (activeLeds / ledCount) * maxDist;
        isLedOn = distFromCenter <= threshold;
      } else if (shiftCfg.pattern === 'right_to_left') {
        isLedOn = (ledCount - 1 - i) < activeLeds;
      } else {
        // left_to_right por defecto
        isLedOn = i < activeLeds;
      }

      // Determinar color del LED según rangos
      let color = shiftCfg.off_color || '#1F2937';
      if (isLedOn) {
        if (isShift) {
          color = flashState ? '#FFFFFF' : '#FF1744';
        } else {
          // Buscar color en la lista configurada
          const found = shiftCfg.colors.find((c) => i >= c.fromLed && i <= c.toLed);
          color = found ? found.color : CockpitColors.neonGreen;
        }
      }

      const ledX = x + paddingX + i * (ledW + gap);

      ctx.beginPath();
      ctx.roundRect(ledX, ledY, ledW, ledH, ledRadius);
      ctx.fillStyle = color;
      ctx.fill();

      // Borde sutil del LED
      ctx.strokeStyle = isLedOn ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = Math.max(0.75, Math.round(1 * scale));
      ctx.stroke();
    }

    // Cartel "⚡ SHIFT!" parpadeante a la derecha o superpuesto
    if (isShift && flashState) {
      const badgeW = Math.round(75 * scale);
      const badgeH = Math.round(26 * scale);
      const badgeX = x + width + Math.round(8 * scale);
      const badgeY = y + (height - badgeH) / 2;
      const badgeFontSize = Math.max(9, Math.round(12 * scale));

      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, Math.max(3, Math.round(6 * scale)));
      ctx.fillStyle = CockpitColors.neonRed;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
      ctx.stroke();

      ctx.font = `bold ${badgeFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡ SHIFT!', badgeX + badgeW / 2, badgeY + badgeH / 2);
    }

    ctx.restore();
  }
}
