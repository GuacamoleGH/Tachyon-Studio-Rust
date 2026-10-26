import React, { useState, useRef, useEffect } from 'react';
import { SessionBundle } from './core/model/session';
import { importSessionZip, ZipInputSource } from './core/zip/zipImporter';
import { isTauriEnvironment, openSessionDialog } from './core/fs/fileSystemAdapter';
import { AppTab, Navbar } from './ui/components/Navbar';
import { ZipDropzone } from './ui/components/ZipDropzone';
import { SessionSummaryScreen } from './ui/screens/SessionSummaryScreen';
import { VehicleProfileScreen } from './ui/screens/VehicleProfileScreen';
import { VideoPlayerScreen } from './ui/screens/VideoPlayerScreen';
import { TemplateEditorScreen } from './ui/screens/TemplateEditorScreen';
import {
  VehicleProfile,
  deriveProfileFromAppConfig,
  loadProfileFromStorage,
  saveProfileToStorage,
  PRESET_GASOLINA_ESTANDAR,
} from './core/profile/vehicleProfile';
import {
  OverlayTemplate,
  loadTemplateFromStorage as loadStoredTemplate,
  saveTemplateToStorage as saveStoredTemplate,
  TEMPLATE_MYCHRON_5,
} from './core/templates/templateModel';

export const App: React.FC = () => {
  const [session, setSession] = useState<SessionBundle | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('summary');
  const [currentProfile, setCurrentProfile] = useState<VehicleProfile>(() => {
    return loadProfileFromStorage() || PRESET_GASOLINA_ESTANDAR;
  });
  const [currentTemplate, setCurrentTemplate] = useState<OverlayTemplate>(() => {
    return loadStoredTemplate() || TEMPLATE_MYCHRON_5;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // En entorno Tauri de escritorio, capturar eventos nativos de arrastrar y soltar
  // para obtener la ruta absoluta en disco y evitar que el navegador limite a Blobs en RAM
  useEffect(() => {
    if (!isTauriEnvironment()) return;

    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/webviewWindow')
      .then(({ getCurrentWebviewWindow }) => {
        return getCurrentWebviewWindow().onDragDropEvent((event) => {
          if (event.payload.type === 'drop') {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              const zipPath = paths.find((p) => p.toLowerCase().endsWith('.zip')) || paths[0];
              if (zipPath.toLowerCase().endsWith('.zip')) {
                handleProcessFile({ nativeZipPath: zipPath });
              }
            }
          }
        });
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.warn('No se pudo inicializar listener nativo de drag&drop:', err);
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const handleProcessFile = async (file: ZipInputSource) => {
    let source = file;
    if (isTauriEnvironment() && file instanceof File && (file as any).path) {
      source = { nativeZipPath: (file as any).path };
    }

    setIsLoading(true);
    setError(null);
    setProgressPercent(5);
    setProgressText('Iniciando lectura de la sesión...');

    try {
      const bundle = await importSessionZip(source, (step, pct) => {
        setProgressText(step);
        setProgressPercent(pct);
      });
      setSession(bundle);
      // Mantener el preset que el usuario haya seleccionado o guardado previamente.
      // Solo inicializar con la configuración de session.json si el usuario no tiene ningún perfil guardado.
      const savedProfile = loadProfileFromStorage();
      if (!savedProfile && bundle.vehicleConfigWithOrigin) {
        const derived = deriveProfileFromAppConfig(bundle.vehicleConfigWithOrigin.config);
        setCurrentProfile(derived);
        saveProfileToStorage(derived);
      }
      setActiveTab('summary');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error desconocido al abrir el archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenZipClick = async () => {
    if (isTauriEnvironment()) {
      try {
        const handle = await openSessionDialog();
        if (handle?.path) {
          await handleProcessFile({ nativeZipPath: handle.path });
        } else if (handle?.file) {
          await handleProcessFile(handle.file);
        }
      } catch (err) {
        console.warn('Fallo en diálogo nativo, recurriendo a input HTML:', err);
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleLoadSynthetic = async () => {
    setIsLoading(true);
    setError(null);
    setProgressText('Descargando sesión sintética de pruebas...');
    setProgressPercent(10);

    try {
      const resp = await fetch('/samples/sesion_sintetica_prueba.zip');
      if (!resp.ok) {
        throw new Error('No se pudo cargar la sesión de prueba desde /samples/sesion_sintetica_prueba.zip');
      }
      const buffer = await resp.arrayBuffer();
      await handleProcessFile(buffer);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error al cargar la muestra de prueba.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090C0E] text-[#F0F4F8] flex flex-col font-sans selection:bg-[#00E676] selection:text-[#090C0E]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleProcessFile(e.target.files[0]);
          }
        }}
      />

      <Navbar
        sessionTitle={session?.title}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenZipClick={handleOpenZipClick}
        onLoadSyntheticClick={handleLoadSynthetic}
        isLoading={isLoading}
        hasSession={session !== null}
      />

      <main className="flex-1 pb-16">
        {activeTab === 'profile' ? (
          <VehicleProfileScreen
            session={session}
            profile={currentProfile}
            onProfileUpdated={(updated) => {
              setCurrentProfile(updated);
              saveProfileToStorage(updated);
            }}
          />
        ) : activeTab === 'editor' ? (
          <TemplateEditorScreen
            session={session}
            profile={currentProfile}
            template={currentTemplate}
            onTemplateUpdated={(updated) => {
              setCurrentTemplate(updated);
              saveStoredTemplate(updated);
            }}
          />
        ) : activeTab === 'player' && session ? (
          <VideoPlayerScreen
            session={session}
            profile={currentProfile}
            template={currentTemplate}
          />
        ) : !session ? (
          <ZipDropzone
            onFileSelected={handleProcessFile}
            onOpenNativeDialog={handleOpenZipClick}
            onLoadSynthetic={handleLoadSynthetic}
            isLoading={isLoading}
            progressText={progressText}
            progressPercent={progressPercent}
            error={error}
          />
        ) : (
          <SessionSummaryScreen session={session} onUpdateSession={setSession} />
        )}
      </main>
    </div>
  );
};
