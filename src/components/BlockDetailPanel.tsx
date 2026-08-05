import React from 'react';
import { RiskBadge } from './RiskBadge';
import type { GridCellDto } from './gridMapUtils';
import { calculateRisk } from '../../lib/riskModel';
import { DISPLAY_BLOCK_M } from '../lib/aggregateBlocks';
import { X, MapPin, Thermometer, Droplets, Trees, Waves, CloudRain } from 'lucide-react';

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
    <aside className="bg-white border border-[var(--line)] rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[min(80vh,720px)]">
      <div className="px-3 py-2.5 flex items-start justify-between gap-2 border-b border-[var(--line)]">
        <div className="min-w-0">
          <p className="font-heading font-bold text-sm text-[var(--ink)]">
            Selected area
          </p>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">
            ~{cellSizeM}m square · not a household
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-[var(--bg)] rounded-md shrink-0 text-[var(--muted)]"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <RiskBadge level={cell.riskLevel} score={cell.riskScore} size="md" />
          <div className="text-right text-[10px] text-[var(--muted)] font-mono-data">
            <div className="flex items-center gap-1 justify-end">
              <MapPin className="w-3 h-3" />
              {cell.lat.toFixed(5)}, {cell.lng.toFixed(5)}
            </div>
            <a
              className="text-[var(--brand)] underline underline-offset-2 mt-0.5 inline-block"
              href={`https://www.google.com/maps?q=${cell.lat},${cell.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {(
            [
              [Thermometer, 'Temperature', `${cell.temperature.toFixed(1)}°C`],
              [Droplets, 'Humidity', `${cell.humidity}%`],
              [Trees, 'Vegetation', cell.ndvi.toFixed(2)],
              [CloudRain, 'Rain (48h)', `${cell.rainfall} mm`],
              [Waves, 'Low ground', `${cell.depressionScore}/100`],
              [
                MapPin,
                'Built-up area',
                `${Math.round(cell.settlementDensity * 100)}%`,
              ],
            ] as const
          ).map(([Icon, label, value]) => (
            <div
              key={label}
              className="bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2"
            >
              <div className="flex items-center gap-1 text-[var(--muted)] mb-0.5">
                <Icon className="w-3 h-3" /> {label}
              </div>
              <div className="font-semibold text-[var(--ink)] font-mono-data">
                {value}
              </div>
            </div>
          ))}
        </div>

        <div>
          <h4 className="font-heading font-semibold text-xs text-[var(--ink)] mb-1.5">
            Why this score
          </h4>
          <ul className="space-y-2">
            {risk.contributingFactors.map((f) => (
              <li
                key={f.factor}
                className="text-xs border-l-2 border-[var(--brand)] pl-2"
              >
                <div className="font-heading font-semibold text-[var(--ink)]">
                  {f.factor}
                </div>
                <p className="text-[var(--muted)] leading-snug">{f.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
};
