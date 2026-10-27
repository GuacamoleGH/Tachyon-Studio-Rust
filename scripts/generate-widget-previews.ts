import { createCanvas } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import { OverlayRenderer } from '../src/engine/canvas/overlayRenderer';
import { PRESET_GASOLINA_ESTANDAR } from '../src/core/profile/vehicleProfile';
import { TelemetrySnapshot } from '../src/core/telemetry/timeEngine';
import { TelemetryPoint, STANDARD_SIGNALS, StandardSignalKey } from '../src/core/model/telemetry';
import { WidgetType, WidgetBounds } from '../src/engine/widgets/types';

const outputDir = path.resolve(process.cwd(), 'docs/assets/widgets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generar una trazada sintética para el widget de mapa y gráficas
const mockPoints: TelemetryPoint[] = [];
const centerLat = 40.4168;
const centerLon = -3.7038;
for (let i = 0; i < 200; i++) {
  const angle = (i / 200) * Math.PI * 2;
  const r = 0.003 + 0.001 * Math.sin(angle * 3);
  const lat = centerLat + r * Math.sin(angle);
  const lon = centerLon + r * Math.cos(angle) * 1.3;
  const speed = 80 + 60 * Math.sin(angle * 2);
  mockPoints.push({
    timestampMs: i * 100,
    timeSec: i * 0.1,
    lat,
    lon,
    elevation: 650 + 10 * Math.cos(angle),
    speedKmh: Math.max(20, speed),
    rawValues: {},
  });
}

function createSampleSnapshot(): TelemetrySnapshot {
  const signals = {} as any;
  for (const k of Object.keys(STANDARD_SIGNALS) as StandardSignalKey[]) {
    signals[k] = {
      key: k,
      value: 0,
      isAvailable: true,
      status: 'VALID',
    };
  }

  signals.engine_rpm.value = 6540;
  signals.gps_speed_kmh.value = 142.8;
  signals.throttle_pct.value = 92;
  signals.brake_pct = { key: 'throttle_pct', value: 0, isAvailable: true, status: 'VALID' };
  signals.coolant_temp_c.value = 89;
  signals.lateral_g.value = 1.15;
  signals.longitudinal_g.value = 0.42;
  signals.altitude_m.value = 648;
  signals.bearing_deg.value = 285;
  signals.boost_bar.value = 1.25;
  signals.fuel_l100km.value = 11.4;
  signals.intake_temp_c.value = 38;
  signals.accel_x.value = 0.15;
  signals.accel_y.value = -1.02;
  signals.accel_z.value = 9.81;
  signals.accuracy_m.value = 0.8;
  signals.gear.value = '4';

  return {
    timeSec: 18.5,
    signals,
    activeEvents: [],
    speedKmh: 142.8,
    speedAvailable: true,
    rpm: 6540,
    rpmAvailable: true,
    gear: '4',
    throttlePct: 92,
    brakePct: 0,
    coolantTempC: 89,
    accelLateralG: 1.15,
    accelLongitudinalG: 0.42,
    accelX: 0.15,
    accelY: -1.02,
    accelZ: 9.81,
    altitudeM: 648,
    bearingDeg: 285,
    boostBar: 1.25,
    fuelL100km: 11.4,
    intakeTempC: 38,
    accuracyM: 0.8,
    maxStats: {
      maxSpeedKmh: 186.4,
      maxRpm: 7200,
      maxLateralG: 1.35,
    },
    currentPoint: mockPoints[40],
  };
}

interface WidgetSpec {
  type: WidgetType;
  name: string;
  filename: string;
  bounds: WidgetBounds;
  properties?: Record<string, any>;
}

const WIDGET_SPECS: WidgetSpec[] = [
  {
    type: 'tachometer_circular',
    name: 'Tacómetro Circular Deportivo',
    filename: 'tachometer_circular.png',
    bounds: { x: 20, y: 20, width: 240, height: 240 },
  },
  {
    type: 'tachometer_forza',
    name: 'Tacómetro Racing Estilo Forza',
    filename: 'tachometer_forza.png',
    bounds: { x: 20, y: 20, width: 280, height: 210 },
  },
  {
    type: 'tachometer_bar',
    name: 'Tacómetro de Barra GT',
    filename: 'tachometer_bar.png',
    bounds: { x: 20, y: 20, width: 360, height: 50 },
  },
  {
    type: 'tachometer_horizontal',
    name: 'Tacómetro Horizontal F1 / Pro',
    filename: 'tachometer_horizontal.png',
    bounds: { x: 20, y: 20, width: 380, height: 55 },
  },
  {
    type: 'shift_lights',
    name: 'Luces de Cambio Pro (Shift Lights)',
    filename: 'shift_lights.png',
    bounds: { x: 20, y: 20, width: 380, height: 42 },
  },
  {
    type: 'speedometer',
    name: 'Velocímetro Digital',
    filename: 'speedometer.png',
    bounds: { x: 20, y: 20, width: 220, height: 110 },
  },
  {
    type: 'gear_indicator',
    name: 'Indicador de Marcha Gigante',
    filename: 'gear_indicator.png',
    bounds: { x: 20, y: 20, width: 90, height: 110 },
  },
  {
    type: 'throttle',
    name: 'Pedal de Acelerador',
    filename: 'throttle.png',
    bounds: { x: 20, y: 20, width: 55, height: 110 },
  },
  {
    type: 'brake_throttle',
    name: 'Pedales Duales Competición (Freno / Gas)',
    filename: 'brake_throttle.png',
    bounds: { x: 20, y: 20, width: 105, height: 110 },
  },
  {
    type: 'coolant_temp',
    name: 'Temperatura Refrigerante Motor',
    filename: 'coolant_temp.png',
    bounds: { x: 20, y: 20, width: 150, height: 65 },
  },
  {
    type: 'boost',
    name: 'Presión de Sobrealimentación (Turbo)',
    filename: 'boost.png',
    bounds: { x: 20, y: 20, width: 160, height: 95 },
  },
  {
    type: 'fuel_consumption',
    name: 'Consumo de Combustible',
    filename: 'fuel_consumption.png',
    bounds: { x: 20, y: 20, width: 160, height: 75 },
  },
  {
    type: 'intake_temp',
    name: 'Temperatura Aire de Admisión (IAT)',
    filename: 'intake_temp.png',
    bounds: { x: 20, y: 20, width: 155, height: 65 },
  },
  {
    type: 'g_meter',
    name: 'G-Meter (Fuerzas G Circulares)',
    filename: 'g_meter.png',
    bounds: { x: 20, y: 20, width: 150, height: 150 },
  },
  {
    type: 'g_force_bars',
    name: 'Barras de Fuerzas G Duales',
    filename: 'g_force_bars.png',
    bounds: { x: 20, y: 20, width: 170, height: 75 },
  },
  {
    type: 'imu_raw',
    name: 'Aceleración Bruta IMU 3D (X, Y, Z)',
    filename: 'imu_raw.png',
    bounds: { x: 20, y: 20, width: 170, height: 95 },
  },
  {
    type: 'map',
    name: 'Trazada GPS / Minimapa',
    filename: 'map.png',
    bounds: { x: 20, y: 20, width: 180, height: 140 },
  },
  {
    type: 'speed_graph',
    name: 'Gráfica de Velocidad Continua',
    filename: 'speed_graph.png',
    bounds: { x: 20, y: 20, width: 220, height: 110 },
  },
  {
    type: 'session_timer',
    name: 'Cronómetro de Sesión',
    filename: 'session_timer.png',
    bounds: { x: 20, y: 20, width: 150, height: 50 },
  },
  {
    type: 'altitude',
    name: 'Altitud GPS',
    filename: 'altitude.png',
    bounds: { x: 20, y: 20, width: 140, height: 55 },
  },
  {
    type: 'compass',
    name: 'Brújula y Rumbo GPS',
    filename: 'compass.png',
    bounds: { x: 20, y: 20, width: 85, height: 85 },
  },
  {
    type: 'max_stats',
    name: 'Récords de Sesión (Max Stats)',
    filename: 'max_stats.png',
    bounds: { x: 20, y: 20, width: 180, height: 110 },
  },
  {
    type: 'gps_coords',
    name: 'Coordenadas Satelitales (WGS84)',
    filename: 'gps_coords.png',
    bounds: { x: 20, y: 20, width: 180, height: 60 },
  },
  {
    type: 'gps_accuracy',
    name: 'Precisión Satelital (GNSS / GPS)',
    filename: 'gps_accuracy.png',
    bounds: { x: 20, y: 20, width: 140, height: 60 },
  },
];

async function generateAll() {
  console.log(`Generando vistas previas de los ${WIDGET_SPECS.length} widgets...`);
  const renderer = new OverlayRenderer(1280, 720);
  const snapshot = createSampleSnapshot();
  const profile = PRESET_GASOLINA_ESTANDAR;

  for (const spec of WIDGET_SPECS) {
    const pad = 16;
    const canvasW = spec.bounds.width + pad * 2;
    const canvasH = spec.bounds.height + pad * 2;

    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

    // Fondo oscuro cockpit estilo Tachyon Studio
    ctx.fillStyle = '#090C0E';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Borde redondeado sutil y rejilla
    ctx.strokeStyle = '#1A222B';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, canvasW - 4, canvasH - 4);

    const widget = renderer.createWidgetInstance({
      id: spec.type,
      type: spec.type,
      name: spec.name,
      bounds: {
        x: pad,
        y: pad,
        width: spec.bounds.width,
        height: spec.bounds.height,
      },
      visible: true,
      properties: spec.properties,
    });

    widget.render({
      ctx,
      snapshot,
      profile,
      timeSec: 18.5,
      allPoints: mockPoints,
      unitSystem: 'metric',
    });

    const buffer = canvas.toBuffer('image/png');
    const outPath = path.join(outputDir, spec.filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[OK] Generado: ${spec.filename} (${canvasW}x${canvasH})`);
  }

  console.log(`\n¡Todas las imágenes generadas con éxito en: ${outputDir}!`);
}

generateAll().catch(console.error);
