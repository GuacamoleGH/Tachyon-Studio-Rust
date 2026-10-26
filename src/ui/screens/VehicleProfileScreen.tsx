import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Gauge,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Save,
  Download,
  Upload,
  Sparkles,
  Zap,
  Plus,
  Trash2,
  Bookmark,
  X,
} from 'lucide-react';
import {
  VehicleProfile,
  PRESET_GASOLINA_ESTANDAR,
  VEHICLE_PRESETS,
  validateVehicleProfile,
  saveProfileToStorage,
  loadProfileFromStorage,
  deriveProfileFromAppConfig,
  loadCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from '../../core/profile/vehicleProfile';
import { TachometerCircularWidget } from '../../engine/widgets/TachometerWidget';
import { ShiftLightsWidget } from '../../engine/widgets/ShiftLightsWidget';
import { sanitizeFilename } from '../../core/utils/fileUtils';
import { TelemetrySnapshot } from '../../core/telemetry/timeEngine';
import { STANDARD_SIGNALS, StandardSignalKey } from '../../core/model/telemetry';
import { SessionBundle } from '../../core/model/session';

interface VehicleProfileScreenProps {
  session?: SessionBundle | null;
  profile?: VehicleProfile;
  onProfileUpdated?: (profile: VehicleProfile) => void;
}

export const VehicleProfileScreen: React.FC<VehicleProfileScreenProps> = ({
  session,
  profile: propProfile,
  onProfileUpdated,
}) => {
  // Prioridad de perfil inicial:
  // 1. Perfil recibido por prop
  // 2. Perfil guardado previamente por el usuario en localStorage
  // 3. Perfil derivado de session.json (si existe)
  // 4. Preset estándar por defecto (Gasolina)
  const initialProfile =
    propProfile ||
    loadProfileFromStorage() ||
    (session?.vehicleConfigWithOrigin
      ? deriveProfileFromAppConfig(session.vehicleConfigWithOrigin.config, 'Perfil de la Sesión')
      : PRESET_GASOLINA_ESTANDAR);

  const [profile, setProfile] = useState<VehicleProfile>(initialProfile);
  const [testRpm, setTestRpm] = useState<number>(profile.rpm.idle);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Sincronizar si propProfile cambia desde fuera
  useEffect(() => {
    if (propProfile && propProfile.id !== profile.id) {
      setProfile(propProfile);
      setTestRpm(propProfile.rpm.idle);
    }
  }, [propProfile]);

  // Presets personalizados de usuario en localStorage
  const [customPresets, setCustomPresets] = useState<VehicleProfile[]>(() => loadCustomPresets());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Formulario de creación de nuevo preset
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetScaleMax, setNewPresetScaleMax] = useState<number>(8000);
  const [newPresetRedline, setNewPresetRedline] = useState<number>(6500);
  const [newPresetIdle, setNewPresetIdle] = useState<number>(750);
  const [newPresetStartRpm, setNewPresetStartRpm] = useState<number>(5200);
  const [newPresetAllOnRpm, setNewPresetAllOnRpm] = useState<number>(6000);
  const [newPresetFlashRpm, setNewPresetFlashRpm] = useState<number>(6300);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Instancias de widgets para la vista previa
  const tachWidget = useRef(new TachometerCircularWidget({ x: 40, y: 30, width: 280, height: 280 }));
  const shiftWidget = useRef(new ShiftLightsWidget({ x: 350, y: 70, width: 340, height: 50 }));

  const validation = validateVehicleProfile(profile);

  // Presupuesto de validación para el nuevo preset en el modal
  const candidatePreset: VehicleProfile = {
    schema_version: '1.0.0',
    id: 'candidate_check',
    name: newPresetName.trim() || 'Nuevo Preset',
    rpm: {
      ...profile.rpm,
      idle: newPresetIdle,
      scale_max: newPresetScaleMax,
      redline_start: newPresetRedline,
      limiter: Math.max(newPresetRedline, newPresetScaleMax - 500),
    },
    shift_lights: {
      ...profile.shift_lights,
      start_rpm: newPresetStartRpm,
      all_on_rpm: newPresetAllOnRpm,
      flash_rpm: newPresetFlashRpm,
    },
  };
  const modalValidation = validateVehicleProfile(candidatePreset);

  // Generar snapshot simulado para el canvas
  const getSimulatedSnapshot = useCallback(
    (rpm: number): TelemetrySnapshot => {
      const signals = {} as any;
      const allKeys = Object.keys(STANDARD_SIGNALS) as StandardSignalKey[];
      for (const k of allKeys) {
        signals[k] = {
          key: k,
          value: k === 'engine_rpm' ? rpm : 0,
          isAvailable: true,
          status: 'VALID',
          unit: '',
          category: 'OBD',
          label: '',
        };
      }

      return {
        timeSec: performance.now() / 1000,
        signals,
        activeEvents: [],
        speedKmh: 120,
        speedAvailable: true,
        rpm: rpm,
        rpmAvailable: true,
        throttlePct: Math.min(100, (rpm / profile.rpm.scale_max) * 100),
        throttleAvailable: true,
        lateralG: 0.1,
        lateralGAvailable: true,
        longitudinalG: 0.2,
        longitudinalGAvailable: true,
        derivedGpsLongG: null,
        derivedGpsLongGAvailable: false,
        latitude: null,
        longitude: null,
        gpsAvailable: false,
        bearingDeg: 0,
        bearingAvailable: false,
      };
    },
    [profile]
  );

  // Bucle de renderizado continuo de la vista previa del canvas (para parpadeos en tiempo real)
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const snapshot = getSimulatedSnapshot(testRpm);
      const renderContext = {
        ctx,
        snapshot,
        profile,
        timeSec: performance.now() / 1000,
      };

      tachWidget.current.render(renderContext);
      shiftWidget.current.render(renderContext);

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [testRpm, profile, getSimulatedSnapshot]);

  const handlePresetSelect = (preset: VehicleProfile) => {
    setProfile(preset);
    setTestRpm(preset.rpm.idle);
    saveProfileToStorage(preset);
    onProfileUpdated?.(preset);
    setSaveMessage(`Preset "${preset.name}" activado y guardado como predeterminado.`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleOpenAddModal = () => {
    setNewPresetName(`${profile.name} Personalizado`);
    setNewPresetScaleMax(profile.rpm.scale_max);
    setNewPresetRedline(profile.rpm.redline_start);
    setNewPresetIdle(profile.rpm.idle);
    setNewPresetStartRpm(profile.shift_lights.start_rpm);
    setNewPresetAllOnRpm(profile.shift_lights.all_on_rpm);
    setNewPresetFlashRpm(profile.shift_lights.flash_rpm);
    setIsAddModalOpen(true);
  };

  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    if (!modalValidation.isValid) return;

    const presetToSave: VehicleProfile = {
      schema_version: '1.0.0',
      id: 'custom_' + Date.now(),
      name: newPresetName.trim(),
      rpm: {
        ...profile.rpm,
        idle: newPresetIdle,
        scale_max: newPresetScaleMax,
        redline_start: newPresetRedline,
        limiter: Math.max(newPresetRedline, newPresetScaleMax - 500),
      },
      shift_lights: {
        ...profile.shift_lights,
        start_rpm: newPresetStartRpm,
        all_on_rpm: newPresetAllOnRpm,
        flash_rpm: newPresetFlashRpm,
      },
    };

    const updated = saveCustomPreset(presetToSave);
    setCustomPresets(updated);
    setProfile(presetToSave);
    setTestRpm(presetToSave.rpm.idle);
    saveProfileToStorage(presetToSave);
    onProfileUpdated?.(presetToSave);
    setIsAddModalOpen(false);
    setSaveMessage(`¡Preset "${presetToSave.name}" guardado y activado como predeterminado!`);
    setTimeout(() => setSaveMessage(null), 3500);
  };

  const handleDeleteCustomPreset = (id: string, name: string) => {
    if (window.confirm(`¿Deseas eliminar el preset "${name}"?`)) {
      const updated = deleteCustomPreset(id);
      setCustomPresets(updated);
      if (profile.id === id) {
        const fallback = PRESET_GASOLINA_ESTANDAR;
        setProfile(fallback);
        setTestRpm(fallback.rpm.idle);
        saveProfileToStorage(fallback);
        onProfileUpdated?.(fallback);
      }
      setSaveMessage(`Preset "${name}" eliminado.`);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleSaveToStorage = () => {
    saveProfileToStorage(profile);
    if (profile.id.startsWith('custom_')) {
      const updated = saveCustomPreset(profile);
      setCustomPresets(updated);
    }
    setSaveMessage('¡Perfil guardado con éxito como predeterminado!');
    setTimeout(() => setSaveMessage(null), 3000);
    onProfileUpdated?.(profile);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(profile, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehiculo_${sanitizeFilename(profile.name.toLowerCase())}.json`;
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
          if (parsed.rpm && parsed.shift_lights) {
            setProfile(parsed);
            setTestRpm(parsed.rpm.idle || 850);
            onProfileUpdated?.(parsed);
          } else {
            alert('El archivo no contiene un perfil de vehículo válido.');
          }
        } catch (err) {
          alert('Error al leer el archivo JSON.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="px-6 py-4 w-full space-y-6 animate-fadeIn">
      {/* 1. Cabecera */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A222B] border border-[#2C3947] flex items-center justify-center text-[#00E676]">
              <Gauge className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h1 className="text-xl font-bold text-[#F0F4F8]">
              Calibración del Tacómetro y Luces de Cambio
            </h1>
          </div>
          <p className="text-xs text-[#8B9CB0] mt-1">
            Personaliza el rango de revoluciones y las shift lights para que el overlay reproduzca
            exactamente el tablero de tu coche.
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2">
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportJson}
          />
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar JSON</span>
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar JSON</span>
          </button>

          <button
            onClick={handleSaveToStorage}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] transition-all cursor-pointer shadow-[0_0_12px_rgba(0,230,118,0.2)]"
          >
            <Save className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Guardar Perfil</span>
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="bg-[#00E676]/15 border border-[#00E676]/40 p-3 rounded-lg text-xs text-[#00E676] font-semibold animate-fadeIn">
          {saveMessage}
        </div>
      )}

      {/* 2. Selector de Presets */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00E676]" />
            <span className="text-xs font-mono text-[#8B9CB0] uppercase font-semibold">
              Presets de Vehículo / Tacómetro:
            </span>
          </div>

          {/* Botón para Añadir Preset */}
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00E676]/15 hover:bg-[#00E676]/25 text-[#00E676] border border-[#00E676]/40 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
            title="Guardar configuración actual o crear un nuevo preset de RPM"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Añadir Preset</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Presets integrados */}
          {VEHICLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer ${
                profile.id === preset.id
                  ? 'bg-[#00E676]/20 text-[#00E676] border-[#00E676]/60 shadow-[0_0_10px_rgba(0,230,118,0.2)]'
                  : 'bg-[#1A222B] text-[#8B9CB0] hover:text-[#F0F4F8] hover:bg-[#2C3947] border-[#2C3947]'
              }`}
            >
              <Sparkles className="w-3 h-3 inline mr-1 opacity-70" />
              {preset.name}
            </button>
          ))}

          {/* Presets personalizados del usuario */}
          {customPresets.map((preset) => (
            <div
              key={preset.id}
              className={`inline-flex items-center rounded-lg border text-xs font-mono font-medium transition-colors ${
                profile.id === preset.id
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/60 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                  : 'bg-[#1A222B] text-[#8B9CB0] hover:text-[#F0F4F8] border-[#2C3947]'
              }`}
            >
              <button
                onClick={() => handlePresetSelect(preset)}
                className="px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer"
              >
                <Bookmark className="w-3 h-3 text-[#00E5FF]" />
                <span>{preset.name}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCustomPreset(preset.id, preset.name);
                }}
                title={`Eliminar preset "${preset.name}"`}
                className="pr-2 pl-0.5 py-1.5 text-[#8B9CB0] hover:text-[#FF1744] transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {session?.vehicleConfigWithOrigin && (
            <button
              onClick={() =>
                handlePresetSelect(
                  deriveProfileFromAppConfig(session.vehicleConfigWithOrigin.config, 'App de Sesión')
                )
              }
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-[#1A222B] text-[#00E5FF] hover:bg-[#2C3947] border border-[#00E5FF]/40 transition-colors cursor-pointer"
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Restaurar de session.json
            </button>
          )}
        </div>
      </div>

      {/* 3. Panel de Simulación y Prueba en Vivo */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#00E676]" />
            <h2 className="text-base font-bold text-[#F0F4F8]">
              Vista Previa en Vivo y Simulador de RPM
            </h2>
          </div>
          <span className="text-xs font-mono text-[#00E676] font-bold">
            Simulación activa: {Math.round(testRpm)} RPM
          </span>
        </div>

        {/* Canvas de dibujo interactivo */}
        <div className="bg-[#090C0E] border border-[#2C3947] rounded-xl p-2 flex justify-center items-center overflow-x-auto">
          <canvas ref={canvasRef} width={800} height={340} className="w-full max-w-[800px] h-auto" />
        </div>

        {/* Control deslizante de RPM para pruebas */}
        <div className="space-y-1.5 bg-[#1A222B] p-4 rounded-xl border border-[#2C3947]">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#8B9CB0]">Acelerar motor de prueba:</span>
            <span className="text-lg font-black text-[#00E5FF]">{Math.round(testRpm)} RPM</span>
          </div>

          <input
            type="range"
            min={0}
            max={profile.rpm.scale_max + 1000}
            step={50}
            value={testRpm}
            onChange={(e) => setTestRpm(parseFloat(e.target.value))}
            className="w-full accent-[#00E676] cursor-pointer"
          />

          <div className="flex justify-between text-[10px] font-mono text-[#8B9CB0]">
            <span>0 RPM</span>
            <span>Ralentí: {profile.rpm.idle} RPM</span>
            <span className="text-[#FFB300]">Shift: {profile.shift_lights.flash_rpm} RPM</span>
            <span className="text-[#FF1744]">Redline: {profile.rpm.redline_start} RPM</span>
            <span>Escala: {profile.rpm.scale_max} RPM</span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setTestRpm(profile.rpm.idle)}
              className="px-2.5 py-1 rounded text-xs font-mono bg-[#090C0E] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors"
            >
              Ralentí ({profile.rpm.idle})
            </button>
            <button
              onClick={() => setTestRpm(profile.shift_lights.start_rpm)}
              className="px-2.5 py-1 rounded text-xs font-mono bg-[#090C0E] hover:bg-[#2C3947] text-[#00E676] border border-[#2C3947] transition-colors"
            >
              Inicio Luces ({profile.shift_lights.start_rpm})
            </button>
            <button
              onClick={() => setTestRpm(profile.shift_lights.flash_rpm)}
              className="px-2.5 py-1 rounded text-xs font-mono bg-[#090C0E] hover:bg-[#2C3947] text-[#FFB300] border border-[#2C3947] transition-colors"
            >
              Aviso Shift ({profile.shift_lights.flash_rpm})
            </button>
            <button
              onClick={() => setTestRpm(profile.rpm.redline_start)}
              className="px-2.5 py-1 rounded text-xs font-mono bg-[#090C0E] hover:bg-[#2C3947] text-[#FF1744] border border-[#2C3947] transition-colors"
            >
              Corte Redline ({profile.rpm.redline_start})
            </button>
          </div>
        </div>
      </div>

      {/* 4. Validación de coherencia física */}
      {!validation.isValid ? (
        <div className="bg-[#FF1744]/15 border border-[#FF1744]/40 p-4 rounded-xl text-xs text-[#FF1744] space-y-1 animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Incoherencias detectadas en la configuración:
          </div>
          <ul className="list-disc list-inside space-y-0.5 pt-1">
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-[#00E676]/10 border border-[#00E676]/30 p-3 rounded-xl text-xs text-[#00E676] flex items-center gap-2 animate-fadeIn font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Configuración coherente: idle &lt; start_rpm &le; all_on_rpm &le; flash_rpm &le; scale_max
          y redline_start &le; scale_max.
        </div>
      )}

      {/* 5. Parámetros Editables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parámetros del Tacómetro */}
        <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-[#F0F4F8] uppercase tracking-wider font-mono border-b border-[#2C3947] pb-2">
            1. Escala del Tacómetro (RPM)
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#8B9CB0] mb-1 font-mono">Nombre del Perfil:</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Escala Máxima (scale_max):</label>
                <input
                  type="number"
                  step={100}
                  value={profile.rpm.scale_max}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      rpm: { ...profile.rpm, scale_max: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#FF1744] mb-1 font-mono">Inicio Zona Roja (redline):</label>
                <input
                  type="number"
                  step={100}
                  value={profile.rpm.redline_start}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      rpm: { ...profile.rpm, redline_start: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#FF1744] font-mono focus:border-[#FF1744] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Ralentí (idle):</label>
                <input
                  type="number"
                  step={50}
                  value={profile.rpm.idle}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      rpm: { ...profile.rpm, idle: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Divisor Etiquetas:</label>
                <input
                  type="number"
                  step={100}
                  value={profile.rpm.label_divisor}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      rpm: { ...profile.rpm, label_divisor: parseInt(e.target.value) || 1000 },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Parámetros de las Luces de Cambio */}
        <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-[#F0F4F8] uppercase tracking-wider font-mono border-b border-[#2C3947] pb-2">
            2. Luces de Cambio (Shift Lights)
          </h3>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#00E676] mb-1 font-mono">Primera Luz (start_rpm):</label>
                <input
                  type="number"
                  step={100}
                  value={profile.shift_lights.start_rpm}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        start_rpm: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#00E676] font-mono focus:border-[#00E676] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#FFB300] mb-1 font-mono">Todas Fijas (all_on_rpm):</label>
                <input
                  type="number"
                  step={100}
                  value={profile.shift_lights.all_on_rpm}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        all_on_rpm: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#FFB300] font-mono focus:border-[#FFB300] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#FF1744] mb-1 font-mono">
                  Aviso Flash SHIFT! (flash_rpm):
                </label>
                <input
                  type="number"
                  step={100}
                  value={profile.shift_lights.flash_rpm}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        flash_rpm: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#FF1744] font-mono focus:border-[#FF1744] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Frecuencia Flash (Hz):</label>
                <input
                  type="number"
                  step={1}
                  min={2}
                  max={20}
                  value={profile.shift_lights.flash_hz}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        flash_hz: parseInt(e.target.value) || 8,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Nº de LEDs:</label>
                <input
                  type="number"
                  min={4}
                  max={24}
                  value={profile.shift_lights.led_count}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        led_count: parseInt(e.target.value) || 10,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Patrón de Encendido:</label>
                <select
                  value={profile.shift_lights.pattern}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        pattern: e.target.value as any,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                >
                  <option value="left_to_right">De Izquierda a Derecha</option>
                  <option value="center_out">Del Centro hacia Afuera (GT3 / F1)</option>
                  <option value="right_to_left">De Derecha a Izquierda</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Crear / Añadir Nuevo Preset */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#13181E] border border-[#2C3947] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-[#2C3947] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00E676]/15 border border-[#00E676]/30 flex items-center justify-center text-[#00E676]">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F0F4F8]">Añadir Nuevo Preset de RPM</h3>
                  <p className="text-xs text-[#8B9CB0]">
                    Guarda la calibración para seleccionarla rápidamente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#8B9CB0] hover:text-[#F0F4F8] p-1.5 rounded-lg hover:bg-[#1A222B] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePreset} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#8B9CB0] mb-1">
                  Nombre del Preset / Vehículo:
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Mazda3 Turbo, Honda S2000, Kart 125cc..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded-lg px-3 py-2 text-sm text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[#8B9CB0] mb-1">
                    Escala Máx (scale_max):
                  </label>
                  <input
                    type="number"
                    step={100}
                    value={newPresetScaleMax}
                    onChange={(e) => setNewPresetScaleMax(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded-lg px-3 py-2 text-xs text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#FF1744] mb-1">
                    Línea Roja (redline_start):
                  </label>
                  <input
                    type="number"
                    step={100}
                    value={newPresetRedline}
                    onChange={(e) => setNewPresetRedline(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded-lg px-3 py-2 text-xs text-[#FF1744] font-mono focus:border-[#FF1744] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[#8B9CB0] mb-1">
                    Ralentí (idle):
                  </label>
                  <input
                    type="number"
                    step={50}
                    value={newPresetIdle}
                    onChange={(e) => setNewPresetIdle(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded-lg px-3 py-2 text-xs text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#00E676] mb-1">
                    Inicio Luces (start_rpm):
                  </label>
                  <input
                    type="number"
                    step={100}
                    value={newPresetStartRpm}
                    onChange={(e) => setNewPresetStartRpm(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded-lg px-3 py-2 text-xs text-[#00E676] font-mono focus:border-[#00E676] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[#FFB300] mb-1">
                    Todas Fijas (all_on_rpm):
                  </label>
                  <input
                    type="number"
                    step={100}
                    value={newPresetAllOnRpm}
                    onChange={(e) => setNewPresetAllOnRpm(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded-lg px-3 py-2 text-xs text-[#FFB300] font-mono focus:border-[#FFB300] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#FF1744] mb-1">
                    Flash Shift! (flash_rpm):
                  </label>
                  <input
                    type="number"
                    step={100}
                    value={newPresetFlashRpm}
                    onChange={(e) => setNewPresetFlashRpm(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded-lg px-3 py-2 text-xs text-[#FF1744] font-mono focus:border-[#FF1744] outline-none"
                  />
                </div>
              </div>

              {/* Advertencias de validación en tiempo real */}
              {!modalValidation.isValid && (
                <div className="bg-[#FF1744]/15 border border-[#FF1744]/40 p-3 rounded-lg text-xs text-[#FF1744] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Valores incoherentes:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {modalValidation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2C3947]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!modalValidation.isValid || !newPresetName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#00E676] hover:bg-[#00c864] disabled:opacity-50 disabled:cursor-not-allowed text-[#090C0E] transition-all cursor-pointer shadow-[0_0_12px_rgba(0,230,118,0.2)]"
                >
                  <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Guardar Preset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
