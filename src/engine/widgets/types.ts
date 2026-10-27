import { VehicleProfile } from '../../core/profile/vehicleProfile';
import { TelemetrySnapshot } from '../../core/telemetry/timeEngine';
import { TelemetryPoint } from '../../core/model/telemetry';

export interface WidgetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetRenderContext {
  ctx: CanvasRenderingContext2D;
  snapshot: TelemetrySnapshot;
  profile: VehicleProfile;
  timeSec: number;
  allPoints?: TelemetryPoint[]; // Para widgets que necesitan contexto global como el mapa o gráficas
  unitSystem?: 'metric' | 'imperial';
}

export type WidgetType =
  | 'tachometer_circular'
  | 'tachometer_forza'
  | 'tachometer_bar'
  | 'tachometer_horizontal'
  | 'shift_lights'
  | 'speedometer'
  | 'throttle'
  | 'brake_throttle'
  | 'gear_indicator'
  | 'coolant_temp'
  | 'g_meter'
  | 'map'
  | 'speed_graph'
  | 'session_timer'
  | 'g_force_bars'
  | 'altitude'
  | 'compass'
  | 'max_stats'
  | 'gps_coords'
  | 'boost'
  | 'fuel_consumption'
  | 'intake_temp'
  | 'imu_raw'
  | 'gps_accuracy';

export interface BaseWidget {
  id: string;
  type: WidgetType;
  name: string;
  bounds: WidgetBounds;
  visible: boolean;
  render(context: WidgetRenderContext): void;
}
