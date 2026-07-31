import React, { useState } from 'react';
import { ZoneData, RiskLevel, FilterState } from '../types';
import { RiskBadge } from './RiskBadge';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  MapPin,
  TrendingUp,
  Droplets,
  Trees,
  Thermometer,
  Eye,
  CheckCircle,
} from 'lucide-react';

interface CityRiskOverviewProps {
  zones: ZoneData[];
  onSelectZone: (zone: ZoneData) => void;
}

export const CityRiskOverview: React.FC<CityRiskOverviewProps> = ({
  zones,
  onSelectZone,
}) => {
  const [filter, setFilter] = useState<FilterState>({
    riskLevel: 'all',
    searchQuery: '',
    sortBy: 'riskScore',
    sortOrder: 'desc',
  });

  const [downloadedCSV, setDownloadedCSV] = useState(false);

  // Filter logic
  const filteredZones = zones
    .filter((zone) => {
      const matchesRisk =
        filter.riskLevel === 'all' || zone.riskLevel === filter.riskLevel;
      const matchesSearch =
        zone.name.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        zone.district.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        zone.tehsil.toLowerCase().includes(filter.searchQuery.toLowerCase());
      return matchesRisk && matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (filter.sortBy === 'riskScore') {
        comparison = a.riskScore - b.riskScore;
      } else if (filter.sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (filter.sortBy === 'cases') {
        const casesA = a.pastCases[a.pastCases.length - 1]?.count || 0;
        const casesB = b.pastCases[b.pastCases.length - 1]?.count || 0;
        comparison = casesA - casesB;
      } else if (filter.sortBy === 'humidity') {
        comparison = a.humidity - b.humidity;
      }

      return filter.sortOrder === 'desc' ? -comparison : comparison;
    });

  const handleExportCSV = () => {
    const headers = [
      'Zone ID',
      'Zone Name',
      'District',
      'Tehsil',
      'Area Type',
      'Risk Level',
      'Risk Score',
      'Temp (C)',
      'Humidity (%)',
      'Rainfall 48h (mm)',
      'NDVI Index',
      'Recent Cases (W28)',
      'Last Updated',
    ];

    const rows = filteredZones.map((z) => [
      z.id,
      `"${z.name}"`,
      `"${z.district}"`,
      `"${z.tehsil}"`,
      z.areaType,
      z.riskLevel.toUpperCase(),
      z.riskScore,
      z.temperature,
      z.humidity,
      z.rainfallRecent,
      z.vegetationIndex,
      z.pastCases[z.pastCases.length - 1]?.count || 0,
      `"${z.lastUpdated}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Islamabad_Dengue_Risk_Overview_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadedCSV(true);
    setTimeout(() => setDownloadedCSV(false), 2500);
  };

  return (
    <div className="space-y-4">
      
      {/* Search & Filter Header Bar */}
      <div className="bg-[#1F3D2E] p-4 rounded-xs border-2 border-[#14291F] shadow-md text-[#EDE6D6] flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#EDE6D6]/50 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search zone, district, or tehsil (e.g. Bharakahu, Urban Core)..."
            value={filter.searchQuery}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, searchQuery: e.target.value }))
            }
            className="w-full bg-[#14291F] text-[#EDE6D6] placeholder-[#EDE6D6]/50 text-xs pl-9 pr-3 py-2 rounded-xs border border-[#2D5843] focus:outline-none focus:border-[#D9A441]"
          />
        </div>

        {/* Filters and Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Risk Level Filter Pill */}
          <div className="flex items-center bg-[#14291F] rounded-xs border border-[#2D5843] p-1 text-xs">
            <span className="text-[10px] font-mono-data text-[#EDE6D6]/60 px-2 uppercase">
              Filter:
            </span>
            {(['all', 'high', 'medium', 'low'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() =>
                  setFilter((prev) => ({ ...prev, riskLevel: lvl }))
                }
                className={`px-2.5 py-1 font-heading font-bold rounded-xs text-xs uppercase transition-colors ${
                  filter.riskLevel === lvl
                    ? 'bg-[#D9A441] text-[#23241F]'
                    : 'text-[#EDE6D6]/70 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center bg-[#14291F] rounded-xs border border-[#2D5843] px-2 py-1 text-xs font-mono-data">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#D9A441] mr-1" />
            <select
              value={filter.sortBy}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  sortBy: e.target.value as FilterState['sortBy'],
                }))
              }
              className="bg-transparent text-[#EDE6D6] focus:outline-none cursor-pointer pr-1"
            >
              <option value="riskScore" className="bg-[#1F3D2E]">Sort by Risk Score</option>
              <option value="cases" className="bg-[#1F3D2E]">Sort by Cases</option>
              <option value="humidity" className="bg-[#1F3D2E]">Sort by Humidity</option>
              <option value="name" className="bg-[#1F3D2E]">Sort by Name</option>
            </select>
            <button
              onClick={() =>
                setFilter((prev) => ({
                  ...prev,
                  sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
                }))
              }
              className="ml-1 text-[10px] font-bold text-[#D9A441] hover:underline uppercase"
            >
              {filter.sortOrder.toUpperCase()}
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-[#4C8C6B] hover:bg-[#386B51] text-white px-3 py-2 rounded-xs font-heading font-bold text-xs uppercase tracking-wider transition-colors"
            title="Download CSV report for field analysis"
          >
            {downloadedCSV ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Exported!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </>
            )}
          </button>

        </div>

      </div>

      {/* Zone Ranking Table Container */}
      <div className="bg-[#F7F4EC] border-2 border-[#1F3D2E] rounded-xs shadow-md overflow-hidden">
        
        <div className="bg-[#1F3D2E] text-[#EDE6D6] px-4 py-3 border-b border-[#14291F] flex items-center justify-between">
          <h2 className="font-heading font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
            <span>Ranked Vector Activity Matrix</span>
            <span className="font-mono-data text-xs text-[#D9A441] font-normal">
              ({filteredZones.length} zones listed)
            </span>
          </h2>
          <span className="text-xs font-mono-data text-[#EDE6D6]/60 hidden sm:inline">
            Sorted by highest mosquito activity index
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#23241F] text-[#EDE6D6] font-heading font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3 w-12 text-center">Rank</th>
                <th className="p-3">Zone / Neighborhood</th>
                <th className="p-3">Risk Level & Score</th>
                <th className="p-3">Primary Factor</th>
                <th className="p-3 font-mono-data text-right">Temp</th>
                <th className="p-3 font-mono-data text-right">Humidity</th>
                <th className="p-3 font-mono-data text-right">Canopy (NDVI)</th>
                <th className="p-3 font-mono-data text-right">W28 Cases</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD3C1]">
              {filteredZones.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#5C5E54] font-mono-data">
                    No zones match the current search or filter query.
                  </td>
                </tr>
              ) : (
                filteredZones.map((zone, index) => {
                  const recentCases =
                    zone.pastCases[zone.pastCases.length - 1]?.count || 0;
                  const topFactor = zone.contributingFactors[0]?.factor || 'N/A';

                  return (
                    <tr
                      key={zone.id}
                      onClick={() => onSelectZone(zone)}
                      className="hover:bg-[#EDE6D6] cursor-pointer transition-colors group"
                    >
                      {/* Rank Index */}
                      <td className="p-3 text-center font-mono-data font-bold text-[#5C5E54]">
                        #{index + 1}
                      </td>

                      {/* Zone Name */}
                      <td className="p-3">
                        <div className="font-heading font-extrabold text-sm text-[#23241F] group-hover:text-[#1F3D2E] uppercase">
                          {zone.name}
                        </div>
                        <div className="text-[10px] text-[#5C5E54] font-mono-data">
                          {zone.district} · {zone.tehsil} · {zone.areaType}
                        </div>
                      </td>

                      {/* Risk Badge */}
                      <td className="p-3">
                        <RiskBadge level={zone.riskLevel} score={zone.riskScore} size="sm" />
                      </td>

                      {/* Primary Driver */}
                      <td className="p-3 max-w-xs">
                        <span className="text-[11px] font-sans text-[#23241F] font-medium block truncate">
                          {topFactor}
                        </span>
                      </td>

                      {/* Temp */}
                      <td className="p-3 font-mono-data text-right text-[#23241F]">
                        {zone.temperature}°C
                      </td>

                      {/* Humidity */}
                      <td className="p-3 font-mono-data text-right font-bold text-[#23241F]">
                        {zone.humidity}%
                      </td>

                      {/* NDVI */}
                      <td className="p-3 font-mono-data text-right text-[#4C8C6B] font-bold">
                        {zone.vegetationIndex}
                      </td>

                      {/* Recent Cases */}
                      <td className="p-3 font-mono-data text-right font-bold text-[#B5432A]">
                        {recentCases}
                      </td>

                      {/* Action */}
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectZone(zone);
                          }}
                          className="px-2.5 py-1 bg-[#1F3D2E] text-[#EDE6D6] hover:bg-[#14291F] font-heading font-bold text-[10px] uppercase rounded-xs transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
