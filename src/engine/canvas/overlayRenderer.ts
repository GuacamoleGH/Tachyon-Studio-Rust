import { BaseWidget, WidgetRenderContext } from '../widgets/types';
import { TachometerCircularWidget } from '../widgets/TachometerWidget';
import { ShiftLightsWidget } from '../widgets/ShiftLightsWidget';
import { SpeedometerWidget } from '../widgets/SpeedometerWidget';
import { GMeterWidget } from '../widgets/GMeterWidget';
import { PedalWidget } from '../widgets/PedalWidget';
import { MapWidget } from '../widgets/MapWidget';
import { SpeedGraphWidget } from '../widgets/SpeedGraphWidget';
import { GearIndicatorWidget } from '../widgets/GearIndicatorWidget';
import { CoolantTempWidget } from '../widgets/CoolantTempWidget';
import { BrakeThrottleWidget } from '../widgets/BrakeThrottleWidget';
import { TachometerBarWidget } from '../widgets/TachometerBarWidget';
import { VehicleProfile } from '../../core/profile/vehicleProfile';
import { TelemetrySnapshot } from '../../core/telemetry/timeEngine';
import { TelemetryPoint } from '../../core/model/telemetry';
import { CockpitColors } from '../../core/theme/colors';
import { OverlayTemplate, WidgetSerializedConfig } from '../../core/templates/templateModel';

export interface OverlayLayoutConfig {
  width: number;
  height: number;
}

/**
 * Orquestador del overlay de telemetría estilo MyChron 5 para vista previa y renderizado.
 */
export class OverlayRenderer {
  public widgets: BaseWidget[] = [];
  public width: number = 1280;
  public height: number = 720;
  public showTimer: boolean = true;
  public opacity: number = 1.0;

  constructor(width: number = 1280, height: number = 720) {
    this.width = width;
    this.height = height;
    this.initDefaultLayout();
  }

  /**
   * Configura la disposición de widgets estilo MyChron 5 optimizada para la resolución dada.
   */
  public initDefaultLayout(): void {
    const w = this.width;
    const h = this.height;

    // 1. Shift Lights en la parte superior central
    const shiftW = Math.min(380, w * 0.35);
    const shiftLights = new ShiftLightsWidget({
      x: (w - shiftW) / 2,
      y: 25,
      width: shiftW,
      height: 44,
    });

    // 2. Tacómetro Circular inferior izquierdo
    const tachSize = Math.min(260, h * 0.38);
    const tachometer = new TachometerCircularWidget({
      x: 35,
      y: h - tachSize - 35,
      width: tachSize,
      height: tachSize,
    });

    // 3. Velocímetro Digital grande inferior
    const speedW = 210;
    const speedH = 110;
    const speedX = tachometer.bounds.x + tachometer.bounds.width + 16;
    const speedometer = new SpeedometerWidget({
      x: speedX,
      y: h - speedH - 35,
      width: speedW,
      height: speedH,
    });

    // 4. Pedal de acelerador
    const pedalW = 55;
    const pedal = new PedalWidget({
      x: speedX + speedW + 14,
      y: h - speedH - 35,
      width: pedalW,
      height: speedH,
    });

    // 5. G-Meter inferior derecho
    const gmSize = 145;
    const gMeter = new GMeterWidget({
      x: w - gmSize - 35,
      y: h - gmSize - 35,
      width: gmSize,
      height: gmSize,
    });

    // 6. Mapa GPS superior derecho
    const mapW = 180;
    const mapH = 135;
    const mapWidget = new MapWidget({
      x: w - mapW - 35,
      y: 25,
      width: mapW,
      height: mapH,
    });

    // 7. Gráfica de perfil de velocidad inferior
    const graphX = pedal.bounds.x + pedalW + 16;
    const graphW = Math.max(120, gMeter.bounds.x - graphX - 18);
    const speedGraph = new SpeedGraphWidget({
      x: graphX,
      y: h - speedH - 35,
      width: graphW,
      height: speedH,
    });

    this.widgets = [
      shiftLights,
      tachometer,
      speedometer,
      pedal,
      gMeter,
      mapWidget,
      speedGraph,
    ];
  }

  /**
   * Actualiza las dimensiones y escala proporcionalmente los widgets existentes.
   */
  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    const scaleX = width / this.width;
    const scaleY = height / this.height;
    this.width = width;
    this.height = height;

