import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Layers,
  Sliders,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Download,
  Upload,
  Sparkles,
  Play,
  Pause,
  Undo2,
  Redo2,
  Plus,
  Copy,
} from 'lucide-react';
import { WidgetBounds, WidgetType } from '../../engine/widgets/types';
import { OverlayRenderer } from '../../engine/canvas/overlayRenderer';
import {
  BUILTIN_TEMPLATES,
  loadTemplateFromStorage,
  loadCustomTemplatesFromStorage,
  saveCustomTemplate,
  deleteCustomTemplate,
  OverlayTemplate,
  saveTemplateToStorage,
  scaleTemplate,
  TEMPLATE_MYCHRON_5,
} from '../../core/templates/templateModel';
import { SessionBundle } from '../../core/model/session';
import { VehicleProfile, deriveProfileFromAppConfig, PRESET_GASOLINA_ESTANDAR, loadProfileFromStorage } from '../../core/profile/vehicleProfile';
import { TimeEngine } from '../../core/telemetry/timeEngine';
import { CockpitColors } from '../../core/theme/colors';
import { sanitizeFilename } from '../../core/utils/fileUtils';
import { MapTileManager } from '../../engine/maps/MapTileManager';

interface TemplateEditorScreenProps {
  session?: SessionBundle | null;
  profile?: VehicleProfile;
  template?: OverlayTemplate;
  onTemplateUpdated?: (template: OverlayTemplate) => void;
}

type DragMode = 'none' | 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

// Categorías organizadas para la adición de widgets en la plantilla
const WIDGET_CATEGORIES: {
  category: string;
  items: { type: WidgetType; label: string }[];
}[] = [
  {
    category: '🏎️ Tacómetros y Régimen (RPM)',
    items: [
      { type: 'tachometer_circular', label: 'Tacómetro Circular' },
      { type: 'tachometer_forza', label: 'Tacómetro Racing (Estilo Forza)' },
      { type: 'tachometer_bar', label: 'Tacómetro de Barra GT' },
      { type: 'tachometer_horizontal', label: 'Tacómetro Horizontal F1/GT3' },
      { type: 'shift_lights', label: 'Shift Lights' },
    ],
  },
  {
    category: '⚡ Velocidad, Marchas y Pedales',
    items: [
      { type: 'speedometer', label: 'Velocímetro Digital' },
      { type: 'gear_indicator', label: 'Indicador de Marcha (Gear)' },
      { type: 'throttle', label: 'Pedal Acelerador' },
      { type: 'brake_throttle', label: 'Pedales Duales (Freno / Gas)' },
    ],
  },
  {
    category: '🔧 Diagnosis Motor y Eficiencia OBD-II',
    items: [
      { type: 'boost', label: 'Presión de Turbo (Boost)' },
      { type: 'fuel_consumption', label: 'Consumo de Combustible (L/100km)' },
      { type: 'coolant_temp', label: 'Temp. Refrigerante OBD' },
      { type: 'intake_temp', label: 'Temp. Aire Admisión (IAT)' },
    ],
  },
  {
    category: '🎯 Dinámica del Chasis y Fuerzas G',
    items: [
      { type: 'g_meter', label: 'G-Meter' },
      { type: 'g_force_bars', label: 'Barras de Fuerzas G' },
      { type: 'imu_raw', label: 'Aceleración Bruta IMU 3D (X, Y, Z)' },
    ],
  },
  {
    category: '🗺️ Navegación Satelital y Tiempo',
    items: [
      { type: 'map', label: 'Trazada GPS / Minimapa' },
      { type: 'speed_graph', label: 'Gráfica Velocidad' },
      { type: 'session_timer', label: 'Cronómetro de Tiempo' },
      { type: 'altitude', label: 'Altitud GPS' },
      { type: 'compass', label: 'Brújula / Rumbo GPS' },
      { type: 'max_stats', label: 'Récords de Sesión (Max Stats)' },
      { type: 'gps_coords', label: 'Coordenadas GPS (WGS84)' },
      { type: 'gps_accuracy', label: 'Precisión Satelital (GNSS / GPS)' },
    ],
  },
];

