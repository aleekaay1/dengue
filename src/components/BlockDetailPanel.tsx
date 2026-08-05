import React from 'react';
import { RiskBadge } from './RiskBadge';
import type { GridCellDto } from './gridMapUtils';
import { calculateRisk } from '../../lib/riskModel';
import { DISPLAY_BLOCK_M } from '../lib/aggregateBlocks';
import { X, MapPin, Thermometer, Droplets, Trees, Waves } from 'lucide-react';

interface BlockDetailPanelProps {
  cell: GridCellDto | null;
  cellSizeM?: number;
  onClose: () => void;
}

export const BlockDetailPanel: React.FC<BlockDetailPanelProps> = ({
  cell,
  cellSizeM = DISPLAY_BLOCK_M,
  onClose,
}) => {
  if (!cell) return null;

  const risk = calculateRisk({
    temperature: cell.temperature || 29,
    humidity: cell.humidity || 60,
    vegetationIndex: cell.ndvi,
    rainfallRecent: cell.rainfall ?? 0,
    pastCases: [],
    depressionRiskScore: cell.depressionScore,
    settlementDensity: cell.settlementDensity,
  });

  return (
    <aside className="bg-[#EDE6D6] border-2 border-[#1F3D2E] rounded-xs shadow-xl overflow-hidden flex flex-col max-h-[min(80vh,720px)]">
      <div className="bg-[#1F3D2E] text-[#EDE6D6] px-3 py-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading font-extrabold text-xs uppercase tracking-wide">
            Block risk
          </p>
          <p className="font-mono-data text-[10px] text-[#EDE6D6]/70 mt-0.5 truncate">
            {cellSizeM}m · {cell.tehsil || 'ICT'} · not household
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-[#14291F] rounded-xs shrink-0"
          aria-label="Close block detail"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <RiskBadge level={cell.riskLevel} score={cell.riskScore} size="md" />
          <div className="text-right font-mono-data text-[10px] text-[#5C5E54]">
            <div className="flex items-center gap-1 justify-end">
              <MapPin className="w-3 h-3" />
              {cell.lat.toFixed(5)}, {cell.lng.toFixed(5)}
            </div>
            <a
              className="text-[#1F3D2E] underline underline-offset-2 mt-0.5 inline-block"
              href={`https://www.google.com/maps?q=${cell.lat},${cell.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open block center
            </a>
            <div className="text-[9px] mt-0.5 opacity-80">WGS84 tile center</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono-data">
          <div className="bg-white/50 border border-[#1F3D2E]/15 p-2">
            <div className="flex items-center gap-1 text-[#5C5E54] mb-0.5">
              <Thermometer className="w-3 h-3" /> Temp
            </div>
            <div className="font-bold text-[#1F3D2E]">
              {cell.temperature.toFixed(1)}°C
            </div>
          </div>
          <div className="bg-white/50 border border-[#1F3D2E]/15 p-2">
            <div className="flex items-center gap-1 text-[#5C5E54] mb-0.5">
              <Droplets className="w-3 h-3" /> Humidity
            </div>
            <div className="font-bold text-[#1F3D2E]">{cell.humidity}%</div>
          </div>
          <div className="bg-white/50 border border-[#1F3D2E]/15 p-2">
            <div className="flex items-center gap-1 text-[#5C5E54] mb-0.5">
              <Trees className="w-3 h-3" /> NDVI
            </div>
            <div className="font-bold text-[#1F3D2E]">{cell.ndvi.toFixed(2)}</div>
          </div>
          <div className="bg-white/50 border border-[#1F3D2E]/15 p-2">
            <div className="flex items-center gap-1 text-[#5C5E54] mb-0.5">
              <Waves className="w-3 h-3" /> Terrain
            </div>
            <div className="font-bold text-[#1F3D2E]">
              {cell.depressionScore}/100
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-heading font-bold text-xs uppercase text-[#1F3D2E] mb-1.5">
            Why this score
          </h4>
          <ul className="space-y-2">
            {risk.contributingFactors.map((f) => (
              <li
                key={f.factor}
                className="text-xs border-l-2 border-[#D9A441] pl-2"
              >
                <div className="font-heading font-bold text-[#1F3D2E]">
                  {f.factor}
                </div>
                <p className="text-[#5C5E54] leading-snug">{f.description}</p>
              </li>
            ))}
            {!risk.contributingFactors.length && (
              <li className="text-xs text-[#5C5E54]">
                Inputs below factor thresholds for this block.
              </li>
            )}
          </ul>
        </div>

        <div className="text-[10px] font-mono-data text-[#5C5E54] border-t border-[#1F3D2E]/15 pt-2 space-y-0.5">
          <div>Rain ~48h: {cell.rainfall} mm</div>
          <div>
            Settlement density: {Math.round(cell.settlementDensity * 100)}%
          </div>
          <div>People-at-risk index: {cell.peopleAtRisk}</div>
          {cell.lst != null && <div>LST (Landsat): {cell.lst.toFixed(1)}°C</div>}
        </div>
      </div>
    </aside>
  );
};
