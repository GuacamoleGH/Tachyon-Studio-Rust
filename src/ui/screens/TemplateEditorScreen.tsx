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
} from 'lucide-react';
import { WidgetBounds, WidgetType } from '../../engine/widgets/types';
import { OverlayRenderer } from '../../engine/canvas/overlayRenderer';
import {
  BUILTIN_TEMPLATES,
  loadTemplateFromStorage,
  OverlayTemplate,
  saveTemplateToStorage,
  scaleTemplate,
  TEMPLATE_MYCHRON_5,
} from '../../core/templates/templateModel';
import { SessionBundle } from '../../core/model/session';
import { VehicleProfile, deriveProfileFromAppConfig, PRESET_GASOLINA_ESTANDAR, loadProfileFromStorage } from '../../core/profile/vehicleProfile';
import { TimeEngine } from '../../core/telemetry/timeEngine';
import { CockpitColors } from '../../core/theme/colors';
import { MapTileManager } from '../../engine/maps/MapTileManager';

interface TemplateEditorScreenProps {
  session?: SessionBundle | null;
  profile?: VehicleProfile;
  template?: OverlayTemplate;
  onTemplateUpdated?: (template: OverlayTemplate) => void;
}

type DragMode = 'none' | 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

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

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>('tachometer_circular');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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

  // Atajos de teclado globales para el editor (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Estado de arrastre y redimensionado
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialBounds: WidgetBounds }>({
    mouseX: 0,
    mouseY: 0,
    initialBounds: { x: 0, y: 0, width: 0, height: 0 },
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

    // 3. Dibujar marco de selección y manejadores de redimensionado sobre el widget seleccionado
    if (selectedWidget && selectedWidget.visible) {
      const { x, y, width, height } = selectedWidget.bounds;

      ctx.save();
      // Borde de selección
      ctx.strokeStyle = CockpitColors.neonCyan;
      ctx.lineWidth = Math.max(1.5, Math.round(2 * resScale));
      ctx.setLineDash([4 * resScale, 4 * resScale]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // 8 Manejadores de redimensión en las esquinas y puntos medios escalados
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

      ctx.restore();
    }
  }, [engine, currentTime, renderer, profile, session?.points, selectedWidget]);

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

    // 1. Comprobar si se pulsó sobre un manejador del widget seleccionado
    if (selectedWidget && selectedWidget.visible) {
      const b = selectedWidget.bounds;
      const resScale = template.resolution.width / 1280;
      const hSize = Math.max(12, Math.round(12 * resScale));

      const isNear = (hx: number, hy: number) => Math.abs(x - hx) <= hSize && Math.abs(y - hy) <= hSize;

      if (isNear(b.x + b.width, b.y + b.height)) {
        setDragMode('se');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b } };
        return;
      }
      if (isNear(b.x + b.width, b.y)) {
        setDragMode('ne');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b } };
        return;
      }
      if (isNear(b.x, b.y + b.height)) {
        setDragMode('sw');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b } };
        return;
      }
      if (isNear(b.x, b.y)) {
        setDragMode('nw');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b } };
        return;
      }
      if (isNear(b.x + b.width, b.y + b.height / 2)) {
        setDragMode('e');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b } };
        return;
      }
      if (isNear(b.x + b.width / 2, b.y + b.height)) {
        setDragMode('s');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b } };
        return;
      }

      // Si se pulsa dentro del cuerpo del widget seleccionado, iniciar movimiento
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        setDragMode('move');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b } };
        return;
      }
    }

    // 2. Comprobar si se pulsó sobre algún otro widget visible
    for (let i = template.widgets.length - 1; i >= 0; i--) {
      const w = template.widgets[i];
      if (!w.visible) continue;
      const b = w.bounds;
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        setSelectedWidgetId(w.id);
        setDragMode('move');
        dragStartRef.current = { mouseX: x, mouseY: y, initialBounds: { ...b } };
        return;
      }
    }

    // 3. Clic fuera de cualquier widget: deseleccionar
    setSelectedWidgetId(null);
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

    if (dragMode === 'move') {
      newBounds.x = Math.max(0, Math.min(template.resolution.width - init.width, init.x + dx));
      newBounds.y = Math.max(0, Math.min(template.resolution.height - init.height, init.y + dy));
    } else if (dragMode === 'se') {
      newBounds.width = Math.max(minSize, init.width + dx);
      newBounds.height = Math.max(minSize, init.height + dy);
    } else if (dragMode === 'e') {
      newBounds.width = Math.max(minSize, init.width + dx);
    } else if (dragMode === 's') {
      newBounds.height = Math.max(minSize, init.height + dy);
    } else if (dragMode === 'ne') {
      newBounds.width = Math.max(minSize, init.width + dx);
      newBounds.y = init.y + dy;
      newBounds.height = Math.max(minSize, init.height - dy);
    } else if (dragMode === 'sw') {
      newBounds.x = init.x + dx;
      newBounds.width = Math.max(minSize, init.width - dx);
      newBounds.height = Math.max(minSize, init.height + dy);
    } else if (dragMode === 'nw') {
      newBounds.x = init.x + dx;
      newBounds.y = init.y + dy;
      newBounds.width = Math.max(minSize, init.width - dx);
      newBounds.height = Math.max(minSize, init.height - dy);
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
    if (!selectedWidget) return;
    pushToUndo(template);
    setTemplate((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.id !== selectedWidget.id),
    }));
    setSelectedWidgetId(null);
  };

  const handleSaveTemplate = () => {
    saveTemplateToStorage(template);
    onTemplateUpdated?.(template);
    setSaveMessage('¡Plantilla guardada y aplicada al reproductor con éxito!');
    setTimeout(() => setSaveMessage(null), 3500);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(template, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_${template.name.toLowerCase().replace(/\s+/g, '_')}.json`;
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
            setTemplate(parsed);
            saveTemplateToStorage(parsed);
            onTemplateUpdated?.(parsed);
            setSaveMessage(`¡Plantilla "${parsed.name || 'importada'}" cargada y aplicada con éxito!`);
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
            <h1 className="text-base font-bold text-[#F0F4F8] flex items-center gap-2">
              Editor Visual de Plantillas Overlay
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1A222B] text-[#00E676] border border-[#2C3947]">
                {template.resolution.width}x{template.resolution.height}
              </span>
            </h1>
            <p className="text-xs text-[#8B9CB0]">
              Arrastra y redimensiona los widgets directamente en el lienzo para componer el panel de instrumentos a tu medida.
            </p>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2">
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
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>

          <button
            onClick={handleSaveTemplate}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] transition-all cursor-pointer shadow-[0_0_12px_rgba(0,230,118,0.2)]"
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

            {/* Selector para añadir nuevo widget a ancho completo */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addWidget(e.target.value as WidgetType);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="w-full bg-[#1A222B] hover:bg-[#202B37] border border-[#2C3947] text-xs font-mono text-[#00E676] rounded px-2.5 py-1.5 outline-none cursor-pointer transition-colors"
            >
              <option value="" disabled>
                + Añadir widget...
              </option>
              <option value="tachometer_circular">Tacómetro Circular</option>
              <option value="tachometer_forza">Tacómetro Racing (Estilo Forza)</option>
              <option value="tachometer_bar">Tacómetro de Barra GT</option>
              <option value="tachometer_horizontal">Tacómetro Horizontal F1/GT3</option>
              <option value="shift_lights">Shift Lights</option>
              <option value="gear_indicator">Indicador de Marcha (Gear)</option>
              <option value="speedometer">Velocímetro Digital</option>
              <option value="throttle">Pedal Acelerador</option>
              <option value="brake_throttle">Pedales Duales (Freno / Gas)</option>
              <option value="coolant_temp">Temp. Refrigerante OBD</option>
              <option value="g_meter">G-Meter</option>
              <option value="map">Trazada GPS / Minimapa</option>
              <option value="speed_graph">Gráfica Velocidad</option>
              <option value="session_timer">Cronómetro de Tiempo</option>
              <option value="g_force_bars">Barras de Fuerzas G</option>
              <option value="altitude">Altitud GPS</option>
              <option value="compass">Brújula / Rumbo GPS</option>
              <option value="max_stats">Récords de Sesión (Max Stats)</option>
              <option value="gps_coords">Coordenadas GPS (WGS84)</option>
            </select>
          </div>

          {/* Lista de widgets */}
          <div className="space-y-1.5 max-h-[580px] overflow-y-auto">
            {template.widgets.map((w) => {
              const isSelected = selectedWidgetId === w.id;
              return (
                <div
                  key={w.id}
                  onClick={() => setSelectedWidgetId(w.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-[#1A222B] text-[#00E676] border-[#00E676]/50 shadow-sm'
                      : 'bg-[#090C0E]/50 text-[#8B9CB0] hover:text-[#F0F4F8] border-[#2C3947]/70'
                  }`}
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

          {/* Plantillas integradas rápidas */}
          <div className="pt-3 border-t border-[#2C3947] space-y-2">
            <span className="text-[11px] font-mono text-[#8B9CB0] uppercase">Plantillas Integradas:</span>
            <div className="flex flex-col gap-1.5">
              {BUILTIN_TEMPLATES.map((bt) => (
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
                  className="px-2.5 py-1.5 rounded text-left text-xs font-mono bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors flex items-center justify-between gap-1.5 group cursor-pointer"
                >
                  <span className="truncate group-hover:text-[#F0F4F8]">{bt.name}</span>
                  <Sparkles className="w-3 h-3 text-[#FFB300] shrink-0" />
                </button>
              ))}
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

            {selectedWidget && (
              <button
                onClick={removeSelectedWidget}
                className="p-1 rounded text-[#FF1744] hover:bg-[#FF1744]/10 transition-colors"
                title="Eliminar widget"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {selectedWidget ? (
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
