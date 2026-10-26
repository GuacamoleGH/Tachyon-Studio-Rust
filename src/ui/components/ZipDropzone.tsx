import React, { useRef, useState } from 'react';
import { Upload, Zap, AlertCircle } from 'lucide-react';
import { isTauriEnvironment } from '../../core/fs/fileSystemAdapter';

interface ZipDropzoneProps {
  onFileSelected: (file: File) => void;
  onOpenNativeDialog?: () => void;
  onLoadSynthetic: () => void;
  isLoading: boolean;
  progressText: string;
  progressPercent: number;
  error?: string | null;
}

export const ZipDropzone: React.FC<ZipDropzoneProps> = ({
  onFileSelected,
  onOpenNativeDialog,
  onLoadSynthetic,
  isLoading,
  progressText,
  progressPercent,
  error,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (isLoading) return;
    if (onOpenNativeDialog) {
      onOpenNativeDialog();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isTauriEnvironment()) {
      // En Tauri el evento nativo onDragDropEvent captura la ruta absoluta en disco
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.zip')) {
        onFileSelected(file);
      } else {
        alert('Por favor selecciona un archivo comprimido .ZIP de sesión.');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-8 flex flex-col items-center justify-center min-h-[calc(100vh-140px)] animate-fadeIn">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`w-full border-2 border-dashed rounded-3xl p-12 md:p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all shadow-2xl ${
          isDragOver
            ? 'border-[#00E676] bg-[#00E676]/10 scale-[1.01]'
            : 'border-[#2C3947] bg-[#13181E] hover:border-[#00E5FF]/60 hover:bg-[#1A222B]/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isLoading}
        />

        <img
          src="/logo.png"
          alt="Tachyon Studio Logo"
          className="w-28 h-28 rounded-2xl mb-6 shadow-[0_0_35px_rgba(0,230,118,0.3)] hover:scale-105 transition-transform object-contain"
        />

        <h3 className="text-2xl md:text-3xl font-extrabold text-[#F0F4F8] tracking-wide mb-3">
          Arrastra tu paquete ZIP de sesión aquí
        </h3>
        <p className="text-xs md:text-sm text-[#8B9CB0] max-w-xl leading-relaxed mb-8">
          Exportado directamente desde la app móvil Tachyon (contiene{' '}
          <span className="text-[#00E5FF] font-mono font-medium">telemetria.csv</span>,{' '}
          <span className="text-[#00E676] font-mono font-medium">session.json</span>,{' '}
          <span className="text-[#FFB300] font-mono font-medium">ruta.gpx</span> y opcionalmente{' '}
          <span className="text-[#F0F4F8] font-mono font-medium">video.mp4</span>).
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2.5 px-7 py-3 rounded-xl text-sm font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] shadow-[0_0_20px_rgba(0,230,118,0.35)] hover:scale-105 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span>Seleccionar archivo ZIP</span>
          </button>
        </div>

        <div className="mt-10 pt-8 border-t border-[#2C3947]/70 w-full max-w-md flex flex-col items-center">
          <span className="text-xs md:text-sm text-[#8B9CB0] mb-3">¿No tienes una sesión a mano?</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLoadSynthetic();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#FFB300] border border-[#FFB300]/30 hover:border-[#FFB300]/70 transition-all cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            <span>Probar con sesión sintética (casos difíciles)</span>
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      {isLoading && (
        <div className="w-full mt-6 bg-[#13181E] border border-[#2C3947] rounded-xl p-4 shadow-lg animate-fadeIn">
          <div className="flex justify-between items-center text-xs font-mono mb-2">
            <span className="text-[#00E5FF] font-semibold">{progressText}</span>
            <span className="text-[#F0F4F8]">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full bg-[#090C0E] rounded-full overflow-hidden border border-[#2C3947]">
            <div
              className="h-full bg-gradient-to-r from-[#00E676] to-[#00E5FF] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Alerta de error */}
      {error && (
        <div className="w-full mt-6 bg-[#FF1744]/10 border border-[#FF1744]/40 rounded-xl p-4 flex items-start gap-3 text-xs text-[#FF1744] animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-1">Error al procesar la sesión</span>
            {error}
          </div>
        </div>
      )}
    </div>
  );
};
