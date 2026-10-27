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
  name: 'MyChron 5 Cockpit',
  description: 'Disposición deportiva completa con tacómetro, shift lights, velocímetro, pedales, fuerzas G y trazada GPS.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: false,
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
      properties: { mode: 'chase_north', zoomMeters: 120 },
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
  show_timer: false,
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
  name: 'Cockpit GT3 Pro',
  description: 'Disposición de competición con tacómetro de barra, marcha engranada gigante, pedales duales y temperatura de motor.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: false,
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
      properties: { mode: 'chase_north', zoomMeters: 120 },
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
  name: 'Forza Motorsport HUD',
  description: 'Cuadro de instrumentos estilo Forza con tacómetro curvo, marcha en buje central y velocímetro integrado en cursiva.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: false,
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
      properties: { mode: 'chase_north', zoomMeters: 120 },
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

export const TEMPLATE_WRC_RALLY: OverlayTemplate = {
  schema_version: '1.0.0',
  id: 'template_wrc_rally',
  name: 'WRC Rally & Montaña',
  description: 'Minimapa con súper zoom de curvas (80m), altímetro GPS, brújula de rumbo, tacómetro Forza y barras de fuerzas G.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: false,
  widgets: [
    {
      id: 'session_timer',
      type: 'session_timer',
      name: 'Cronómetro de Tramo',
      bounds: { x: 30, y: 25, width: 150, height: 44 },
      visible: true,
    },
    {
      id: 'altitude',
      type: 'altitude',
      name: 'Altitud GPS',
      bounds: { x: 195, y: 20, width: 85, height: 65 },
      visible: true,
    },
    {
      id: 'compass',
      type: 'compass',
      name: 'Rumbo GPS',
      bounds: { x: 290, y: 20, width: 65, height: 65 },
      visible: true,
    },
    {
      id: 'map',
      type: 'map',
      name: 'Minimapa Trazada GPS',
      bounds: { x: 1040, y: 20, width: 210, height: 160 },
      visible: true,
      properties: { mode: 'chase_north', zoomMeters: 80, mapBackground: 'osm' },
    },
    {
      id: 'tachometer_forza',
      type: 'tachometer_forza',
      name: 'Tacómetro Forza',
      bounds: { x: 30, y: 430, width: 290, height: 260 },
      visible: true,
    },
    {
      id: 'brake_throttle',
      type: 'brake_throttle',
      name: 'Pedales Freno/Gas',
      bounds: { x: 335, y: 580, width: 85, height: 110 },
      visible: true,
    },
    {
      id: 'g_force_bars',
      type: 'g_force_bars',
      name: 'Fuerzas G (Lat/Long)',
      bounds: { x: 435, y: 580, width: 180, height: 110 },
      visible: true,
    },
    {
      id: 'speed_graph',
      type: 'speed_graph',
      name: 'Perfil de Velocidad',
      bounds: { x: 630, y: 580, width: 620, height: 110 },
      visible: true,
    },
  ],
};

export const TEMPLATE_F1_GT3: OverlayTemplate = {
  schema_version: '1.0.0',
  id: 'template_f1_gt3',
  name: 'Fórmula 1 & GT Display',
  description: 'Tacómetro LED horizontal en la parte superior con marcha y velocímetro, minimapa centrado a 100m y panel de récords V-MAX.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: false,
  widgets: [
    {
      id: 'tachometer_horizontal',
      type: 'tachometer_horizontal',
      name: 'Display Horizontal F1/GT3',
      bounds: { x: 315, y: 20, width: 650, height: 68 },
      visible: true,
    },
    {
      id: 'map',
      type: 'map',
      name: 'Minimapa Trazada GPS',
      bounds: { x: 1065, y: 20, width: 185, height: 140 },
      visible: true,
      properties: { mode: 'chase_north', zoomMeters: 100 },
    },
    {
      id: 'max_stats',
      type: 'max_stats',
      name: 'Récords de Sesión',
      bounds: { x: 30, y: 580, width: 230, height: 110 },
      visible: true,
    },
    {
      id: 'brake_throttle',
      type: 'brake_throttle',
      name: 'Pedales Freno y Gas',
      bounds: { x: 275, y: 580, width: 85, height: 110 },
      visible: true,
    },
    {
      id: 'g_meter',
      type: 'g_meter',
      name: 'G-Meter Circular',
      bounds: { x: 1115, y: 550, width: 135, height: 135 },
      visible: true,
      properties: { maxScaleG: 1.5 },
    },
    {
      id: 'speed_graph',
      type: 'speed_graph',
      name: 'Gráfica de Velocidad',
      bounds: { x: 375, y: 580, width: 725, height: 110 },
      visible: true,
    },
  ],
};

