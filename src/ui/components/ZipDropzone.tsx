import React, { useRef, useState } from 'react';
import { Upload, Zap, AlertCircle } from 'lucide-react';

interface ZipDropzoneProps {
  onFileSelected: (file: File) => void;
  onLoadSynthetic: () => void;
  isLoading: boolean;
  progressText: string;
  progressPercent: number;
  error?: string | null;
}

export const ZipDropzone: React.FC<ZipDropzoneProps> = ({
  onFileSelected,
  onLoadSynthetic,
  isLoading,
  progressText,
  progressPercent,
  error,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="max-w-2xl mx-auto mt-12 p-6 animate-fadeIn">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-[#00E676] bg-[#00E676]/5 scale-[1.01]'
            : 'border-[#2C3947] bg-[#13181E] hover:border-[#00E5FF]/60 hover:bg-[#1A222B]/70'
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
          className="w-24 h-24 rounded-2xl mb-5 shadow-[0_0_30px_rgba(0,230,118,0.25)] hover:scale-105 transition-transform object-contain"
        />

        <h3 className="text-xl font-bold text-[#F0F4F8] tracking-wide mb-2">
          Arrastra tu paquete ZIP de sesión aquí
        </h3>
        <p className="text-xs text-[#8B9CB0] max-w-md leading-relaxed mb-6">
          Exportado directamente desde la app móvil Tachyon (contiene{' '}
          <span className="text-[#00E5FF] font-mono">telemetria.csv</span>,{' '}
          <span className="text-[#00E676] font-mono">session.json</span>,{' '}
          <span className="text-[#FFB300] font-mono">ruta.gpx</span> y opcionalmente{' '}
          <span className="text-[#F0F4F8] font-mono">video.mp4</span>).
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span>Seleccionar archivo ZIP</span>
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-[#2C3947]/70 w-full flex flex-col items-center">
          <span className="text-xs text-[#8B9CB0] mb-3">¿No tienes una sesión a mano?</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLoadSynthetic();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#FFB300] border border-[#2C3947] transition-all cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            <span>Probar con sesión sintética (casos difíciles)</span>
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      {isLoading && (
        <div className="mt-6 bg-[#13181E] border border-[#2C3947] rounded-xl p-4 shadow-lg animate-fadeIn">
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
        <div className="mt-6 bg-[#FF1744]/10 border border-[#FF1744]/40 rounded-xl p-4 flex items-start gap-3 text-xs text-[#FF1744] animate-fadeIn">
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