    for (let i = 0; i < this.widgets.length; i++) {
      const b = this.widgets[i].bounds;
      b.x = Math.round(b.x * scaleX);
      b.y = Math.round(b.y * scaleY);
      b.width = Math.round(b.width * scaleX);
      b.height = Math.round(b.height * scaleY);
    }
  }

  /**
   * Renderiza el fotograma completo del overlay sobre el contexto Canvas 2D.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    snapshot: TelemetrySnapshot,
    profile: VehicleProfile,
    timeSec: number,
    allPoints?: TelemetryPoint[]
  ): void {
    ctx.save();
    if (this.opacity < 1.0) {
      ctx.globalAlpha = this.opacity;
    }

    const renderContext: WidgetRenderContext = {
      ctx,
      snapshot,
      profile,
      timeSec,
      allPoints,
    };

    // 1. Dibujar cada widget activo
    for (let i = 0; i < this.widgets.length; i++) {
      const widget = this.widgets[i];
      if (widget.visible) {
        widget.render(renderContext);
      }
    }

    // 2. Cronómetro de tiempo en la esquina superior izquierda
    if (this.showTimer) {
      this.renderTimer(ctx, timeSec);
    }

    ctx.restore();
  }

  /**
   * Aplica una plantilla estructurada al renderizador.
   */
  public applyTemplate(template: OverlayTemplate): void {
    this.width = template.resolution.width;
    this.height = template.resolution.height;
    this.opacity = template.opacity ?? 1.0;
    this.showTimer = template.show_timer ?? true;

    this.widgets = template.widgets.map((w) => this.createWidgetInstance(w));
  }

  /**
   * Exporta la disposición actual como una plantilla OverlayTemplate.
   */
  public toTemplate(name: string = 'Mi Plantilla Personalizada'): OverlayTemplate {
    const serializedWidgets: WidgetSerializedConfig[] = this.widgets.map((w) => {
      const props: Record<string, any> = {};
      if (w instanceof SpeedometerWidget) {
        props.preferredSource = w.preferredSource;
      } else if (w instanceof GMeterWidget) {
        props.maxScaleG = w.maxScaleG;
        props.preferredLongSource = w.preferredLongSource;
      } else if (w instanceof MapWidget) {
        props.mode = w.mode;
        props.zoomMeters = w.zoomMeters;
      }

      return {
        id: w.id,
        type: w.type,
        name: w.name,
        bounds: { ...w.bounds },
        visible: w.visible,
        properties: Object.keys(props).length > 0 ? props : undefined,
      };
    });

    return {
      schema_version: '1.0.0',
      id: 'template_' + Date.now(),
      name,
      resolution: { width: this.width, height: this.height },
      unit_system: 'metric',
      opacity: this.opacity,
      show_timer: this.showTimer,
      widgets: serializedWidgets,
    };
  }

  /**
   * Fábrica para instanciar widgets a partir de su configuración serializada.
   */
  public createWidgetInstance(config: WidgetSerializedConfig): BaseWidget {
    let widget: BaseWidget;

    switch (config.type) {
      case 'shift_lights':
        widget = new ShiftLightsWidget({ ...config.bounds });
        break;
      case 'tachometer_circular':
        widget = new TachometerCircularWidget({ ...config.bounds });
        break;
      case 'speedometer':
        widget = new SpeedometerWidget({ ...config.bounds });
        if (config.properties?.preferredSource) {
          (widget as SpeedometerWidget).preferredSource = config.properties.preferredSource;
        }
        break;
      case 'throttle':
        widget = new PedalWidget({ ...config.bounds });
        break;
      case 'g_meter':
        widget = new GMeterWidget({ ...config.bounds });
        if (config.properties?.maxScaleG) {
          (widget as GMeterWidget).maxScaleG = config.properties.maxScaleG;
        }
        if (config.properties?.preferredLongSource) {
          (widget as GMeterWidget).preferredLongSource = config.properties.preferredLongSource;
        }
        break;
      case 'map':
        widget = new MapWidget({ ...config.bounds });
        if (config.properties?.mode) {
          (widget as MapWidget).mode = config.properties.mode;
        }
        if (config.properties?.zoomMeters) {
          (widget as MapWidget).zoomMeters = config.properties.zoomMeters;
        }
        break;
      case 'speed_graph':
        widget = new SpeedGraphWidget({ ...config.bounds });
        break;
      case 'gear_indicator':
        widget = new GearIndicatorWidget({ ...config.bounds });
        break;
      case 'coolant_temp':
        widget = new CoolantTempWidget({ ...config.bounds });
        break;
      case 'brake_throttle':
        widget = new BrakeThrottleWidget({ ...config.bounds });
        break;
      case 'tachometer_bar':
        widget = new TachometerBarWidget({ ...config.bounds });
        break;
      default:
        widget = new TachometerCircularWidget({ ...config.bounds });
    }

    widget.id = config.id;
    widget.name = config.name;
    widget.visible = config.visible;
    return widget;
  }

  private renderTimer(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const isNegative = timeSec < 0;
    const absSec = Math.abs(timeSec);
    const minutes = Math.floor(absSec / 60);
    const seconds = Math.floor(absSec % 60);
    const tenths = Math.floor((absSec - Math.floor(absSec)) * 10);

    const sign = isNegative ? '-' : '';
    const timeStr = `${sign}${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${tenths}`;

    const scale = Math.min(this.width / 1280, this.height / 720);
    const x = Math.round(35 * scale);
    const y = Math.round(30 * scale);
    const w = Math.round(140 * scale);
    const h = Math.round(36 * scale);
    const fontSize = Math.max(12, Math.round(16 * scale));

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.max(3, Math.round(6 * scale)));
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1 * scale));
    ctx.stroke();

    ctx.font = `bold ${fontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = isNegative ? CockpitColors.neonAmber : CockpitColors.textPrimary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, x + w / 2, y + h / 2);
  }
}
