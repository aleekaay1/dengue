import React, { useState } from 'react';
import { ZoneData } from '../types';
import { RiskBadge } from './RiskBadge';
import {
  X,
  TrendingUp,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Thermometer,
  Droplets,
  Trees,
  CloudRain,
  MapPin,
  Calendar,
  Layers,
  Bug,
} from 'lucide-react';

interface ZoneDetailPanelProps {
  zone: ZoneData | null;
  onClose?: () => void;
  onSelectAnotherZone?: (zoneId: string) => void;
  allZones?: ZoneData[];
  weatherAsOf?: string | null;
}

export const ZoneDetailPanel: React.FC<ZoneDetailPanelProps> = ({
  zone,
  onClose,
  onSelectAnotherZone,
  allZones = [],
  weatherAsOf,
}) => {
  const [copied, setCopied] = useState(false);

  if (!zone) {
    return (
      <div className="bg-[#EDE6D6] border-2 border-[#1F3D2E] p-6 rounded-xs shadow-md text-center flex flex-col items-center justify-center min-h-[400px]">
        <Bug className="w-12 h-12 text-[#1F3D2E]/40 mb-3" />
        <h3 className="font-heading font-extrabold text-lg text-[#1F3D2E] uppercase">
          No Zone Selected
        </h3>
        <p className="text-xs text-[#5C5E54] max-w-xs mt-1">
          Select a zone marker on the map or from the zone ranking list.
        </p>
      </div>
    );
  }

  const handleCopyBriefing = () => {
    const text = `DENGUE VECTOR BRIEFING - ${zone.name.toUpperCase()} (${zone.lastUpdated})
Risk Level: ${zone.riskLevel.toUpperCase()} (Score: ${zone.riskScore}/100)
Weather: Temp ${zone.temperature}°C, Humidity ${zone.humidity}%, Rain ${zone.rainfallRecent}mm
Primary Drivers: ${zone.contributingFactors.map((f) => f.factor).join(', ')}
Key Advice: ${zone.precautions[0]}
Islamabad / ICT Health Vector Intelligence System`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Peak 7-day risk value
  const maxTrendScore = Math.max(...zone.trend, 100);

  return (
    <div className="bg-[#F7F4EC] border-2 border-[#1F3D2E] rounded-xs shadow-xl overflow-hidden flex flex-col h-full">
      
      {/* Top Header Card */}
      <div className="bg-[#1F3D2E] text-[#EDE6D6] p-4 border-b-2 border-[#14291F] relative">
        <div className="w-full h-1 absolute top-0 left-0 aedes-stripe-accent" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#D9A441] font-mono-data mb-0.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{zone.district}</span>
            </div>
            <h2 className="text-xl font-extrabold font-heading uppercase text-[#EDE6D6] tracking-tight">
              {zone.name}
            </h2>
            <div className="text-[11px] font-mono-data text-[#EDE6D6]/60 mt-0.5">
              Last Report: {zone.lastUpdated}
            </div>
            {weatherAsOf && (
              <div className="text-[10px] font-mono-data text-[#D9A441] mt-0.5">
                Weather observations as of {weatherAsOf}
              </div>
            )}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-[#EDE6D6]/70 hover:text-white bg-[#14291F] rounded-xs border border-[#2D5843]"
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Risk Score Highlight */}
        <div className="mt-3 flex items-center justify-between bg-[#14291F] p-3 rounded-xs border border-[#2D5843]">
          <div>
            <div className="text-[10px] uppercase font-mono-data text-[#EDE6D6]/60">
              Mosquito Biting Activity
            </div>
            <div className="font-mono-data text-2xl font-extrabold text-white">
              {zone.riskScore} <span className="text-xs text-[#EDE6D6]/50">/ 100</span>
            </div>
          </div>
          <RiskBadge level={zone.riskLevel} size="lg" />
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-4 overflow-y-auto space-y-4 text-xs font-sans">
        
        {/* Metric Quick Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono-data">
          <div className="bg-[#EDE6D6] p-2 rounded-xs border border-[#DDD3C1]">
            <div className="text-[10px] text-[#5C5E54] flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-[#D9A441]" /> Temp
            </div>
            <div className="text-sm font-bold text-[#23241F] mt-0.5">{zone.temperature}°C</div>
          </div>

          <div className="bg-[#EDE6D6] p-2 rounded-xs border border-[#DDD3C1]">
            <div className="text-[10px] text-[#5C5E54] flex items-center gap-1">
              <Droplets className="w-3 h-3 text-sky-600" /> Humidity
            </div>
            <div className="text-sm font-bold text-[#23241F] mt-0.5">{zone.humidity}%</div>
          </div>

          <div className="bg-[#EDE6D6] p-2 rounded-xs border border-[#DDD3C1]">
            <div className="text-[10px] text-[#5C5E54] flex items-center gap-1">
              <Trees className="w-3 h-3 text-[#4C8C6B]" /> Canopy
            </div>
            <div className="text-sm font-bold text-[#23241F] mt-0.5">{zone.vegetationIndex} NDVI</div>
          </div>

          <div className="bg-[#EDE6D6] p-2 rounded-xs border border-[#DDD3C1]">
            <div className="text-[10px] text-[#5C5E54] flex items-center gap-1">
              <CloudRain className="w-3 h-3 text-blue-600" /> 48h Rain
            </div>
            <div className="text-sm font-bold text-[#23241F] mt-0.5">{zone.rainfallRecent} mm</div>
          </div>
        </div>

        {/* SECTION: WHY THIS SCORE (Contributing Factors) */}
        <div className="bg-white border border-[#DDD3C1] p-3 rounded-xs shadow-xs">
          <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#1F3D2E] flex items-center gap-1.5 mb-2.5">
            <AlertCircle className="w-4 h-4 text-[#D9A441]" />
            <span>Why This Score (Contributing Factors)</span>
          </h3>

          <div className="space-y-2">
            {zone.contributingFactors.map((factor, idx) => (
              <div
                key={idx}
                className="p-2 rounded-xs bg-[#F7F4EC] border-l-3 border-[#1F3D2E] flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs text-[#23241F]">
                    {factor.factor}
                  </span>
                  <span
                    className={`font-mono-data text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase ${
                      factor.scoreContribution > 0
                        ? 'bg-[#B5432A]/10 text-[#B5432A]'
                        : 'bg-[#4C8C6B]/10 text-[#4C8C6B]'
                    }`}
                  >
                    {factor.scoreContribution > 0 ? `+${factor.scoreContribution} pts` : `${factor.scoreContribution} pts`}
                  </span>
                </div>
                <p className="text-[11px] text-[#5C5E54] leading-normal">{factor.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION: 7-DAY RISK TREND SPARKLINE */}
        <div className="bg-white border border-[#DDD3C1] p-3 rounded-xs shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#1F3D2E] flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#4C8C6B]" />
              <span>7-Day Risk Score Trend</span>
            </h3>
            <span className="font-mono-data text-[10px] text-[#5C5E54]">
              Day 1 → Today
            </span>
          </div>

          <div className="h-20 bg-[#F7F4EC] p-2 rounded-xs border border-[#DDD3C1] flex items-end justify-between gap-1.5">
            {zone.trend.map((val, i) => {
              const heightPct = Math.max(15, (val / maxTrendScore) * 100);
              const isToday = i === zone.trend.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="font-mono-data text-[9px] text-[#5C5E54]">{val}</span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-xs transition-all ${
                      isToday
                        ? 'bg-[#B5432A]'
                        : val > 70
                        ? 'bg-[#D9A441]'
                        : 'bg-[#4C8C6B]'
                    }`}
                    title={`Day ${i + 1}: Score ${val}`}
                  />
                  <span className="font-mono-data text-[9px] text-[#8E9183]">
                    {i === 6 ? 'Today' : `D${i + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION: RECENT CASE HISTORY */}
        <div className="bg-white border border-[#DDD3C1] p-3 rounded-xs shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#1F3D2E] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#B5432A]" />
              <span>Recent Dengue Cases (Past 5 Weeks)</span>
            </h3>
            <span className="font-mono-data text-[10px] font-bold text-[#B5432A]">
              Total: {zone.pastCases.reduce((acc, c) => acc + c.count, 0)} cases
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-center font-mono-data">
            {zone.pastCases.map((c, i) => (
              <div key={i} className="bg-[#EDE6D6] p-1.5 rounded-xs border border-[#DDD3C1]">
                <div className="text-[10px] text-[#5C5E54]">{c.week}</div>
                <div className="text-sm font-bold text-[#23241F] mt-0.5">{c.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION: WHAT TO DO (Precaution Advice) */}
        <div className="bg-[#1F3D2E] text-[#EDE6D6] p-3.5 rounded-xs shadow-xs relative overflow-hidden">
          <div className="w-full h-1 absolute top-0 left-0 aedes-stripe-accent" />

          <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#D9A441] flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Field & Public Action Guidance</span>
          </h3>

          <ul className="space-y-1.5 text-[11px] text-[#EDE6D6]/90 font-sans list-disc pl-4">
            {zone.precautions.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>

          {zone.fieldOfficerNote && (
            <div className="mt-3 pt-2 border-t border-[#2D5843] text-[10px] font-mono-data text-[#D9A441] flex items-center gap-1.5">
              <span className="font-bold uppercase">Officer Field Log:</span>
              <span>"{zone.fieldOfficerNote}"</span>
            </div>
          )}
        </div>

        <div className="pt-1">
          <button
            onClick={handleCopyBriefing}
            className="w-full bg-[#23241F] hover:bg-[#383A32] text-[#EDE6D6] py-2 px-3 rounded-xs font-heading font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border border-[#383A32]"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#4C8C6B]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#D9A441]" />
                <span>Copy briefing</span>
              </>
            )}
          </button>
        </div>

        {/* Compare / Swap Zone Dropdown */}
        {allZones.length > 0 && onSelectAnotherZone && (
          <div className="pt-2 border-t border-[#DDD3C1] flex items-center justify-between text-xs font-mono-data">
            <span className="text-[#5C5E54]">Switch Zone:</span>
            <select
              value={zone.id}
              onChange={(e) => onSelectAnotherZone(e.target.value)}
              className="bg-[#EDE6D6] text-[#23241F] border border-[#DDD3C1] px-2 py-1 rounded-xs font-sans text-xs focus:outline-none"
            >
              {allZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.riskLevel.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        )}

      </div>
    </div>
  );
};