export const TEMPLATE_TRACKDAY_PRO: OverlayTemplate = {
  schema_version: '1.0.0',
  id: 'template_trackday_pro',
  name: 'Track Day Pro',
  description: 'Disposición profesional completa con tacómetro Forza, minimapa de 120m, estadísticas V-MAX, fuerzas G y refrigerante.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: false,
  widgets: [
    {
      id: 'session_timer',
      type: 'session_timer',
      name: 'Cronómetro',
      bounds: { x: 30, y: 25, width: 150, height: 44 },
      visible: true,
    },
    {
      id: 'coolant_temp',
      type: 'coolant_temp',
      name: 'Temp. Refrigerante',
      bounds: { x: 195, y: 25, width: 130, height: 44 },
      visible: true,
    },
    {
      id: 'map',
      type: 'map',
      name: 'Minimapa GPS',
      bounds: { x: 1065, y: 20, width: 185, height: 140 },
      visible: true,
      properties: { mode: 'chase_north', zoomMeters: 120 },
    },
    {
      id: 'tachometer_forza',
      type: 'tachometer_forza',
      name: 'Tacómetro Forza',
      bounds: { x: 30, y: 430, width: 290, height: 260 },
      visible: true,
    },
    {
      id: 'max_stats',
      type: 'max_stats',
      name: 'Récords de Sesión',
      bounds: { x: 335, y: 580, width: 230, height: 110 },
      visible: true,
    },
    {
      id: 'brake_throttle',
      type: 'brake_throttle',
      name: 'Pedales Freno/Gas',
      bounds: { x: 580, y: 580, width: 85, height: 110 },
      visible: true,
    },
    {
      id: 'g_force_bars',
      type: 'g_force_bars',
      name: 'Barras de Fuerzas G',
      bounds: { x: 680, y: 580, width: 170, height: 110 },
      visible: true,
    },
    {
      id: 'speed_graph',
      type: 'speed_graph',
      name: 'Gráfica de Velocidad',
      bounds: { x: 865, y: 580, width: 385, height: 110 },
      visible: true,
    },
  ],
};

export const TEMPLATE_CLEAN_CORNER: OverlayTemplate = {
  schema_version: '1.0.0',
  id: 'template_clean_corner',
  name: 'Clean Cockpit Panorámico',
  description: 'Máxima visibilidad de pista con solo tacómetro Forza en la esquina inferior y minimapa súper nítido a 100m.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: false,
  widgets: [
    {
      id: 'session_timer',
      type: 'session_timer',
      name: 'Cronómetro',
      bounds: { x: 30, y: 25, width: 150, height: 44 },
      visible: true,
    },
    {
      id: 'map',
      type: 'map',
      name: 'Minimapa Deportivo',
      bounds: { x: 1060, y: 25, width: 190, height: 145 },
      visible: true,
      properties: { mode: 'chase_north', zoomMeters: 100 },
    },
    {
      id: 'tachometer_forza',
      type: 'tachometer_forza',
      name: 'Tacómetro Forza HUD',
      bounds: { x: 30, y: 440, width: 290, height: 250 },
      visible: true,
    },
  ],
};