export const TemplateEditorScreen: React.FC<TemplateEditorScreenProps> = ({
  session,
  profile: propProfile,
  template: propTemplate,
  onTemplateUpdated,
}) => {
  const profile = useMemo(() => {
    if (propProfile) return propProfile;
    const stored = loadProfileFromStorage();
    if (stored) return stored;
    if (session?.vehicleConfigWithOrigin) {
      return deriveProfileFromAppConfig(session.vehicleConfigWithOrigin.config);
    }
    return PRESET_GASOLINA_ESTANDAR;
  }, [propProfile, session]);

  const engine = useMemo(() => {
    if (session) return TimeEngine.fromBundle(session);
    return null;
  }, [session]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Inicializar plantilla
  const [template, setTemplate] = useState<OverlayTemplate>(() => {
    return propTemplate || loadTemplateFromStorage() || TEMPLATE_MYCHRON_5;
  });

  // Sincronizar si propTemplate cambia desde el exterior
  useEffect(() => {
    if (propTemplate && propTemplate.id !== template.id) {
      setTemplate(propTemplate);
    }
  }, [propTemplate]);

  // Soporte de selección múltiple (con Ctrl / Cmd)
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<string[]>(['tachometer_circular']);
  const selectedWidgetId = selectedWidgetIds[selectedWidgetIds.length - 1] || null;
  const setSelectedWidgetId = useCallback((id: string | null) => {
    setSelectedWidgetIds(id ? [id] : []);
  }, []);

  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Lista de plantillas personalizadas guardadas por el usuario
  const [customTemplates, setCustomTemplates] = useState<OverlayTemplate[]>(() => {
    return loadCustomTemplatesFromStorage();
  });

  // Estado de interactividad / simulación
  const [currentTime, setCurrentTime] = useState<number>(10.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Historial de cambios para Deshacer / Rehacer (Ctrl+Z / Ctrl+Y)
  const [undoStack, setUndoStack] = useState<OverlayTemplate[]>([]);
  const [redoStack, setRedoStack] = useState<OverlayTemplate[]>([]);
  const dragInitialTemplateRef = useRef<OverlayTemplate | null>(null);

  const pushToUndo = useCallback((prevTemplate: OverlayTemplate) => {
    setUndoStack((prev) => [...prev.slice(-30), prevTemplate]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, template]);
    setUndoStack((prev) => prev.slice(0, -1));
    setTemplate(previous);
    setSaveMessage('Deshecho (Ctrl+Z)');
    setTimeout(() => setSaveMessage(null), 1800);
  }, [undoStack, template]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, template]);
    setRedoStack((prev) => prev.slice(0, -1));
    setTemplate(next);
    setSaveMessage('Rehecho (Ctrl+Y)');
    setTimeout(() => setSaveMessage(null), 1800);
  }, [redoStack, template]);

  const removeSelectedWidgetRef = useRef<() => void>(() => {});

  // Atajos de teclado globales para el editor (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Suprimir/Borrar, Flechas pixel a pixel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWidgetIds.length > 0) {
        e.preventDefault();
        removeSelectedWidgetRef.current();
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && selectedWidgetIds.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;

        setTemplate((prev) => {
          let minAllowedDx = -Infinity;
          let maxAllowedDx = Infinity;
          let minAllowedDy = -Infinity;
          let maxAllowedDy = Infinity;

          const selectedWidgets = prev.widgets.filter((w) => selectedWidgetIds.includes(w.id));
          if (selectedWidgets.length === 0) return prev;

          selectedWidgets.forEach((w) => {
            minAllowedDx = Math.max(minAllowedDx, -w.bounds.x);
            maxAllowedDx = Math.min(maxAllowedDx, prev.resolution.width - (w.bounds.x + w.bounds.width));
            minAllowedDy = Math.max(minAllowedDy, -w.bounds.y);
            maxAllowedDy = Math.min(maxAllowedDy, prev.resolution.height - (w.bounds.y + w.bounds.height));
          });

          const clampedDx = Math.max(minAllowedDx, Math.min(maxAllowedDx, dx));
          const clampedDy = Math.max(minAllowedDy, Math.min(maxAllowedDy, dy));

          if (clampedDx === 0 && clampedDy === 0) return prev;

          pushToUndo(prev);

          return {
            ...prev,
            widgets: prev.widgets.map((w) => {
              if (!selectedWidgetIds.includes(w.id)) return w;
              return {
                ...w,
                bounds: {
                  ...w.bounds,
                  x: Math.round(w.bounds.x + clampedDx),
                  y: Math.round(w.bounds.y + clampedDy),
                },
              };
            }),
          };
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedWidgetIds, pushToUndo]);

  // Estado de arrastre y redimensionado
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    initialBounds: WidgetBounds;
    initialBoundsMap: Map<string, WidgetBounds>;
  }>({
    mouseX: 0,
    mouseY: 0,
    initialBounds: { x: 0, y: 0, width: 0, height: 0 },
    initialBoundsMap: new Map(),
  });

  // Instancia de OverlayRenderer sincronizada con template
  const renderer = useMemo(() => {
    const r = new OverlayRenderer(template.resolution.width, template.resolution.height);
    r.applyTemplate(template);
    return r;
  }, [template]);

  const selectedWidget = template.widgets.find((w) => w.id === selectedWidgetId);

  // Bucle de animación para que los widgets se muevan en tiempo real si el usuario reproduce
  useEffect(() => {
    if (!isPlaying || !session) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.05;
        return next > session.durationSec ? 0 : next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying, session]);

  // Dibujar el canvas con widgets y las guías de selección
  const renderEditorCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Fondo de cuadrícula proporcional a la resolución (mantiene el mismo tamaño físico de celda en 720p, 1080p, 2K y 4K)
    ctx.fillStyle = '#090C0E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const resScale = canvas.width / 1280;
    const gridSize = Math.round(40 * resScale);
    const majorGridStep = gridSize * 4;

    // Líneas secundarias
    ctx.strokeStyle = '#121820';
    ctx.lineWidth = Math.max(1, Math.round(1 * resScale));
    for (let gx = 0; gx <= canvas.width; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, canvas.height);
      ctx.stroke();
    }
    for (let gy = 0; gy <= canvas.height; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(canvas.width, gy);
      ctx.stroke();
    }

    // Líneas principales cada 4 celdas para referencia de diseño
    ctx.strokeStyle = '#1B2430';
    ctx.lineWidth = Math.max(1.5, Math.round(1.5 * resScale));
    for (let gx = 0; gx <= canvas.width; gx += majorGridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, canvas.height);
      ctx.stroke();
    }
    for (let gy = 0; gy <= canvas.height; gy += majorGridStep) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(canvas.width, gy);
      ctx.stroke();
    }

    // 2. Renderizar los widgets con telemetría actual
    const snapshot = engine ? engine.query(currentTime) : (null as any);
    if (snapshot) {
      renderer.render(ctx, snapshot, profile, currentTime, session?.points);
    } else {
      // Snapshot simulado de muestra
      const dummySnap = {
        timeSec: currentTime,
        signals: {
          coolant_temp_c: {
            key: 'coolant_temp_c',
            value: 92,
            isAvailable: true,
            status: 'VALID',
            unit: '°C',
            category: 'OBD',
            label: 'Temp. Refrigerante',
          },
          boost_bar: {
            key: 'boost_bar',
            value: 0.85,
            isAvailable: true,
            status: 'VALID',
            unit: 'bar',
            category: 'OBD',
            label: 'Presión Turbo',
          },
          fuel_l100km: {
            key: 'fuel_l100km',
            value: 11.4,
            isAvailable: true,
            status: 'VALID',
            unit: 'L/100km',
            category: 'OBD',
            label: 'Consumo Combustible',
          },
          intake_temp_c: {
            key: 'intake_temp_c',
            value: 34,
            isAvailable: true,
            status: 'VALID',
            unit: '°C',
            category: 'OBD',
            label: 'Temp. Aire Admisión',
          },
          altitude_m: {
            key: 'altitude_m',
            value: 655,
            isAvailable: true,
            status: 'VALID',
            unit: 'm',
            category: 'GPS',
            label: 'Altitud',
          },
          accuracy_m: {
            key: 'accuracy_m',
            value: 1.8,
            isAvailable: true,
            status: 'VALID',
            unit: 'm',
            category: 'GPS',
            label: 'Precisión GPS',
          },
          gear: {
            key: 'gear',
            value: 3,
            isAvailable: true,
            status: 'VALID',
            unit: '',
            category: 'OBD',
            label: 'Marcha',
          },
          accel_x: { key: 'accel_x', value: 0.12, isAvailable: true, status: 'VALID', unit: 'm/s²', category: 'IMU', label: 'Acel. X' },
          accel_y: { key: 'accel_y', value: 8.25, isAvailable: true, status: 'VALID', unit: 'm/s²', category: 'IMU', label: 'Acel. Y' },
          accel_z: { key: 'accel_z', value: -1.14, isAvailable: true, status: 'VALID', unit: 'm/s²', category: 'IMU', label: 'Acel. Z' },
        } as any,
        activeEvents: [],
        speedKmh: 125.4,
        speedAvailable: true,
        rpm: 6100,
        rpmAvailable: true,
        throttlePct: 85,
        throttleAvailable: true,
        lateralG: 0.95,
        lateralGAvailable: true,
        longitudinalG: 0.35,
        longitudinalGAvailable: true,
        derivedGpsLongG: null,
        derivedGpsLongGAvailable: false,
        latitude: null,
        longitude: null,
        gpsAvailable: false,
        bearingDeg: 0,
        bearingAvailable: false,
        gear: '3',
        gearAvailable: true,
        boostBar: 0.85,
        boostAvailable: true,
        fuelL100km: 11.4,
        fuelAvailable: true,
        intakeTempC: 34,
        intakeTempAvailable: true,
        coolantTempC: 92,
        coolantTempAvailable: true,
        altitudeM: 655,
        altitudeAvailable: true,
        accuracyM: 1.8,
        accuracyAvailable: true,
        accelX: 0.12,
        accelY: 8.25,
        accelZ: -1.14,
        accelAvailable: true,
      };

      // Trazada simulada para el minimapa cuando no hay sesión cargada
      const dummyPoints = Array.from({ length: 120 }, (_, i) => {
        const angle = (i / 120) * Math.PI * 2;
        const r = 0.0025 + Math.sin(angle * 3) * 0.0008;
        return {
          time_offset_video_sec: i * 0.5,
          latitude: 40.4168 + Math.cos(angle) * r,
          longitude: -3.7038 + Math.sin(angle) * r * 1.3,
          gps_speed_kmh: 110 + Math.sin(angle * 2) * 35,
        } as any;
      });

      const carIndex = Math.floor((currentTime % 60) * 2) % dummyPoints.length;
      dummySnap.latitude = dummyPoints[carIndex].latitude;
      dummySnap.longitude = dummyPoints[carIndex].longitude;
      dummySnap.gpsAvailable = true;
      dummySnap.bearingDeg = Math.round(((carIndex / 120) * 360 + 90) % 360);
      dummySnap.bearingAvailable = true;

      renderer.render(ctx, dummySnap, profile, currentTime, session?.points || dummyPoints);
    }

    // 3. Dibujar marco de selección y manejadores sobre los widgets seleccionados
    const activeSelectedWidgets = template.widgets.filter((w) => selectedWidgetIds.includes(w.id) && w.visible);

    for (const w of activeSelectedWidgets) {
      const { x, y, width, height } = w.bounds;
      const isPrimary = w.id === selectedWidgetId;

      ctx.save();
      // Borde de selección
      ctx.strokeStyle = isPrimary ? CockpitColors.neonCyan : 'rgba(0, 229, 255, 0.55)';
      ctx.lineWidth = Math.max(1.5, Math.round(2 * resScale));
      ctx.setLineDash([4 * resScale, 4 * resScale]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // Si es el widget primario activo, dibujar los 8 manejadores de redimensión y la etiqueta de dimensiones
      if (isPrimary) {
        const handleSize = Math.max(8, Math.round(8 * resScale));
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = CockpitColors.neonCyan;
        ctx.lineWidth = Math.max(1.5, Math.round(1.5 * resScale));

        const handles = [
          { x, y }, // NW
          { x: x + width / 2, y }, // N
          { x: x + width, y }, // NE
          { x: x + width, y: y + height / 2 }, // E
          { x: x + width, y: y + height }, // SE
          { x: x + width / 2, y: y + height }, // S
          { x, y: y + height }, // SW
          { x, y: y + height / 2 }, // W
        ];

        for (const h of handles) {
          ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
        }

        // Etiqueta de dimensiones
        const labelFontSize = Math.max(11, Math.round(11 * resScale));
        ctx.font = `bold ${labelFontSize}px ui-monospace, monospace`;
        ctx.fillStyle = CockpitColors.neonCyan;
        ctx.fillText(`${Math.round(width)}x${Math.round(height)}`, x, y - Math.round(6 * resScale));
      }

      ctx.restore();
    }
  }, [engine, currentTime, renderer, profile, session?.points, selectedWidget, selectedWidgetId, selectedWidgetIds, template.widgets]);

  useEffect(() => {
    renderEditorCanvas();
  }, [renderEditorCanvas]);

  // Redibujar el lienzo en cuanto se descargue cualquier tesela de mapa de OpenStreetMap
  useEffect(() => {
    return MapTileManager.subscribe(() => {
      renderEditorCanvas();
    });
  }, [renderEditorCanvas]);

  // Conversión de coordenadas de ratón del viewport al espacio de resolución del Canvas
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Manejo de interacción de ratón (selección, mover, redimensionar)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    dragInitialTemplateRef.current = template;

    const isCtrl = e.ctrlKey || e.metaKey;

    // 1. Comprobar si se pulsó sobre un manejador del widget principal seleccionado (solo si no se está usando Ctrl)
    if (selectedWidget && selectedWidget.visible && !isCtrl) {
      const b = selectedWidget.bounds;
      const resScale = template.resolution.width / 1280;
      const hSize = Math.max(12, Math.round(12 * resScale));

      const isNear = (hx: number, hy: number) => Math.abs(x - hx) <= hSize && Math.abs(y - hy) <= hSize;
      const singleMap = new Map<string, WidgetBounds>([[selectedWidget.id, { ...b }]]);

      if (isNear(b.x + b.width, b.y + b.height)) {
        setDragMode('se');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b }, initialBoundsMap: singleMap };
        return;
      }
      if (isNear(b.x + b.width, b.y)) {
        setDragMode('ne');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b }, initialBoundsMap: singleMap };
        return;
      }
      if (isNear(b.x, b.y + b.height)) {
        setDragMode('sw');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b }, initialBoundsMap: singleMap };
        return;
      }
      if (isNear(b.x, b.y)) {
        setDragMode('nw');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b }, initialBoundsMap: singleMap };
        return;
      }
      if (isNear(b.x + b.width, b.y + b.height / 2)) {
        setDragMode('e');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b }, initialBoundsMap: singleMap };
        return;
      }
      if (isNear(b.x, b.y + b.height / 2)) {
        setDragMode('w');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b }, initialBoundsMap: singleMap };
        return;
      }
      if (isNear(b.x + b.width / 2, b.y)) {
        setDragMode('n');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b }, initialBoundsMap: singleMap };
        return;
      }
      if (isNear(b.x + b.width / 2, b.y + b.height)) {
        setDragMode('s');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b }, initialBoundsMap: singleMap };
        return;
      }
    }

    // 2. Comprobar si se pulsó sobre algún widget en el lienzo
    let hitWidget: typeof template.widgets[0] | null = null;
    for (let i = template.widgets.length - 1; i >= 0; i--) {
      const w = template.widgets[i];
      if (!w.visible) continue;
      const b = w.bounds;
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        hitWidget = w;
        break;
      }
    }

    if (hitWidget) {
      let nextSelectedIds = [...selectedWidgetIds];
      if (isCtrl) {
        if (nextSelectedIds.includes(hitWidget.id)) {
          nextSelectedIds = nextSelectedIds.filter((id) => id !== hitWidget!.id);
        } else {
          nextSelectedIds.push(hitWidget.id);
        }
      } else {
        // Clic simple: si el elemento ya formaba parte de la selección múltiple, conservamos todos para poder arrastrarlos juntos
        if (!nextSelectedIds.includes(hitWidget.id)) {
          nextSelectedIds = [hitWidget.id];
        }
      }

      setSelectedWidgetIds(nextSelectedIds);

      // Si el widget clicado sigue seleccionado, iniciar movimiento simultáneo de todos los seleccionados
      if (nextSelectedIds.includes(hitWidget.id)) {
        setDragMode('move');
        const boundsMap = new Map<string, WidgetBounds>();
        for (const wid of nextSelectedIds) {
          const item = template.widgets.find((w) => w.id === wid);
          if (item) boundsMap.set(wid, { ...item.bounds });
        }
        dragStartRef.current = {
          mouseX: x,
          mouseY: y,
          initialBounds: { ...hitWidget.bounds },
          initialBoundsMap: boundsMap,
        };
      } else {
        setDragMode('none');
      }
      return;
    }

    // 3. Clic fuera de cualquier widget: deseleccionar
    setSelectedWidgetIds([]);
    setDragMode('none');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragMode === 'none' || !selectedWidget) return;

    const { x, y } = getCanvasCoords(e);
    const dx = x - dragStartRef.current.mouseX;
    const dy = y - dragStartRef.current.mouseY;
    const init = dragStartRef.current.initialBounds;

    const minSize = 40;
    let newBounds: WidgetBounds = { ...init };
    const keepRatio = e.shiftKey;
    const aspectRatio = init.width / Math.max(1, init.height);

    if (dragMode === 'move') {
      let minAllowedDx = -Infinity;
      let maxAllowedDx = Infinity;
      let minAllowedDy = -Infinity;
      let maxAllowedDy = Infinity;

      dragStartRef.current.initialBoundsMap.forEach((initB) => {
        minAllowedDx = Math.max(minAllowedDx, -initB.x);
        maxAllowedDx = Math.min(maxAllowedDx, template.resolution.width - (initB.x + initB.width));
        minAllowedDy = Math.max(minAllowedDy, -initB.y);
        maxAllowedDy = Math.min(maxAllowedDy, template.resolution.height - (initB.y + initB.height));
      });

      const clampedDx = Math.max(minAllowedDx, Math.min(maxAllowedDx, dx));
      const clampedDy = Math.max(minAllowedDy, Math.min(maxAllowedDy, dy));

      setTemplate((prev) => ({
        ...prev,
        widgets: prev.widgets.map((w) => {
          const initB = dragStartRef.current.initialBoundsMap.get(w.id);
          if (!initB) return w;
          return {
            ...w,
            bounds: {
              ...w.bounds,
              x: Math.round(initB.x + clampedDx),
              y: Math.round(initB.y + clampedDy),
            },
          };
        }),
      }));
      return;
    } else if (dragMode === 'se') {
      if (keepRatio) {
        const scale = Math.abs(dx) > Math.abs(dy * aspectRatio) ? (init.width + dx) / init.width : (init.height + dy) / init.height;
        const w = Math.max(minSize, Math.round(init.width * scale));
        const h = Math.max(Math.round(minSize / aspectRatio), Math.round(w / aspectRatio));
        newBounds.width = Math.round(h * aspectRatio);
        newBounds.height = h;
      } else {
        newBounds.width = Math.max(minSize, init.width + dx);
        newBounds.height = Math.max(minSize, init.height + dy);
      }
    } else if (dragMode === 'ne') {
      if (keepRatio) {
        const scale = Math.abs(dx) > Math.abs(-dy * aspectRatio) ? (init.width + dx) / init.width : (init.height - dy) / init.height;
        let w = Math.max(minSize, Math.round(init.width * scale));
        let h = Math.round(w / aspectRatio);
        if (h < minSize) { h = minSize; w = Math.round(h * aspectRatio); }
        newBounds.x = init.x;
        newBounds.y = init.y + init.height - h;
        newBounds.width = w;
        newBounds.height = h;
      } else {
        newBounds.width = Math.max(minSize, init.width + dx);
        newBounds.y = init.y + dy;
        newBounds.height = Math.max(minSize, init.height - dy);
      }
    } else if (dragMode === 'sw') {
      if (keepRatio) {
        const scale = Math.abs(-dx) > Math.abs(dy * aspectRatio) ? (init.width - dx) / init.width : (init.height + dy) / init.height;
        let w = Math.max(minSize, Math.round(init.width * scale));
        let h = Math.round(w / aspectRatio);
        if (h < minSize) { h = minSize; w = Math.round(h * aspectRatio); }
        newBounds.x = init.x + init.width - w;
        newBounds.y = init.y;
        newBounds.width = w;
        newBounds.height = h;
      } else {
        newBounds.x = init.x + dx;
        newBounds.width = Math.max(minSize, init.width - dx);
        newBounds.height = Math.max(minSize, init.height + dy);
      }
    } else if (dragMode === 'nw') {
      if (keepRatio) {
        const scale = Math.abs(-dx) > Math.abs(-dy * aspectRatio) ? (init.width - dx) / init.width : (init.height - dy) / init.height;
        let w = Math.max(minSize, Math.round(init.width * scale));
        let h = Math.round(w / aspectRatio);
        if (h < minSize) { h = minSize; w = Math.round(h * aspectRatio); }
        newBounds.x = init.x + init.width - w;
        newBounds.y = init.y + init.height - h;
        newBounds.width = w;
        newBounds.height = h;
      } else {
        newBounds.x = init.x + dx;
        newBounds.y = init.y + dy;
        newBounds.width = Math.max(minSize, init.width - dx);
        newBounds.height = Math.max(minSize, init.height - dy);
      }
    } else if (dragMode === 'e') {
      if (keepRatio) {
        const w = Math.max(minSize, init.width + dx);
        const h = Math.max(Math.round(minSize / aspectRatio), Math.round(w / aspectRatio));
        newBounds.width = Math.round(h * aspectRatio);
        newBounds.height = h;
        newBounds.y = Math.round(init.y + (init.height - h) / 2);
      } else {
        newBounds.width = Math.max(minSize, init.width + dx);
      }
    } else if (dragMode === 'w') {
      if (keepRatio) {
        const w = Math.max(minSize, init.width - dx);
        const h = Math.max(Math.round(minSize / aspectRatio), Math.round(w / aspectRatio));
        const finalW = Math.round(h * aspectRatio);
        newBounds.x = init.x + init.width - finalW;
        newBounds.width = finalW;
        newBounds.height = h;
        newBounds.y = Math.round(init.y + (init.height - h) / 2);
      } else {
        newBounds.x = init.x + dx;
        newBounds.width = Math.max(minSize, init.width - dx);
      }
    } else if (dragMode === 's') {
      if (keepRatio) {
        const h = Math.max(minSize, init.height + dy);
        const w = Math.max(Math.round(minSize * aspectRatio), Math.round(h * aspectRatio));
        const finalH = Math.round(w / aspectRatio);
        newBounds.height = finalH;
        newBounds.width = w;
        newBounds.x = Math.round(init.x + (init.width - w) / 2);
      } else {
        newBounds.height = Math.max(minSize, init.height + dy);
      }
    } else if (dragMode === 'n') {
      if (keepRatio) {
        const h = Math.max(minSize, init.height - dy);
        const w = Math.max(Math.round(minSize * aspectRatio), Math.round(h * aspectRatio));
        const finalH = Math.round(w / aspectRatio);
        newBounds.y = init.y + init.height - finalH;
        newBounds.height = finalH;
        newBounds.width = w;
        newBounds.x = Math.round(init.x + (init.width - w) / 2);
      } else {
        newBounds.y = init.y + dy;
        newBounds.height = Math.max(minSize, init.height - dy);
      }
    }

    // Actualizar bounds en el template
    setTemplate((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => (w.id === selectedWidget.id ? { ...w, bounds: newBounds } : w)),
    }));
  };

  const handleMouseUp = () => {
    if (dragMode !== 'none' && dragInitialTemplateRef.current) {
      pushToUndo(dragInitialTemplateRef.current);
      dragInitialTemplateRef.current = null;
    }
    setDragMode('none');
  };

  const updateSelectedBounds = (key: keyof WidgetBounds, val: number) => {
    if (!selectedWidget) return;
    pushToUndo(template);
    setTemplate((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === selectedWidget.id
          ? { ...w, bounds: { ...w.bounds, [key]: Math.max(0, val) } }
          : w
      ),
    }));
  };

  const toggleWidgetVisibility = (id: string) => {
    pushToUndo(template);
    setTemplate((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
    }));
  };

  const addWidget = (type: WidgetType) => {
    pushToUndo(template);
    const id = `${type}_${Date.now()}`;
    let name = 'Nuevo Widget';
    let bounds: WidgetBounds = { x: 100, y: 100, width: 200, height: 120 };

    if (type === 'tachometer_circular') {
      name = 'Tacómetro Circular';
      bounds = { x: 100, y: 100, width: 240, height: 240 };
    } else if (type === 'tachometer_forza') {
      name = 'Tacómetro Racing (Estilo Forza)';
      bounds = { x: 50, y: 430, width: 280, height: 260 };
    } else if (type === 'shift_lights') {
      name = 'Shift Lights';
      bounds = { x: 300, y: 30, width: 360, height: 44 };
    } else if (type === 'speedometer') {
      name = 'Velocímetro';
      bounds = { x: 100, y: 200, width: 200, height: 110 };
    } else if (type === 'throttle') {
      name = 'Pedal Acelerador';
      bounds = { x: 320, y: 200, width: 55, height: 110 };
    } else if (type === 'g_meter') {
      name = 'G-Meter';
      bounds = { x: 400, y: 200, width: 140, height: 140 };
    } else if (type === 'map') {
      name = 'Trazada GPS';
      bounds = { x: 560, y: 50, width: 180, height: 140 };
    } else if (type === 'speed_graph') {
      name = 'Gráfica de Velocidad';
      bounds = { x: 100, y: 350, width: 400, height: 120 };
    } else if (type === 'gear_indicator') {
      name = 'Indicador de Marcha (Gear)';
      bounds = { x: 300, y: 200, width: 80, height: 100 };
    } else if (type === 'coolant_temp') {
      name = 'Temp. Refrigerante OBD';
      bounds = { x: 100, y: 150, width: 140, height: 75 };
    } else if (type === 'brake_throttle') {
      name = 'Pedales Duales (Freno / Gas)';
      bounds = { x: 390, y: 200, width: 85, height: 110 };
    } else if (type === 'tachometer_bar') {
      name = 'Tacómetro de Barra GT';
      bounds = { x: 200, y: 350, width: 380, height: 45 };
    } else if (type === 'session_timer') {
      name = 'Cronómetro de Tiempo';
      bounds = { x: 35, y: 25, width: 140, height: 44 };
    } else if (type === 'g_force_bars') {
      name = 'Barras de Fuerzas G';
      bounds = { x: 300, y: 150, width: 180, height: 90 };
    } else if (type === 'altitude') {
      name = 'Altitud GPS';
      bounds = { x: 100, y: 150, width: 85, height: 68 };
    } else if (type === 'compass') {
      name = 'Brújula / Rumbo GPS';
      bounds = { x: 450, y: 150, width: 120, height: 120 };
    } else if (type === 'tachometer_horizontal') {
      name = 'Tacómetro Horizontal F1/GT3';
      bounds = { x: 340, y: 25, width: 600, height: 68 };
    } else if (type === 'max_stats') {
      name = 'Récords de Sesión (Max Stats)';
      bounds = { x: 80, y: 350, width: 230, height: 80 };
    } else if (type === 'gps_coords') {
      name = 'Coordenadas GPS (WGS84)';
      bounds = { x: 100, y: 150, width: 190, height: 80 };
    } else if (type === 'boost') {
      name = 'Presión de Turbo (Boost)';
      bounds = { x: 100, y: 220, width: 140, height: 75 };
    } else if (type === 'fuel_consumption') {
      name = 'Consumo de Combustible (L/100km)';
      bounds = { x: 100, y: 305, width: 140, height: 75 };
    } else if (type === 'intake_temp') {
      name = 'Temp. Aire Admisión (IAT)';
      bounds = { x: 100, y: 390, width: 140, height: 75 };
    } else if (type === 'imu_raw') {
      name = 'Aceleración Bruta IMU 3D';
      bounds = { x: 300, y: 350, width: 170, height: 95 };
    } else if (type === 'gps_accuracy') {
      name = 'Precisión Satelital (GNSS / GPS)';
      bounds = { x: 1065, y: 165, width: 140, height: 60 };
    }

    // Escalar bounds si la resolución actual no es 720p
    const resScale = template.resolution.width / 1280;
    if (resScale !== 1) {
      bounds = {
        x: Math.round(bounds.x * resScale),
        y: Math.round(bounds.y * resScale),
        width: Math.round(bounds.width * resScale),
        height: Math.round(bounds.height * resScale),
      };
    }

    setTemplate((prev) => ({
      ...prev,
      widgets: [...prev.widgets, { id, type, name, bounds, visible: true }],
    }));
    setSelectedWidgetId(id);
  };

  const removeSelectedWidget = () => {
    if (selectedWidgetIds.length === 0) return;
    pushToUndo(template);
    setTemplate((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => !selectedWidgetIds.includes(w.id)),
    }));
    setSelectedWidgetIds([]);
  };
  removeSelectedWidgetRef.current = removeSelectedWidget;

  const handleSaveTemplate = () => {
    let tplToSave = template;
    // Si la plantilla actual proviene de las integradas, crear un ID único para la del usuario
    if (!tplToSave.id.startsWith('custom_')) {
      tplToSave = {
        ...template,
        id: `custom_${Date.now()}`,
        name: template.name.includes('(Personalizada)') ? template.name : `${template.name} (Personalizada)`,
      };
      setTemplate(tplToSave);
    }
    const updated = saveCustomTemplate(tplToSave);
    setCustomTemplates(updated);
    onTemplateUpdated?.(tplToSave);
    setSaveMessage(`¡Plantilla "${tplToSave.name}" guardada en Mis Plantillas!`);
    setTimeout(() => setSaveMessage(null), 3500);
  };

  const handleSaveAsNewTemplate = () => {
    const newId = `custom_${Date.now()}`;
    const baseName = template.name.replace(/\s*\(Copia\s*\d*\)$/, '').replace(/\s*\(Nueva\)$/, '');
    const newName = `${baseName} (Nueva)`;
    const newTemplate: OverlayTemplate = {
      ...template,
      id: newId,
      name: newName,
    };
    setTemplate(newTemplate);
    const updated = saveCustomTemplate(newTemplate);
    setCustomTemplates(updated);
    onTemplateUpdated?.(newTemplate);
    setSaveMessage(`¡Nueva plantilla "${newName}" creada y guardada!`);
    setTimeout(() => setSaveMessage(null), 3500);
  };

  const handleDeleteCustomTemplate = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = customTemplates.find((ct) => ct.id === idToDelete);
    const confirmText = target ? `¿Deseas eliminar la plantilla "${target.name}"?` : '¿Deseas eliminar esta plantilla?';
    if (!window.confirm(confirmText)) return;

    const updated = deleteCustomTemplate(idToDelete);
    setCustomTemplates(updated);
    if (template.id === idToDelete) {
      const fallback = updated[0] || TEMPLATE_MYCHRON_5;
      setTemplate(fallback);
      saveTemplateToStorage(fallback);
      onTemplateUpdated?.(fallback);
    }
    setSaveMessage('Plantilla eliminada de Mis Plantillas');
    setTimeout(() => setSaveMessage(null), 2500);
  };

  const handleDuplicateCustomTemplate = (targetTemplate: OverlayTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = `custom_${Date.now()}`;
    const newName = `${targetTemplate.name} (Copia)`;
    const duplicated: OverlayTemplate = {
      ...targetTemplate,
      id: newId,
      name: newName,
    };
    const updated = saveCustomTemplate(duplicated);
    setCustomTemplates(updated);
    setSaveMessage(`¡Plantilla "${newName}" duplicada!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(template, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_${sanitizeFilename(template.name.toLowerCase())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.widgets && Array.isArray(parsed.widgets)) {
            const customId = `custom_${Date.now()}`;
            const templateToImport: OverlayTemplate = {
              ...parsed,
              id: customId,
              name: parsed.name || 'Plantilla Importada',
            };
            setTemplate(templateToImport);
            const updated = saveCustomTemplate(templateToImport);
            setCustomTemplates(updated);
            onTemplateUpdated?.(templateToImport);
            setSaveMessage(`¡Plantilla "${templateToImport.name}" importada y guardada en Mis Plantillas!`);
            setTimeout(() => setSaveMessage(null), 3500);
          } else {
            alert('El archivo no contiene una plantilla válida.');
          }
        } catch {
          alert('Error al leer el archivo JSON.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="px-6 py-4 w-full space-y-4 animate-fadeIn">
      {/* 1. Barra de herramientas superior */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl px-5 py-3 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1A222B] border border-[#2C3947] flex items-center justify-center text-[#00E5FF]">
            <Sliders className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-[#F0F4F8]">
                Editor Visual de Plantillas Overlay
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1A222B] text-[#00E676] border border-[#2C3947]">
                {template.resolution.width}x{template.resolution.height}
              </span>
            </div>
            {/* Input para editar el nombre de la plantilla directamente */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-mono text-[#8B9CB0]">Nombre:</span>
              <input
                type="text"
                value={template.name}
                onChange={(e) => setTemplate((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-[#090C0E] border border-[#2C3947] focus:border-[#00E676] rounded px-2.5 py-1 text-xs font-bold text-[#F0F4F8] outline-none w-56 sm:w-72 transition-colors placeholder-[#4A5568]"
                placeholder="Nombre de la plantilla..."
              />
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2 flex-wrap">
          {saveMessage && (
            <span className="text-xs text-[#00E676] font-semibold mr-2 animate-fadeIn">
              {saveMessage}
            </span>
          )}

          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] disabled:opacity-35 disabled:cursor-not-allowed text-[#F0F4F8] border border-[#2C3947] transition-all cursor-pointer"
            title="Deshacer (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="hidden sm:inline">Deshacer</span>
          </button>

          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] disabled:opacity-35 disabled:cursor-not-allowed text-[#F0F4F8] border border-[#2C3947] transition-all cursor-pointer"
            title="Rehacer (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="hidden sm:inline">Rehacer</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-all cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Importar</span>
            <input type="file" accept=".json" className="hidden" onChange={handleImportJson} />
          </label>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-all cursor-pointer"
            title="Exportar plantilla a archivo JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>

          <button
            onClick={handleSaveAsNewTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#00E5FF] border border-[#00E5FF]/40 transition-all cursor-pointer shadow-sm"
            title="Crear y guardar una nueva plantilla en Mis Plantillas con este diseño y nombre"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Guardar como Nueva</span>
          </button>

          <button
            onClick={handleSaveTemplate}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] transition-all cursor-pointer shadow-[0_0_12px_rgba(0,230,118,0.2)]"
            title="Guardar cambios de la plantilla en Mis Plantillas y aplicarla al reproductor"
          >
            <Save className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Guardar Plantilla</span>
          </button>
        </div>
      </div>

      {/* 2. Disposición principal: Capas (izq) | Canvas (centro) | Inspector (der) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Panel izquierdo: Capas y Añadir widgets */}
        <div className="lg:col-span-3 xl:col-span-3 2xl:col-span-2 bg-[#13181E] border border-[#2C3947] rounded-xl p-4 shadow-lg space-y-4">
          <div className="space-y-2.5 border-b border-[#2C3947] pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#F0F4F8] uppercase flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00E5FF]" />
                Capas ({template.widgets.length})
              </span>
            </div>

            {/* Selector categorizado para añadir nuevo widget excluyendo los ya agregados */}
            {(() => {
              const existingTypes = new Set(template.widgets.map((w) => w.type));
              const availableCategories = WIDGET_CATEGORIES.map((cat) => ({
                ...cat,
                items: cat.items.filter((item) => !existingTypes.has(item.type)),
              })).filter((cat) => cat.items.length > 0);

              const totalAvailable = availableCategories.reduce((acc, c) => acc + c.items.length, 0);

              return (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addWidget(e.target.value as WidgetType);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  disabled={totalAvailable === 0}
                  className="w-full bg-[#1A222B] hover:bg-[#202B37] disabled:opacity-50 border border-[#2C3947] text-xs font-mono text-[#00E676] rounded px-2.5 py-1.5 outline-none cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  <option value="" disabled>
                    {totalAvailable > 0
                      ? `+ Añadir widget (${totalAvailable} disp.)...`
                      : 'Todos los widgets añadidos (24/24)'}
                  </option>
                  {availableCategories.map((cat) => (
                    <optgroup key={cat.category} label={cat.category} className="bg-[#13181E] text-[#8B9CB0] font-sans font-bold">
                      {cat.items.map((item) => (
                        <option key={item.type} value={item.type} className="bg-[#1A222B] text-[#F0F4F8] font-mono">
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              );
            })()}
          </div>

          {/* Lista de widgets */}
          <div className="space-y-1.5 max-h-[580px] overflow-y-auto">
            {template.widgets.map((w) => {
              const isSelected = selectedWidgetIds.includes(w.id);
              return (
                <div
                  key={w.id}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      setSelectedWidgetIds((prev) =>
                        prev.includes(w.id) ? prev.filter((id) => id !== w.id) : [...prev, w.id]
                      );
                    } else {
                      setSelectedWidgetIds([w.id]);
                    }
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-[#1A222B] text-[#00E676] border-[#00E676]/60 shadow-sm ring-1 ring-[#00E676]/30'
                      : 'bg-[#090C0E]/50 text-[#8B9CB0] hover:text-[#F0F4F8] border-[#2C3947]/70'
                  }`}
                  title="Haz clic para seleccionar o mantén Ctrl para selección múltiple"
                >
                  <span className="truncate font-medium">{w.name}</span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWidgetVisibility(w.id);
                      }}
                      className="p-1 hover:text-[#F0F4F8] transition-colors"
                    >
                      {w.visible ? <Eye className="w-3.5 h-3.5 text-[#00E676]" /> : <EyeOff className="w-3.5 h-3.5 text-[#4A5568]" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mis Plantillas Personalizadas */}
          <div className="pt-3 border-t border-[#2C3947] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#00E676] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span>Mis Plantillas</span>
                <span className="bg-[#1A222B] text-[#00E676] border border-[#2C3947] rounded-full px-1.5 py-0.2 text-[10px]">
                  {customTemplates.length}
                </span>
              </span>
              <button
                onClick={handleSaveAsNewTemplate}
                className="text-[10px] font-mono text-[#8B9CB0] hover:text-[#00E676] flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1A222B] border border-[#2C3947] hover:border-[#00E676]/50 transition-colors cursor-pointer"
                title="Crear nueva plantilla a partir del diseño actual"
              >
                <Plus className="w-3 h-3" />
                <span>Nueva</span>
              </button>
            </div>

            {customTemplates.length === 0 ? (
              <div className="p-2.5 rounded-lg border border-dashed border-[#2C3947] bg-[#090C0E]/40 text-center">
                <p className="text-[11px] text-[#8B9CB0]">Aún no has guardado ninguna plantilla propia.</p>
                <p className="text-[10px] text-[#8B9CB0]/70 mt-1">
                  Ponle un nombre y pulsa <strong className="text-[#00E676]">"Guardar Plantilla"</strong> para crearla.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                {customTemplates.map((ct) => {
                  const isActive = template.id === ct.id;
                  return (
                    <div
                      key={ct.id}
                      onClick={() => {
                        setTemplate(ct);
                        setSelectedWidgetId(ct.widgets[0]?.id || null);
                        saveTemplateToStorage(ct);
                        onTemplateUpdated?.(ct);
                        setSaveMessage(`¡Plantilla "${ct.name}" cargada y aplicada!`);
                        setTimeout(() => setSaveMessage(null), 3000);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left text-xs font-mono border transition-all flex items-center justify-between gap-1.5 group cursor-pointer ${
                        isActive
                          ? 'bg-[#1A222B] text-[#00E676] border-[#00E676]/70 shadow-[0_0_8px_rgba(0,230,118,0.15)] font-bold'
                          : 'bg-[#090C0E]/70 hover:bg-[#1A222B] text-[#F0F4F8] border-[#2C3947]'
                      }`}
                    >
                      <div className="truncate flex-1">
                        <span className="truncate block">{ct.name}</span>
                        <span className="text-[10px] text-[#8B9CB0] block font-normal">
                          {ct.resolution.width}x{ct.resolution.height} · {ct.widgets.length} widgets
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={(e) => handleDuplicateCustomTemplate(ct, e)}
                          className="p-1 text-[#8B9CB0] hover:text-[#00E5FF] transition-colors rounded hover:bg-[#2C3947]"
                          title={`Duplicar plantilla "${ct.name}"`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteCustomTemplate(ct.id, e)}
                          className="p-1 text-[#8B9CB0] hover:text-[#FF5252] transition-colors rounded hover:bg-[#2C3947]"
                          title={`Eliminar plantilla "${ct.name}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Plantillas integradas rápidas */}
          <div className="pt-3 border-t border-[#2C3947] space-y-2">
            <span className="text-[11px] font-mono text-[#8B9CB0] uppercase">Plantillas Integradas:</span>
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-0.5">
              {BUILTIN_TEMPLATES.map((bt) => {
                const isActive = template.id === bt.id;
                return (
                  <button
                    key={bt.id}
                    onClick={() => {
                      setTemplate(bt);
                      setSelectedWidgetId(bt.widgets[0]?.id || null);
                      saveTemplateToStorage(bt);
                      onTemplateUpdated?.(bt);
                      setSaveMessage(`¡Plantilla "${bt.name}" activada y aplicada al reproductor!`);
                      setTimeout(() => setSaveMessage(null), 3000);
                    }}
                    title={`${bt.name} - ${bt.description}`}
                    className={`px-2.5 py-1.5 rounded text-left text-xs font-mono border transition-colors flex items-center justify-between gap-1.5 group cursor-pointer ${
                      isActive
                        ? 'bg-[#1A222B] text-[#00E676] border-[#00E676]/70 font-bold'
                        : 'bg-[#1A222B]/70 hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border-[#2C3947]'
                    }`}
                  >
                    <span className="truncate group-hover:text-[#F0F4F8]">{bt.name}</span>
                    <Sparkles className="w-3 h-3 text-[#FFB300] shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel central: Lienzo de diseño Canvas */}
        <div className="lg:col-span-6 xl:col-span-6 2xl:col-span-8 flex flex-col space-y-3">
          <div
            ref={containerRef}
            className="bg-[#090C0E] border border-[#2C3947] rounded-xl overflow-hidden shadow-2xl relative aspect-video flex items-center justify-center"
          >
            <canvas
              ref={canvasRef}
              width={template.resolution.width}
              height={template.resolution.height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="w-full h-full object-contain cursor-crosshair select-none"
            />
          </div>

          {/* Controles de reproducción interactiva de prueba */}
          <div className="bg-[#13181E] border border-[#2C3947] rounded-xl px-4 py-2 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1.5 rounded-lg bg-[#00E676] text-[#090C0E] font-bold"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
              </button>
              <span className="text-[#8B9CB0]">Simular tiempo:</span>
              <span className="text-[#00E5FF] font-bold">{currentTime.toFixed(2)}s</span>
            </div>

            <input
              type="range"
              min={0}
              max={session ? session.durationSec : 90}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentTime(parseFloat(e.target.value));
              }}
              className="w-48 accent-[#00E676] cursor-pointer"
            />
          </div>
        </div>

        {/* Panel derecho: Inspector de Propiedades */}
        <div className="lg:col-span-3 xl:col-span-3 2xl:col-span-2 bg-[#13181E] border border-[#2C3947] rounded-xl p-4 shadow-lg space-y-4 self-start h-fit">
          <div className="flex items-center justify-between border-b border-[#2C3947] pb-2.5">
            <span className="text-xs font-mono font-bold text-[#F0F4F8] uppercase flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#00E676]" />
              Propiedades
            </span>

            {selectedWidgetIds.length > 0 && (
              <button
                onClick={removeSelectedWidget}
                className="p-1 rounded text-[#FF1744] hover:bg-[#FF1744]/10 transition-colors"
                title={selectedWidgetIds.length > 1 ? `Eliminar ${selectedWidgetIds.length} widgets` : 'Eliminar widget'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {selectedWidgetIds.length > 1 ? (
            <div className="space-y-4 text-xs font-mono">
              <div className="bg-[#1A222B] border border-[#00E5FF]/40 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-[#00E5FF] font-bold">
                  <Layers className="w-4 h-4" />
                  <span>Selección Múltiple ({selectedWidgetIds.length})</span>
                </div>
                <p className="text-[11px] text-[#8B9CB0] leading-relaxed">
                  Has seleccionado {selectedWidgetIds.length} widgets. Puedes arrastrarlos juntos por el lienzo o moverlos pixel a pixel con las <span className="text-[#F0F4F8] font-bold">flechas del teclado</span> (<kbd className="px-1 py-0.5 rounded bg-[#090C0E] border border-[#2C3947] text-[10px]">Shift</kbd> para 10px).
                </p>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {template.widgets
                  .filter((w) => selectedWidgetIds.includes(w.id))
                  .map((w) => (
                    <div
                      key={w.id}
                      className="text-[11px] text-[#F0F4F8] bg-[#090C0E] px-2.5 py-1.5 rounded border border-[#2C3947] flex items-center justify-between"
                    >
                      <span className="truncate font-medium">{w.name}</span>
                      <span className="text-[#8B9CB0] shrink-0 font-mono text-[10px]">
                        X:{Math.round(w.bounds.x)} Y:{Math.round(w.bounds.y)}
                      </span>
                    </div>
                  ))}
              </div>

              <button
                onClick={removeSelectedWidget}
                className="w-full py-2 px-3 rounded-lg bg-[#FF1744]/10 hover:bg-[#FF1744]/20 text-[#FF1744] border border-[#FF1744]/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar {selectedWidgetIds.length} widgets seleccionados</span>
              </button>
            </div>
          ) : selectedWidget ? (
            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[#8B9CB0] mb-1">Nombre:</label>
                <input
                  type="text"
                  value={selectedWidget.name}
                  onChange={(e) =>
                    setTemplate((prev) => ({
                      ...prev,
                      widgets: prev.widgets.map((w) =>
                        w.id === selectedWidget.id ? { ...w, name: e.target.value } : w
                      ),
                    }))
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2.5 py-1.5 text-[#F0F4F8] outline-none focus:border-[#00E676]"
                />
              </div>

              {/* Posición X, Y */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#8B9CB0] mb-1">Posición X:</label>
                  <input
                    type="number"
                    value={Math.round(selectedWidget.bounds.x)}
                    onChange={(e) => updateSelectedBounds('x', parseInt(e.target.value) || 0)}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2 py-1 text-[#F0F4F8] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#8B9CB0] mb-1">Posición Y:</label>
                  <input
                    type="number"
                    value={Math.round(selectedWidget.bounds.y)}
                    onChange={(e) => updateSelectedBounds('y', parseInt(e.target.value) || 0)}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2 py-1 text-[#F0F4F8] outline-none"
                  />
                </div>
              </div>

              {/* Dimensiones W, H */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#8B9CB0] mb-1">Ancho (W):</label>
                  <input
                    type="number"
                    value={Math.round(selectedWidget.bounds.width)}
                    onChange={(e) => updateSelectedBounds('width', parseInt(e.target.value) || 10)}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2 py-1 text-[#F0F4F8] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#8B9CB0] mb-1">Alto (H):</label>
                  <input
                    type="number"
                    value={Math.round(selectedWidget.bounds.height)}
                    onChange={(e) => updateSelectedBounds('height', parseInt(e.target.value) || 10)}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2 py-1 text-[#F0F4F8] outline-none"
                  />
                </div>
              </div>

              {/* Opciones particulares por tipo de widget */}
              {selectedWidget.type === 'speedometer' && (
                <div className="pt-2 border-t border-[#2C3947] space-y-2">
                  <label className="block text-[#8B9CB0]">Fuente de Velocidad:</label>
                  <select
                    value={selectedWidget.properties?.preferredSource || 'GPS'}
                    onChange={(e) => {
                      const src = e.target.value;
                      setTemplate((prev) => ({
                        ...prev,
                        widgets: prev.widgets.map((w) =>
                          w.id === selectedWidget.id
                            ? { ...w, properties: { ...w.properties, preferredSource: src } }
                            : w
                        ),
                      }));
                    }}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2 py-1 text-[#F0F4F8]"
                  >
                    <option value="GPS">Velocidad GPS</option>
                    <option value="OBD">Velocidad OBD</option>
                  </select>
                </div>
              )}

              {selectedWidget.type === 'g_meter' && (
                <div className="pt-2 border-t border-[#2C3947] space-y-2">
                  <label className="block text-[#8B9CB0]">Escala Máxima:</label>
                  <select
                    value={selectedWidget.properties?.maxScaleG || 1.5}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTemplate((prev) => ({
                        ...prev,
                        widgets: prev.widgets.map((w) =>
                          w.id === selectedWidget.id
                            ? { ...w, properties: { ...w.properties, maxScaleG: val } }
                            : w
                        ),
                      }));
                    }}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2 py-1 text-[#F0F4F8]"
                  >
                    <option value="1.0">1.0 G</option>
                    <option value="1.5">1.5 G (Competición)</option>
                    <option value="2.0">2.0 G (Fórmula / Kart)</option>
                  </select>
                </div>
              )}

              {selectedWidget.type === 'map' && (
                <div className="pt-2 border-t border-[#2C3947] space-y-3">
                  <div>
                    <label className="block text-[#8B9CB0] mb-1">Modo de Trazada / Minimapa:</label>
                    <select
                      value={selectedWidget.properties?.mode || 'chase_north'}
                      onChange={(e) => {
                        const m = e.target.value;
                        setTemplate((prev) => ({
                          ...prev,
                          widgets: prev.widgets.map((w) =>
                            w.id === selectedWidget.id
                              ? { ...w, properties: { ...w.properties, mode: m } }
                              : w
                          ),
                        }));
                      }}
                      className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2 py-1 text-[#F0F4F8]"
                    >
                      <option value="chase_north">Minimapa Centrado (Norte Arriba - Fluido)</option>
                      <option value="chase_heading">Minimapa con Rotación de Rumbo</option>
                      <option value="full_circuit">Circuito Completo (Estático)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#8B9CB0] mb-1">Zoom del Minimapa (Radio):</label>
                    <select
                      value={selectedWidget.properties?.zoomMeters || 120}
                      onChange={(e) => {
                        const z = parseInt(e.target.value);
                        setTemplate((prev) => ({
                          ...prev,
                          widgets: prev.widgets.map((w) =>
                            w.id === selectedWidget.id
                              ? { ...w, properties: { ...w.properties, zoomMeters: z } }
                              : w
                          ),
                        }));
                      }}
                      className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2 py-1 text-[#F0F4F8]"
                    >
                      <option value={40}>40 metros (Ultra Zoom / Chicane / Kart)</option>
                      <option value={75}>75 metros (Super Zoom / Curvas Lentas)</option>
                      <option value={120}>120 metros (Zoom Deportivo / Recomendado)</option>
                      <option value={200}>200 metros (Zoom Medio)</option>
                      <option value={350}>350 metros (Circuito Rápido)</option>
                      <option value={600}>600 metros (Panorámico)</option>
                      <option value={1200}>1200 metros (Tramo Largo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#8B9CB0] mb-1">Fondo de Mapa Callejero (Tiles):</label>
                    <select
                      value={selectedWidget.properties?.mapBackground || 'none'}
                      onChange={(e) => {
                        const bg = e.target.value;
                        setTemplate((prev) => ({
                          ...prev,
                          widgets: prev.widgets.map((w) =>
                            w.id === selectedWidget.id
                              ? { ...w, properties: { ...w.properties, mapBackground: bg } }
                              : w
                          ),
                        }));
                      }}
                      className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2 py-1 text-[#F0F4F8]"
                    >
                      <option value="none">Oscuro Vectorial (Predeterminado)</option>
                      <option value="osm">OpenStreetMap Estándar (App Móvil Tachyon)</option>
                      <option value="carto_voyager">CartoDB Voyager (Calles Detalladas a Color)</option>
                      <option value="carto_dark">CartoDB Dark Matter (Oscuro con Calles)</option>
                      <option value="carto_light">CartoDB Positron (Calles Claras)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-[#8B9CB0]">
              Selecciona un widget en el lienzo o en la lista de capas para editar sus propiedades.
            </div>
          )}

          {/* Configuración global de la plantilla */}
          <div className="pt-4 border-t border-[#2C3947] space-y-3 text-xs font-mono">
            <span className="text-[#8B9CB0] uppercase block">Resolución de salida:</span>
            <select
              value={`${template.resolution.width}x${template.resolution.height}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                setTemplate((prev) => scaleTemplate(prev, w, h));
              }}
              className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2 py-1 text-[#F0F4F8] outline-none cursor-pointer focus:border-[#00E676]"
            >
              <option value="1280x720">1280 x 720 (720p HD)</option>
              <option value="1920x1080">1920 x 1080 (1080p Full HD)</option>
              <option value="2560x1440">2560 x 1440 (2K QHD)</option>
              <option value="3840x2160">3840 x 2160 (4K Ultra HD)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
