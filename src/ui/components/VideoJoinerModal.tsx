import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Film,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  ArrowRight,
  Zap,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  VideoFileItem,
  openMultipleVideosDialog,
  saveVideoDialog,
  sortGoProFiles,
  concatenateVideos,
} from '../../core/fs/fileSystemAdapter';

interface VideoJoinerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoJoined?: (joinedPath: string) => void;
  hasActiveSession?: boolean;
}

export const VideoJoinerModal: React.FC<VideoJoinerModalProps> = ({
  isOpen,
  onClose,
  onVideoJoined,
  hasActiveSession = false,
}) => {
  const [videoFiles, setVideoFiles] = useState<VideoFileItem[]>([]);
  const [outputPath, setOutputPath] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ path: string; durationSec: number } | null>(null);

  // Calcular tamaño total
  const totalSizeBytes = useMemo(() => {
    return videoFiles.reduce((acc, f) => acc + (f.size || 0), 0);
  }, [videoFiles]);

  const formatSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Sugerir ruta de salida basada en el primer archivo
  useEffect(() => {
    if (videoFiles.length > 0 && !outputPath) {
      const first = videoFiles[0];
      const dir = first.path.substring(0, Math.max(first.path.lastIndexOf('/'), first.path.lastIndexOf('\\')));
      const baseName = first.name.replace(/\.[^/.]+$/, '');
      const suggested = dir
        ? `${dir}\\${baseName}_GoPro_Completo.mp4`
        : `${baseName}_GoPro_Completo.mp4`;
      setOutputPath(suggested);
    }
  }, [videoFiles, outputPath]);

  if (!isOpen) return null;

  const handleAddFiles = async () => {
    setErrorMessage(null);
    setSuccessInfo(null);
    try {
      const selected = await openMultipleVideosDialog();
      if (selected && selected.length > 0) {
        setVideoFiles((prev) => {
          const existingPaths = new Set(prev.map((f) => f.path));
          const newUnique = selected.filter((f) => !existingPaths.has(f.path));
          const combined = [...prev, ...newUnique];
          return sortGoProFiles(combined);
        });
      }
    } catch (e: any) {
      setErrorMessage(`Error al seleccionar archivos: ${e.message || e}`);
    }
  };

  const handleRemoveFile = (id: string) => {
    setVideoFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setVideoFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= videoFiles.length - 1) return;
    setVideoFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleSortAuto = () => {
    setVideoFiles((prev) => sortGoProFiles(prev));
  };

  const handleBrowseOutputPath = async () => {
    try {
      const suggested = outputPath || 'GoPro_Sesion_Completa.mp4';
      const picked = await saveVideoDialog(suggested);
      if (picked) {
        setOutputPath(picked);
      }
    } catch (e: any) {
      console.warn('Error al seleccionar destino:', e);
    }
  };

  const handleExecuteJoin = async (bindToPlayer: boolean) => {
    if (videoFiles.length < 2) {
      setErrorMessage('Selecciona al menos 2 vídeos para poder unirlos.');
      return;
    }
    if (!outputPath.trim()) {
      setErrorMessage('Por favor, indica una ruta de archivo de salida válida.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessInfo(null);
    setProcessStatus('Uniendo vídeos a velocidad de disco sin recodificación (-c copy)...');

    const startTime = performance.now();
    try {
      const inputPaths = videoFiles.map((f) => f.path);
      await concatenateVideos(inputPaths, outputPath);

      const elapsedSec = (performance.now() - startTime) / 1000;
      setSuccessInfo({ path: outputPath, durationSec: elapsedSec });
      setProcessStatus(null);

      if (bindToPlayer && onVideoJoined) {
        onVideoJoined(outputPath);
      }
    } catch (e: any) {
      setIsProcessing(false);
      setProcessStatus(null);
      setErrorMessage(`Error al unir vídeos: ${e.message || e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#13181E] border border-[#2C3947] rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-[#F0F4F8]">
        {/* Encabezado */}
        <div className="px-6 py-4 border-b border-[#2C3947] flex items-center justify-between bg-[#1A222B]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF]">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F0F4F8] flex items-center gap-2">
                Unir Capítulos de Vídeo GoPro
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 font-bold uppercase">
                  Lossless (Sin Pérdida)
                </span>
              </h2>
              <p className="text-xs text-[#8B9CB0]">
                Junta las grabaciones divididas en capítulos de ~12 min (HERO Session, HERO 5, 7, 8, etc.) en un solo archivo MP4 continuo.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-[#8B9CB0] hover:text-[#F0F4F8] hover:bg-[#2C3947] transition-colors disabled:opacity-30 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido / Lista de vídeos */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 font-mono text-xs">
          {/* Mensaje de error si ocurre */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-[#FF5252]/10 border border-[#FF5252]/40 text-[#FF5252] flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mensaje de éxito si finalizó */}
          {successInfo && (
            <div className="p-4 rounded-xl bg-[#00E676]/10 border border-[#00E676]/40 text-[#00E676] space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>¡Vídeos unidos con éxito en {successInfo.durationSec.toFixed(1)} segundos!</span>
              </div>
              <p className="text-xs text-[#F0F4F8] break-all font-normal">
                Archivo guardado en: <span className="underline">{successInfo.path}</span>
              </p>
              <div className="pt-2 flex items-center gap-3 font-semibold">
                {hasActiveSession && onVideoJoined && (
                  <button
                    onClick={() => {
                      onVideoJoined(successInfo.path);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00E676] text-[#090C0E] hover:bg-[#00c864] cursor-pointer"
                  >
                    <span>Abrir en el reproductor</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-[#1A222B] hover:bg-[#2C3947] text-[#F0F4F8] border border-[#2C3947] cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* Barra de acciones de lista */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[#8B9CB0] font-semibold">
              Capítulos a unir ({videoFiles.length}):
            </span>

            <div className="flex items-center gap-2">
              {videoFiles.length > 1 && (
                <button
                  onClick={handleSortAuto}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1A222B] hover:bg-[#2C3947] text-[#00E5FF] border border-[#2C3947] transition-all cursor-pointer"
                  title="Ordenar automáticamente según el orden oficial de grabación de GoPro"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Ordenar GoPro</span>
                </button>
              )}

              <button
                onClick={handleAddFiles}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#00E5FF] hover:bg-[#00cce6] text-[#090C0E] font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Añadir Vídeos GoPro</span>
              </button>
            </div>
          </div>

          {/* Lista de archivos */}
          {videoFiles.length === 0 ? (
            <div
              onClick={handleAddFiles}
              className="border-2 border-dashed border-[#2C3947] hover:border-[#00E5FF]/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-[#090C0E]/40 group"
            >
              <Film className="w-10 h-10 text-[#2C3947] group-hover:text-[#00E5FF] mx-auto mb-3 transition-colors" />
              <p className="text-sm font-bold text-[#F0F4F8]">
                Ningún vídeo seleccionado todavía
              </p>
              <p className="text-xs text-[#8B9CB0] mt-1 max-w-md mx-auto">
                Haz clic aquí o en <strong>"+ Añadir Vídeos GoPro"</strong> para seleccionar los archivos (ej. <code className="text-[#00E676]">GOPR0001.MP4</code>, <code className="text-[#00E676]">GP010001.MP4</code>...). Se ordenarán automáticamente en orden cronológico.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {videoFiles.map((file, idx) => (
                <div
                  key={file.id}
                  className="bg-[#1A222B]/70 border border-[#2C3947] rounded-xl px-3 py-2 flex items-center justify-between gap-3 group hover:border-[#2C3947]/90 transition-all"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-[#090C0E] text-[#00E676] font-bold flex items-center justify-center text-[10px] shrink-0 border border-[#2C3947]">
                      {idx + 1}
                    </span>

                    <div className="truncate flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F0F4F8] truncate">{file.name}</span>
                        {file.chapterInfo?.isGoPro && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 font-semibold shrink-0">
                            {file.chapterInfo.label}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#8B9CB0] block truncate">
                        {file.path}
                      </span>
                    </div>

                    <span className="text-[11px] text-[#8B9CB0] shrink-0">
                      {formatSize(file.size)}
                    </span>
                  </div>

                  {/* Acciones de reordenación */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0 || isProcessing}
                      className="p-1 rounded text-[#8B9CB0] hover:text-[#00E5FF] disabled:opacity-20 hover:bg-[#2C3947] cursor-pointer"
                      title="Mover arriba"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === videoFiles.length - 1 || isProcessing}
                      className="p-1 rounded text-[#8B9CB0] hover:text-[#00E5FF] disabled:opacity-20 hover:bg-[#2C3947] cursor-pointer"
                      title="Mover abajo"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      disabled={isProcessing}
                      className="p-1 rounded text-[#8B9CB0] hover:text-[#FF5252] hover:bg-[#2C3947] cursor-pointer ml-1"
                      title="Quitar vídeo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Información y ruta de salida */}
          {videoFiles.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-[#2C3947]">
              <div className="flex items-center justify-between text-[#8B9CB0]">
                <span>Tamaño combinado estimado:</span>
                <span className="font-bold text-[#F0F4F8]">{formatSize(totalSizeBytes)}</span>
              </div>

              <div>
                <label className="block text-[#8B9CB0] mb-1 font-semibold">
                  Guardar archivo unido en:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    disabled={isProcessing}
                    placeholder="C:\Ruta\GoPro_Completo.mp4"
                    className="flex-1 bg-[#090C0E] border border-[#2C3947] focus:border-[#00E676] rounded-lg px-3 py-1.5 text-[#F0F4F8] outline-none"
                  />
                  <button
                    onClick={handleBrowseOutputPath}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] cursor-pointer shrink-0"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Examinar...</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#1A222B]/60 border border-[#2C3947] flex items-start gap-2.5 text-[11px] text-[#8B9CB0]">
                <Zap className="w-4 h-4 text-[#FFB300] shrink-0 mt-0.5" />
                <p>
                  <strong>Unión ultra-rápida sin pérdida (Stream Copy):</strong> Las pistas originales de vídeo y audio se ensamblan a la velocidad máxima de tu disco sin recomprimir. No pierde ni un solo píxel ni desincroniza el audio.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Pie de acciones */}
        <div className="px-6 py-4 border-t border-[#2C3947] flex items-center justify-between bg-[#1A222B]/60 font-mono text-xs">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-[#8B9CB0] hover:text-[#F0F4F8] hover:bg-[#2C3947] transition-colors disabled:opacity-40 cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            {isProcessing ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A222B] text-[#00E5FF] border border-[#00E5FF]/40 font-bold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{processStatus || 'Procesando...'}</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleExecuteJoin(false)}
                  disabled={videoFiles.length < 2 || isProcessing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A222B] hover:bg-[#2C3947] text-[#00E5FF] border border-[#00E5FF]/40 font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Unir Vídeos en Disco</span>
                </button>

                {hasActiveSession && (
                  <button
                    onClick={() => handleExecuteJoin(true)}
                    disabled={videoFiles.length < 2 || isProcessing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] font-bold shadow-[0_0_12px_rgba(0,230,118,0.25)] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Unir y Vincular al Reproductor</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