export const TEMPLATE_TURBO_TELEMETRY: OverlayTemplate = {
  schema_version: '1.0.0',
  id: 'template_turbo_telemetry',
  name: '⚡ Turbo & Diagnosis OBD-II Pro',
  description: 'Cuadro completo de telemetría y motor con presión de turbo (Boost), consumo, IAT, refrigerante y dinámicas.',
  resolution: { width: 1280, height: 720 },
  unit_system: 'metric',
  opacity: 1.0,
  show_timer: false,
  widgets: [
    {
      id: 'shift_lights',
      type: 'shift_lights',
      name: 'Shift Lights Pro',
      bounds: { x: 440, y: 20, width: 400, height: 42 },
      visible: true,
    },
    {
      id: 'coolant_temp',
      type: 'coolant_temp',
      name: 'Temp. Refrigerante',
      bounds: { x: 25, y: 20, width: 135, height: 60 },
      visible: true,
    },
    {
      id: 'intake_temp',
      type: 'intake_temp',
      name: 'Temp. Admisión (IAT)',
      bounds: { x: 170, y: 20, width: 135, height: 60 },
      visible: true,
    },
    {
      id: 'boost',
      type: 'boost',
      name: 'Presión Turbo (Boost)',
      bounds: { x: 25, y: 90, width: 135, height: 62 },
      visible: true,
    },
    {
      id: 'fuel_consumption',
      type: 'fuel_consumption',
      name: 'Consumo L/100km',
      bounds: { x: 170, y: 90, width: 135, height: 62 },
      visible: true,
    },
    {
      id: 'tachometer_forza',
      type: 'tachometer_forza',
      name: 'Tacómetro Racing Forza',
      bounds: { x: 30, y: 440, width: 285, height: 250 },
      visible: true,
    },
    {
      id: 'g_force_bars',
      type: 'g_force_bars',
      name: 'Fuerzas G',
      bounds: { x: 550, y: 600, width: 180, height: 90 },
      visible: true,
    },
    {
      id: 'map',
      type: 'map',
      name: 'Trazada GPS con Mapa',
      bounds: { x: 1060, y: 20, width: 195, height: 145 },
      visible: true,
      properties: { mode: 'chase_north', zoomMeters: 100, mapBackground: 'carto_voyager' },
    },
    {
      id: 'gps_accuracy',
      type: 'gps_accuracy',
      name: 'Precisión Satelital',
      bounds: { x: 1060, y: 175, width: 140, height: 50 },
      visible: true,
    },
    {
      id: 'session_timer',
      type: 'session_timer',
      name: 'Cronómetro',
      bounds: { x: 890, y: 20, width: 155, height: 42 },
      visible: true,
    },
  ],
};

export const BUILTIN_TEMPLATES: OverlayTemplate[] = [
  TEMPLATE_TURBO_TELEMETRY,
  TEMPLATE_FORZA_HUD,
  TEMPLATE_F1_GT3,
  TEMPLATE_WRC_RALLY,
  TEMPLATE_TRACKDAY_PRO,
  TEMPLATE_CLEAN_CORNER,
  TEMPLATE_GT3_COMPETICION,
  TEMPLATE_MYCHRON_5,
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
const CUSTOM_TEMPLATES_STORAGE_KEY = 'tachyon_custom_templates_list';

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

/**
 * Carga la lista completa de plantillas personalizadas creadas por el usuario desde localStorage.
 */
export function loadCustomTemplatesFromStorage(): OverlayTemplate[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      // Compatibilidad regresiva: si existía una plantilla guardada única
      const single = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (single) {
        try {
          const parsedSingle = JSON.parse(single);
          if (parsedSingle && parsedSingle.name) {
            const list = [parsedSingle];
            localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(list));
            return list;
          }
        } catch {
          // ignorar
        }
      }
    }
  } catch (e) {
    console.warn('Error leyendo lista de plantillas de localStorage:', e);
  }
  return [];
}

/**
 * Guarda la lista de plantillas personalizadas en localStorage.
 */
export function saveCustomTemplatesToStorage(templates: OverlayTemplate[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    }
  } catch (e) {
    console.warn('Error guardando lista de plantillas en localStorage:', e);
  }
}

/**
 * Guarda o actualiza una plantilla en la lista de plantillas del usuario.
 */
export function saveCustomTemplate(template: OverlayTemplate): OverlayTemplate[] {
  const currentList = loadCustomTemplatesFromStorage();
  const existingIdx = currentList.findIndex((t) => t.id === template.id);
  let updatedList: OverlayTemplate[];
  if (existingIdx >= 0) {
    updatedList = [...currentList];
    updatedList[existingIdx] = template;
  } else {
    updatedList = [template, ...currentList];
  }
  saveCustomTemplatesToStorage(updatedList);
  saveTemplateToStorage(template);
  return updatedList;
}

/**
 * Elimina una plantilla personalizada de la lista del usuario por su ID.
 */
export function deleteCustomTemplate(templateId: string): OverlayTemplate[] {
  const currentList = loadCustomTemplatesFromStorage();
  const updatedList = currentList.filter((t) => t.id !== templateId);
  saveCustomTemplatesToStorage(updatedList);
  return updatedList;
}
