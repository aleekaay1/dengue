import React from 'react';
import { CityConditions, DataFreshnessState } from '../types';
import { Thermometer, Droplets, CloudRain, Trees, AlertTriangle } from 'lucide-react';

interface ConditionsStripProps {
  conditions: CityConditions;
  freshness?: DataFreshnessState | null;
}

export const ConditionsStrip: React.FC<ConditionsStripProps> = ({
  conditions,
  freshness,
}) => {
  const items = [
    {
      icon: Thermometer,
      label: 'Temperature',
      value: `${conditions.temperature.toFixed(1)}°C`,
    },
    {
      icon: Droplets,
      label: 'Humidity',
      value: `${conditions.humidity}%`,
    },
    {
      icon: CloudRain,
      label: 'Rain (48h)',
      value: `${conditions.rainfall.toFixed(1)} mm`,
    },
    {
      icon: Trees,
      label: 'Vegetation',
      value: conditions.averageNDVI.toFixed(2),
    },
  ];

  return (
    <div className="bg-white border-b border-[var(--line)] px-4 py-3">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="font-heading font-semibold text-[var(--ink)]">
            City snapshot
          </span>
          <span>·</span>
          <span className="font-mono-data">
            {conditions.date} {conditions.lastUpdatedTime}
          </span>
          {freshness?.weatherLagged && freshness.weatherAsOf && (
            <span className="text-[var(--accent)] font-mono-data">
              weather as of {freshness.weatherAsOf}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {items.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg px-2.5 py-1.5"
            >
              <Icon className="w-3.5 h-3.5 text-[var(--brand)]" />
              <div>
                <div className="text-[10px] text-[var(--muted)]">{label}</div>
                <div className="font-mono-data text-sm font-semibold text-[var(--ink)]">
                  {value}
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--risk-high)]" />
            <div>
              <div className="text-[10px] text-[var(--muted)]">High-risk zones</div>
              <div className="font-mono-data text-sm font-semibold">
                {conditions.activeHighRiskZones}/{conditions.totalZonesMonitored}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
