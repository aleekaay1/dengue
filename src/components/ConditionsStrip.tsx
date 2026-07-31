import React from 'react';
import { CityConditions, DataFreshnessState } from '../types';
import { Thermometer, Droplets, CloudRain, Trees, AlertTriangle, Clock } from 'lucide-react';

interface ConditionsStripProps {
  conditions: CityConditions;
  freshness?: DataFreshnessState | null;
}

export const ConditionsStrip: React.FC<ConditionsStripProps> = ({
  conditions,
  freshness,
}) => {
  return (
    <div className="bg-[#23241F] text-[#EDE6D6] border-b border-[#383A32] px-4 py-2.5 shadow-inner">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-heading font-bold text-xs uppercase tracking-wider text-[#D9A441]">
            <Clock className="w-3.5 h-3.5" />
            <span>Field conditions</span>
          </div>
          <span className="text-[#EDE6D6]/40">|</span>
          <span className="font-mono-data text-[#EDE6D6]/80 text-[11px]">
            {conditions.cityName}, {conditions.date} ({conditions.lastUpdatedTime})
          </span>
          {freshness?.weatherLagged && freshness.weatherAsOf && (
            <span className="inline-flex items-center gap-1 bg-[#D9A441]/20 text-[#D9A441] text-[10px] px-2 py-0.5 font-mono-data font-bold rounded-xs border border-[#D9A441]/40">
              WEATHER AS OF {freshness.weatherAsOf}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-2 bg-[#1A1B17] px-3 py-1 rounded-xs border border-[#3A3C34]">
            <Thermometer className="w-4 h-4 text-[#D9A441]" />
            <div>
              <div className="text-[10px] uppercase text-[#EDE6D6]/50 font-sans tracking-wide">
                Temperature
              </div>
              <div className="font-mono-data text-sm font-bold text-[#EDE6D6]">
                {conditions.temperature.toFixed(1)}°C
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#1A1B17] px-3 py-1 rounded-xs border border-[#3A3C34]">
            <Droplets className="w-4 h-4 text-sky-400" />
            <div>
              <div className="text-[10px] uppercase text-[#EDE6D6]/50 font-sans tracking-wide">
                Humidity
              </div>
              <div className="font-mono-data text-sm font-bold text-sky-300">
                {conditions.humidity}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#1A1B17] px-3 py-1 rounded-xs border border-[#3A3C34]">
            <CloudRain className="w-4 h-4 text-blue-400" />
            <div>
              <div className="text-[10px] uppercase text-[#EDE6D6]/50 font-sans tracking-wide">
                Rain (48h)
              </div>
              <div className="font-mono-data text-sm font-bold text-blue-200">
                {conditions.rainfall.toFixed(1)} mm
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#1A1B17] px-3 py-1 rounded-xs border border-[#3A3C34]">
            <Trees className="w-4 h-4 text-[#4C8C6B]" />
            <div>
              <div className="text-[10px] uppercase text-[#EDE6D6]/50 font-sans tracking-wide">
                NDVI
              </div>
              <div className="font-mono-data text-sm font-bold text-[#4C8C6B]">
                {conditions.averageNDVI.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 bg-[#B5432A]/20 border border-[#B5432A]/50 px-3 py-1 rounded-xs">
            <AlertTriangle className="w-4 h-4 text-[#B5432A] shrink-0" />
            <span className="font-heading font-bold text-xs text-white">
              {conditions.activeHighRiskZones} / {conditions.totalZonesMonitored} HIGH RISK
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
