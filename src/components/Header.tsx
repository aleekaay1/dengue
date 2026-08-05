import React from 'react';
import { ActiveTab, CityConditions } from '../types';
import {
  Activity,
  MapPin,
  ListOrdered,
  BookOpen,
  Database,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  cityConditions: CityConditions;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  cityConditions,
  onRefresh,
  refreshing,
}) => {
  const tabs = [
    ['dashboard', 'Map', Activity],
    ['signatures', 'Hotspots', Sparkles],
    ['overview', 'Zones', ListOrdered],
    ['methodology', 'How it works', BookOpen],
    ['admin', 'Data', Database],
  ] as const;

  return (
    <header className="bg-white border-b border-[var(--line)] sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center font-heading font-extrabold text-sm shrink-0">
              DS
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold font-heading text-[var(--ink)] tracking-tight">
                Dengue Surveillance
              </h1>
              <p className="text-xs text-[var(--muted)] flex items-center gap-1.5 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {cityConditions.cityName} · mosquito activity risk
              </p>
            </div>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 bg-[var(--brand)] hover:bg-[#0c5a4d] disabled:opacity-60 text-white px-3.5 py-2 rounded-lg font-heading font-semibold text-sm transition-colors self-start"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              Update data
            </button>
          )}
        </div>

        <nav className="flex items-center overflow-x-auto no-scrollbar gap-1 pb-2">
          {tabs.map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-heading font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                  : 'text-[var(--muted)] hover:bg-[#f0f2f5] hover:text-[var(--ink)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
