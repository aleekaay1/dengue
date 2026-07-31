import React from 'react';
import { ActiveTab, CityConditions } from '../types';
import {
  Activity,
  MapPin,
  ListOrdered,
  BookOpen,
  Database,
  ShieldAlert,
  RefreshCw,
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
  return (
    <header className="bg-[#1F3D2E] text-[#EDE6D6] border-b-2 border-[#14291F] sticky top-0 z-30 shadow-md">
      <div className="h-1.5 w-full aedes-stripe-accent opacity-90" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#EDE6D6] text-[#1F3D2E] rounded-xs flex items-center justify-center border border-[#B5432A]/30">
              <ShieldAlert className="w-6 h-6 text-[#B5432A]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-[#EDE6D6] tracking-tight uppercase">
                Dengue Surveillance
              </h1>
              <p className="text-xs text-[#EDE6D6]/70 font-sans flex items-center gap-1.5 mt-0.5">
                <span>Islamabad Vector Intelligence</span>
                <span className="text-white/30">·</span>
                <span className="font-mono-data text-[#D9A441]">
                  Adult biting risk
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center bg-[#14291F] border border-[#2D5843] rounded-xs px-2.5 py-1.5 text-xs font-mono-data">
              <MapPin className="w-3.5 h-3.5 text-[#D9A441] mr-1.5 shrink-0" />
              <span className="text-[#EDE6D6] font-semibold">
                {cityConditions.cityName}
              </span>
              <span className="text-[#EDE6D6]/50 ml-1.5">
                {cityConditions.province}
              </span>
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 bg-[#D9A441] hover:bg-[#c49233] disabled:opacity-60 text-[#23241F] px-3 py-1.5 rounded-xs font-heading font-bold text-xs uppercase tracking-wide transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                />
                <span>Refresh</span>
              </button>
            )}
          </div>
        </div>

        <nav className="flex items-center overflow-x-auto no-scrollbar border-t border-[#2D5843] pt-1">
          {(
            [
              ['dashboard', 'Map', Activity],
              ['overview', 'Zone ranking', ListOrdered],
              ['methodology', 'Methodology', BookOpen],
              ['admin', 'Data', Database],
            ] as const
          ).map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-heading font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'border-[#D9A441] text-[#D9A441] bg-[#14291F]/60'
                  : 'border-transparent text-[#EDE6D6]/70 hover:text-[#EDE6D6] hover:bg-[#14291F]/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
