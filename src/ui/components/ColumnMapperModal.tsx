import React, { useState } from 'react';
import { X, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { STANDARD_SIGNALS, StandardSignalKey } from '../../core/model/telemetry';

interface ColumnMapperModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableHeaders: string[];
  currentMapping: Partial<Record<StandardSignalKey, string>>;
  onSaveMapping: (newMapping: Partial<Record<StandardSignalKey, string>>) => void;
}

export const ColumnMapperModal: React.FC<ColumnMapperModalProps> = ({
  isOpen,
  onClose,
  availableHeaders,
  currentMapping,
  onSaveMapping,
}) => {
  const [mapping, setMapping] = useState<Partial<Record<StandardSignalKey, string>>>({
    ...currentMapping,
  });

  if (!isOpen) return null;

  const handleSelect = (sigKey: StandardSignalKey, headerName: string) => {
    setMapping((prev) => ({
      ...prev,
      [sigKey]: headerName === '__none__' ? undefined : headerName,
    }));
  };

  const handleSave = () => {
    onSaveMapping(mapping);
    onClose();
  };

  const signalKeys = Object.keys(STANDARD_SIGNALS) as StandardSignalKey[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-[#2C3947] flex items-center justify-between bg-[#1A222B]">
          <div>
            <h2 className="text-lg font-bold text-[#F0F4F8] flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-[#00E5FF]" />
              Mapeo de Columnas de Telemetría
            </h2>
            <p className="text-xs text-[#8B9CB0] mt-0.5">
              Asigna las columnas encontradas en el archivo CSV a las señales internas de Tachyon Studio.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de mapeo */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="p-3 bg-[#1A222B] border border-[#2C3947] rounded-lg text-xs text-[#8B9CB0] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#FFB300] shrink-0 mt-0.5" />
            <div>
              <span className="text-[#F0F4F8] font-medium">Detección automática activa:</span> Las
              cabeceras reconocidas automáticamente ya están asociadas. Si el CSV tiene columnas
              con nombres distintos o personalizados, cámbialas aquí.
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#2C3947] text-[#8B9CB0] uppercase font-mono tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Señal Interna</th>
                <th className="py-2.5 px-3">Unidad</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Columna en CSV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C3947]/60">
              {signalKeys.map((sigKey) => {
                const def = STANDARD_SIGNALS[sigKey];
                const selectedHeader = mapping[sigKey] || '__none__';

                return (
                  <tr key={sigKey} className="hover:bg-[#1A222B]/50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[#F0F4F8]">
                      {def.label}
                      <span className="block font-mono text-[10px] text-[#8B9CB0]">{sigKey}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#00E5FF] font-mono">{def.unit}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          def.category === 'GPS'
                            ? 'bg-[#00E5FF]/10 text-[#00E5FF]'
                            : def.category === 'OBD'
                            ? 'bg-[#00E676]/10 text-[#00E676]'
                            : def.category === 'IMU'
                            ? 'bg-[#FFB300]/10 text-[#FFB300]'
                            : 'bg-[#2C3947] text-[#8B9CB0]'
                        }`}
                      >
                        {def.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={selectedHeader}
                        onChange={(e) => handleSelect(sigKey, e.target.value)}
                        className={`w-full bg-[#090C0E] border px-2.5 py-1.5 rounded text-xs font-mono focus:outline-none focus:border-[#00E676] transition-colors ${
                          selectedHeader === '__none__'
                            ? 'border-[#2C3947] text-[#8B9CB0]'
                            : 'border-[#00E676]/40 text-[#00E676]'
                        }`}
                      >
                        <option value="__none__">-- Sin asignar (N/D) --</option>
                        {availableHeaders.map((hdr) => (
                          <option key={hdr} value={hdr}>
                            {hdr}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#2C3947] bg-[#1A222B] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8B9CB0] hover:text-[#F0F4F8] hover:bg-[#2C3947] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-[#00E676] text-[#090C0E] hover:bg-[#00c864] transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            Guardar y Re-parsear
          </button>
        </div>
      </div>
    </div>
  );
};
