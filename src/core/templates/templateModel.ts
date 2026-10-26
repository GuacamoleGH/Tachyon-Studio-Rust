import { WidgetBounds, WidgetType } from '../../engine/widgets/types';

export interface WidgetSerializedConfig {
  id: string;
  type: WidgetType;
  name: string;
  bounds: WidgetBounds;
  visible: boolean;
  properties?: Record<string, any>;
}

export interface OverlayTemplate {
  schema_version: '1.0.0';
  id: string;
  name: string;
  description?: string;
  resolution: { width: number; height: number };
  unit_system: 'metric' | 'imperial';
  opacity: number;
  show_timer: boolean;
  widgets: WidgetSerializedConfig[];
}

export const TEMPLATE_MYCHRON_5: OverlayTemplate = {
  schema_version: '1.0.0',
  id: 'template_mychron5',
  name: 'MyChron 5 Cockpit (Por Defecto)',
  description: 'Disposición deportiva completa con tacómetro, shift lights, velocímetro, pedales, fuerzas G y trazada GPS.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: true,
  widgets: [
    {
      id: 'shift_lights',
      type: 'shift_lights',
      name: 'Barra de Shift Lights',
      bounds: { x: 450, y: 25, width: 380, height: 44 },
      visible: true,
      properties: { pattern: 'left_to_right', flash_hz: 8 },
    },
    {
      id: 'tachometer_circular',
      type: 'tachometer_circular',
      name: 'Tacómetro Circular',
      bounds: { x: 35, y: 425, width: 260, height: 260 },
      visible: true,
      properties: { label_divisor: 1000 },
    },
    {
      id: 'speedometer',
      type: 'speedometer',
      name: 'Velocímetro Digital',
      bounds: { x: 310, y: 575, width: 210, height: 110 },
      visible: true,
      properties: { preferredSource: 'GPS', unitSystem: 'metric' },
    },
    {
      id: 'throttle',
      type: 'throttle',
      name: 'Barra de Acelerador',
      bounds: { x: 535, y: 575, width: 55, height: 110 },
      visible: true,
    },
    {
      id: 'g_meter',
      type: 'g_meter',
      name: 'G-Meter (Círculo de Kamm)',
      bounds: { x: 1100, y: 540, width: 145, height: 145 },
      visible: true,
      properties: { maxScaleG: 1.5, preferredLongSource: 'IMU' },
    },
    {
      id: 'map',
      type: 'map',
      name: 'Trazada GPS (Minimapa)',
      bounds: { x: 1065, y: 25, width: 180, height: 135 },
      visible: true,
      properties: { mode: 'chase_north', zoomMeters: 400 },
    },
    {
      id: 'speed_graph',
      type: 'speed_graph',
      name: 'Gráfica de Velocidad',
      bounds: { x: 605, y: 575, width: 480, height: 110 },
      visible: true,
    },
  ],
};

export const TEMPLATE_MINIMALISTA: OverlayTemplate = {
  schema_version: '1.0.0',
  id: 'template_minimalista',
  name: 'Barra Inferior Minimalista',
  description: 'Instrumentación compacta en la parte inferior para no tapar la vista del circuito.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 0.9,
  show_timer: true,
  widgets: [
    {
      id: 'shift_lights',
      type: 'shift_lights',
      name: 'Shift Lights',
      bounds: { x: 450, y: 15, width: 380, height: 38 },
      visible: true,
      properties: { pattern: 'center_out', flash_hz: 8 },
    },
    {
      id: 'speedometer',
      type: 'speedometer',
      name: 'Velocímetro',
      bounds: { x: 40, y: 590, width: 200, height: 100 },
      visible: true,
      properties: { preferredSource: 'GPS' },
    },
    {
      id: 'tachometer_circular',
      type: 'tachometer_circular',
      name: 'Tacómetro',
      bounds: { x: 255, y: 470, width: 220, height: 220 },
      visible: true,
    },
    {
      id: 'g_meter',
      type: 'g_meter',
      name: 'G-Meter',
      bounds: { x: 1110, y: 560, width: 130, height: 130 },
      visible: true,
      properties: { maxScaleG: 1.5 },
    },
  ],
};

