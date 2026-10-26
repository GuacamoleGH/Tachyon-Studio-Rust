import React from 'react';
import { Upload, Zap, Sliders, FileText, PlayCircle, LayoutTemplate } from 'lucide-react';

export type AppTab = 'summary' | 'profile' | 'player' | 'editor';

interface NavbarProps {
  sessionTitle?: string;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenZipClick: () => void;
  onLoadSyntheticClick: () => void;
  isLoading: boolean;
  hasSession: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  sessionTitle,
  activeTab,
  onTabChange,
  onOpenZipClick,
  onLoadSyntheticClick,
  isLoading,
  hasSession,
}) => {
  return (
    <header className="border-b border-[#2C3947] bg-[#13181E] px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Tachyon Studio"
            className="w-9 h-9 rounded-xl object-contain shadow-[0_0_12px_rgba(0,230,118,0.25)]"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-wider text-base text-[#F0F4F8] font-mono">
                TACHYON<span className="text-[#00E676]">.</span>STUDIO
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-[#1A222B] text-[#00E5FF] border border-[#2C3947]">
                v2.1 PC
              </span>
            </div>
            <p className="text-xs text-[#8B9CB0] truncate max-w-xs">
              {sessionTitle ? (
                <span className="text-[#F0F4F8] font-medium">{sessionTitle}</span>
              ) : (
                'Herramienta de PC para telemetría'
              )}
            </p>
          </div>
        </div>

        {/* Pestañas de Navegación principales */}
        <nav className="hidden md:flex items-center gap-1.5 bg-[#090C0E] p-1 rounded-xl border border-[#2C3947]">
          <button
            onClick={() => onTabChange('summary')}
            disabled={!hasSession}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'summary'
                ? 'bg-[#1A222B] text-[#00E676] shadow-sm'
                : 'text-[#8B9CB0] hover:text-[#F0F4F8]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Resumen</span>
          </button>

          <button
            onClick={() => onTabChange('player')}
            disabled={!hasSession}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'player'
                ? 'bg-[#1A222B] text-[#00E5FF] shadow-sm font-bold'
                : 'text-[#8B9CB0] hover:text-[#F0F4F8]'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Reproductor</span>
          </button>

          <button
            onClick={() => onTabChange('editor')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-[#1A222B] text-[#00E676] shadow-sm font-bold'
                : 'text-[#8B9CB0] hover:text-[#F0F4F8]'
            }`}
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-[#00E676]" />
            <span>Editor de Plantillas</span>
          </button>

          <button
            onClick={() => onTabChange('profile')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#1A222B] text-[#00E676] shadow-sm'
                : 'text-[#8B9CB0] hover:text-[#F0F4F8]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Perfil Vehículo</span>
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onLoadSyntheticClick}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-all cursor-pointer disabled:opacity-50"
          title="Carga la sesión sintética con casos difíciles (cortes GPS, OBD y offset negativo)"
        >
          <Zap className="w-3.5 h-3.5 text-[#FFB300]" />
          <span className="hidden sm:inline">Cargar muestra</span>
        </button>

        <button
          onClick={onOpenZipClick}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all cursor-pointer disabled:opacity-50"
        >
          <Upload className="w-4 h-4 stroke-[2.5]" />
          <span>Importar ZIP</span>
        </button>
      </div>
    </header>
  );
};
