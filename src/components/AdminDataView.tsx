import React, { useState } from 'react';
import { ZoneData, CityConditions } from '../types';
import {
  Database,
  Save,
  RotateCcw,
  CheckCircle,
  FileJson,
  Server,
} from 'lucide-react';

interface AdminDataViewProps {
  zones: ZoneData[];
  cityConditions: CityConditions;
  onUpdateZone: (updatedZone: ZoneData) => void;
  onUpdateCityConditions: (conditions: CityConditions) => void;
  onResetData: () => void;
}

export const AdminDataView: React.FC<AdminDataViewProps> = ({
  zones,
  cityConditions,
  onUpdateZone,
  onResetData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'table' | 'json'>('table');
  const [editingZoneId, setEditingZoneId] = useState<string | null>(zones[0]?.id || null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedZone = zones.find((z) => z.id === editingZoneId) || zones[0];

  const handleZoneInputChange = (
    field: keyof ZoneData,
    value: string | number
  ) => {
    if (!selectedZone) return;

    let parsedValue: string | number = value;
    if (
      field === 'temperature' ||
      field === 'humidity' ||
      field === 'rainfallRecent' ||
      field === 'vegetationIndex' ||
      field === 'riskScore'
    ) {
      parsedValue = parseFloat(value as string) || 0;
    }

    const updatedZone: ZoneData = {
      ...selectedZone,
      [field]: parsedValue,
    };

    if (field === 'riskScore') {
      const score = parsedValue as number;
      updatedZone.riskLevel = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
    }

    onUpdateZone(updatedZone);
  };

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#1F3D2E] text-[#EDE6D6] p-4 rounded-xs border-2 border-[#14291F] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Server className="w-6 h-6 text-[#D9A441] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-heading font-extrabold text-base text-white uppercase">
              Surveillance data
            </h2>
            <p className="text-xs text-[#EDE6D6]/80 mt-0.5 max-w-2xl">
              Live pipeline via Open-Meteo weather, vegetation index, and dengue case history.
              Edits here preview locally; Refresh reloads from the API.
            </p>
          </div>
        </div>

        <button
          onClick={onResetData}
          className="flex items-center gap-1.5 bg-[#14291F] hover:bg-[#2A523E] text-[#EDE6D6] px-3 py-1.5 rounded-xs font-mono-data text-xs border border-[#2D5843] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh feeds</span>
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-[#DDD3C1] pb-2 font-heading font-bold text-xs uppercase">
        <button
          onClick={() => setActiveSubTab('table')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs transition-colors ${
            activeSubTab === 'table'
              ? 'bg-[#1F3D2E] text-white'
              : 'bg-[#EDE6D6] text-[#23241F] hover:bg-[#DDD3C1]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Zone metrics</span>
        </button>

        <button
          onClick={() => setActiveSubTab('json')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs transition-colors ${
            activeSubTab === 'json'
              ? 'bg-[#1F3D2E] text-white'
              : 'bg-[#EDE6D6] text-[#23241F] hover:bg-[#DDD3C1]'
          }`}
        >
          <FileJson className="w-3.5 h-3.5" />
          <span>JSON payload</span>
        </button>
      </div>

      {activeSubTab === 'table' && selectedZone && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="bg-[#F7F4EC] border-2 border-[#1F3D2E] rounded-xs p-3 space-y-2">
            <h3 className="font-heading font-extrabold text-xs uppercase text-[#1F3D2E] border-b border-[#DDD3C1] pb-2">
              Zones
            </h3>
            <div className="space-y-1 max-h-[460px] overflow-y-auto pr-1">
              {zones.map((z) => (
                <button
                  key={z.id}
                  onClick={() => setEditingZoneId(z.id)}
                  className={`w-full text-left p-2 rounded-xs font-sans text-xs transition-all flex items-center justify-between ${
                    editingZoneId === z.id
                      ? 'bg-[#1F3D2E] text-white font-bold shadow-xs'
                      : 'bg-white text-[#23241F] hover:bg-[#EDE6D6] border border-[#DDD3C1]'
                  }`}
                >
                  <span className="uppercase">{z.name}</span>
                  <span className="font-mono-data text-[10px] opacity-80">
                    {z.riskScore}/100
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-[#F7F4EC] border-2 border-[#1F3D2E] rounded-xs p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD3C1] pb-3">
              <div>
                <h3 className="font-heading font-extrabold text-base text-[#1F3D2E] uppercase">
                  {selectedZone.name}
                </h3>
                <p className="text-xs font-mono-data text-[#5C5E54]">
                  {selectedZone.id} · {selectedZone.district}
                </p>
              </div>

              <button
                onClick={handleSave}
                className="bg-[#4C8C6B] hover:bg-[#386B51] text-white px-3 py-1.5 rounded-xs font-heading font-bold text-xs uppercase flex items-center gap-1.5 transition-colors shadow-xs"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Applied</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Apply</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-xs font-mono-data">
              {(
                [
                  ['temperature', 'Temperature (°C)', '0.1'],
                  ['humidity', 'Humidity (%)', '1'],
                  ['vegetationIndex', 'NDVI (0–1)', '0.01'],
                  ['rainfallRecent', 'Rain 48h (mm)', '0.5'],
                  ['riskScore', 'Risk score (0–100)', '1'],
                ] as const
              ).map(([field, label, step]) => (
                <div
                  key={field}
                  className="bg-white p-3 rounded-xs border border-[#DDD3C1] space-y-1"
                >
                  <label className="text-[10px] uppercase font-sans font-bold text-[#5C5E54] block">
                    {label}
                  </label>
                  <input
                    type="number"
                    step={step}
                    value={selectedZone[field] as number}
                    onChange={(e) => handleZoneInputChange(field, e.target.value)}
                    className="w-full bg-[#EDE6D6] text-[#23241F] p-1.5 rounded-xs border border-[#DDD3C1] font-bold focus:outline-none focus:border-[#1F3D2E]"
                  />
                </div>
              ))}

              <div className="bg-white p-3 rounded-xs border border-[#DDD3C1] space-y-1 sm:col-span-2">
                <label className="text-[10px] uppercase font-sans font-bold text-[#5C5E54] block">
                  Field note
                </label>
                <input
                  type="text"
                  value={selectedZone.fieldOfficerNote || ''}
                  onChange={(e) =>
                    handleZoneInputChange('fieldOfficerNote', e.target.value)
                  }
                  className="w-full bg-[#EDE6D6] text-[#23241F] p-1.5 rounded-xs border border-[#DDD3C1] font-sans text-xs focus:outline-none"
                  placeholder="Field officer note"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'json' && (
        <div className="bg-[#1A1B17] border-2 border-[#383A32] rounded-xs p-4 text-[#EDE6D6] space-y-2 font-mono-data text-xs">
          <div className="flex items-center justify-between text-[#D9A441] border-b border-[#383A32] pb-2">
            <span className="font-bold">Dashboard payload</span>
            <span className="text-[10px] text-[#EDE6D6]/60">
              {zones.length} zones
            </span>
          </div>
          <pre className="max-h-[500px] overflow-auto p-3 bg-[#14291F] rounded-xs text-[11px] leading-relaxed text-[#8CB89B]">
            {JSON.stringify({ cityConditions, zones }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