export const TEMPLATE_GT3_COMPETICION: OverlayTemplate = {
  schema_version: '1.0.0',
  id: 'template_gt3',
  name: 'Cockpit GT3 Pro (Display Carreras)',
  description: 'Disposición de competición con tacómetro de barra, marcha engranada gigante, pedales duales y temperatura de motor.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: true,
  widgets: [
    {
      id: 'shift_lights',
      type: 'shift_lights',
      name: 'Shift Lights',
      bounds: { x: 450, y: 20, width: 380, height: 42 },
      visible: true,
      properties: { pattern: 'left_to_right', flash_hz: 8 },
    },
    {
      id: 'tachometer_bar',
      type: 'tachometer_bar',
      name: 'Tacómetro de Barra GT',
      bounds: { x: 450, y: 70, width: 380, height: 48 },
      visible: true,
    },
    {
      id: 'gear_indicator',
      type: 'gear_indicator',
      name: 'Indicador de Marcha',
      bounds: { x: 355, y: 575, width: 80, height: 110 },
      visible: true,
    },
    {
      id: 'speedometer',
      type: 'speedometer',
      name: 'Velocímetro Digital',
      bounds: { x: 135, y: 575, width: 210, height: 110 },
      visible: true,
      properties: { preferredSource: 'GPS' },
    },
    {
      id: 'brake_throttle',
      type: 'brake_throttle',
      name: 'Pedales Freno y Gas',
      bounds: { x: 445, y: 575, width: 85, height: 110 },
      visible: true,
    },
    {
      id: 'coolant_temp',
      type: 'coolant_temp',
      name: 'Temperatura Motor',
      bounds: { x: 135, y: 490, width: 140, height: 75 },
      visible: true,
    },
    {
      id: 'g_meter',
      type: 'g_meter',
      name: 'G-Meter',
      bounds: { x: 1100, y: 540, width: 145, height: 145 },
      visible: true,
      properties: { maxScaleG: 1.5 },
    },
    {
      id: 'map',
      type: 'map',
      name: 'Trazada GPS (Minimapa)',
      bounds: { x: 1065, y: 20, width: 180, height: 135 },
      visible: true,
      properties: { mode: 'chase_north', zoomMeters: 400 },
    },
    {
      id: 'speed_graph',
      type: 'speed_graph',
      name: 'Gráfica de Velocidad',
      bounds: { x: 540, y: 575, width: 545, height: 110 },
      visible: true,
    },
  ],
};

export const TEMPLATE_FORZA_HUD: OverlayTemplate = {
  schema_version: '1.0.0',
  id: 'template_forza_hud',
  name: 'Forza Motorsport HUD (Tacómetro + Marcha + Velocidad)',
  description: 'Cuadro de instrumentos estilo Forza con tacómetro curvo, marcha en buje central y velocímetro integrado en cursiva.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: true,
  widgets: [
    {
      id: 'shift_lights',
      type: 'shift_lights',
      name: 'Shift Lights',
      bounds: { x: 450, y: 25, width: 380, height: 44 },
      visible: true,
      properties: { pattern: 'left_to_right', flash_hz: 8 },
    },
    {
      id: 'tachometer_forza',
      type: 'tachometer_forza',
      name: 'Tacómetro Racing (Estilo Forza)',
      bounds: { x: 40, y: 420, width: 300, height: 270 },
      visible: true,
    },
    {
      id: 'brake_throttle',
      type: 'brake_throttle',
      name: 'Pedales Freno y Gas',
      bounds: { x: 360, y: 575, width: 90, height: 110 },
      visible: true,
    },
    {
      id: 'g_meter',
      type: 'g_meter',
      name: 'G-Meter',
      bounds: { x: 1100, y: 540, width: 145, height: 145 },
      visible: true,
      properties: { maxScaleG: 1.5, preferredLongSource: 'IMU' },
    },
    {
      id: 'map',
      type: 'map',
      name: 'Trazada GPS (Minimapa)',
      bounds: { x: 1065, y: 25, width: 180, height: 135 },
      visible: true,
      properties: { mode: 'chase_north', zoomMeters: 400 },
    },
    {
      id: 'speed_graph',
      type: 'speed_graph',
      name: 'Gráfica de Velocidad',
      bounds: { x: 470, y: 575, width: 610, height: 110 },
      visible: true,
    },
  ],
};

export const BUILTIN_TEMPLATES: OverlayTemplate[] = [
  TEMPLATE_MYCHRON_5,
  TEMPLATE_FORZA_HUD,
  TEMPLATE_GT3_COMPETICION,
  TEMPLATE_MINIMALISTA,
];

/**
 * Escala proporcionalmente todas las dimensiones y coordenadas de los widgets
 * de una plantilla al cambiar su resolución objetivo (p.ej. 720p -> 1080p -> 2K -> 4K).
 */
export function scaleTemplate(template: OverlayTemplate, newWidth: number, newHeight: number): OverlayTemplate {
  const oldW = template.resolution.width;
  const oldH = template.resolution.height;
  if (oldW === newWidth && oldH === newHeight) return template;
  const scaleX = newWidth / oldW;
  const scaleY = newHeight / oldH;

  return {
    ...template,
    resolution: { width: newWidth, height: newHeight },
    widgets: template.widgets.map((w) => ({
      ...w,
      bounds: {
        x: Math.round(w.bounds.x * scaleX),
        y: Math.round(w.bounds.y * scaleY),
        width: Math.round(w.bounds.width * scaleX),
        height: Math.round(w.bounds.height * scaleY),
      },
    })),
  };
}

const TEMPLATE_STORAGE_KEY = 'tachyon_saved_custom_template';

export function saveTemplateToStorage(template: OverlayTemplate): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));
    }
  } catch (e) {
    console.warn('Error guardando plantilla en localStorage:', e);
  }
}

export function loadTemplateFromStorage(): OverlayTemplate | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.warn('Error leyendo plantilla de localStorage:', e);
  }
  return null;
}
