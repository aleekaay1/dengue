import React, { useState, useMemo, useEffect } from 'react';
import { ZoneData, ActiveTab, MapOverlay } from './types';
import type { InitialDashboardData } from './types/ssr';
import { Header } from './components/Header';
import { ConditionsStrip } from './components/ConditionsStrip';
import { ZoneMapLazy } from './components/ZoneMapLazy';
import { ZoneDetailPanel } from './components/ZoneDetailPanel';
import { CityRiskOverview } from './components/CityRiskOverview';
import { MethodologyPage } from './components/MethodologyPage';
import { AdminDataView } from './components/AdminDataView';
import { CrawlerDataBlock } from './components/CrawlerDataBlock';
import { useDashboardData } from './hooks/useDashboardData';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface AppProps {
  initialData?: InitialDashboardData | null;
}

export default function App({ initialData = null }: AppProps) {
  const {
    zones: liveZones,
    cityConditions: liveCity,
    freshness,
    loading,
    error,
    builtAt,
    reload,
  } = useDashboardData(initialData);

  const [zones, setZones] = useState<ZoneData[]>(initialData?.zones ?? []);
  const [cityConditions, setCityConditions] = useState(
    initialData?.cityConditions ?? liveCity
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    initialData?.zones?.[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mapOverlay, setMapOverlay] = useState<MapOverlay>('risk');
  const [mapFullscreen, setMapFullscreen] = useState(false);

  useEffect(() => {
    if (liveZones.length) {
      setZones(liveZones);
      setSelectedZoneId((prev) => prev ?? liveZones[0]?.id ?? null);
    }
  }, [liveZones]);

  useEffect(() => {
    if (liveCity) setCityConditions(liveCity);
  }, [liveCity]);

  const selectedZone = useMemo(() => {
    return zones.find((z) => z.id === selectedZoneId) || zones[0] || null;
  }, [zones, selectedZoneId]);

  const displayConditions = useMemo(() => {
    if (!cityConditions) return null;
    const high = zones.filter((z) => z.riskLevel === 'high').length;
    return {
      ...cityConditions,
      activeHighRiskZones: high,
      totalZonesMonitored: zones.length || cityConditions.totalZonesMonitored,
    };
  }, [cityConditions, zones]);

  const handleSelectZone = (zone: ZoneData) => {
    setSelectedZoneId(zone.id);
  };

  const handleUpdateZone = (updatedZone: ZoneData) => {
    setZones((prev) =>
      prev.map((z) => (z.id === updatedZone.id ? updatedZone : z))
    );
  };

  const handleRefresh = () => {
    void reload({ live: true, refresh: true });
  };

  if (loading && !cityConditions) {
    return (
      <div className="min-h-screen bg-[#EDE6D6] text-[#23241F] flex flex-col items-center justify-center gap-4 font-sans">
        <Loader2 className="w-10 h-10 text-[#1F3D2E] animate-spin" />
        <div className="text-center">
          <h1 className="font-heading font-extrabold text-lg uppercase text-[#1F3D2E]">
            Loading surveillance feeds
          </h1>
          <p className="text-sm text-[#5C5E54] mt-1 max-w-sm">
            Fetching weather, vegetation, and case data for Islamabad zones…
          </p>
        </div>
      </div>
    );
  }

  if (error && !cityConditions) {
    return (
      <div className="min-h-screen bg-[#EDE6D6] text-[#23241F] flex flex-col items-center justify-center gap-4 font-sans p-6">
        <AlertTriangle className="w-10 h-10 text-[#B5432A]" />
        <div className="text-center max-w-md">
          <h1 className="font-heading font-extrabold text-lg uppercase text-[#B5432A]">
            Data source unavailable
          </h1>
          <p className="text-sm text-[#5C5E54] mt-2 font-mono-data">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 inline-flex items-center gap-2 bg-[#1F3D2E] text-[#EDE6D6] px-4 py-2 text-sm font-heading font-bold uppercase"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!cityConditions || !displayConditions) {
    return null;
  }

  const showBanner =
    freshness?.weatherLagged ||
    (freshness && !freshness.dengueScrapeOk) ||
    freshness?.dengueStale ||
    Boolean(error);

  return (
    <div className="min-h-screen bg-[#EDE6D6] text-[#23241F] flex flex-col font-sans">
      <CrawlerDataBlock
        zones={zones}
        cityConditions={displayConditions}
        builtAt={builtAt}
      />

      {showBanner && (
        <div className="bg-[#3A2A12] text-[#F5E6C8] border-b border-[#D9A441]/40 px-4 py-2 text-[11px] font-mono-data">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            {freshness?.weatherLagged && freshness.weatherAsOf && (
              <span className="text-[#D9A441]">
                Weather as of {freshness.weatherAsOf}
              </span>
            )}
            {freshness && !freshness.dengueScrapeOk && (
              <span className="text-[#F0A090]">
                Dengue cases: demo placeholder counts
                {freshness.dengueAsOf ? ` (as of ${freshness.dengueAsOf})` : ''}
                — not a live hospital feed
              </span>
            )}
            {error && <span className="text-[#F0A090]">{error}</span>}
            {builtAt && (
              <span className="opacity-70 ml-auto">
                Updated{' '}
                {new Date(builtAt).toLocaleString('en-GB', {
                  timeZone: 'Asia/Karachi',
                })}{' '}
                PKT
              </span>
            )}
          </div>
        </div>
      )}

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cityConditions={displayConditions}
        onRefresh={handleRefresh}
        refreshing={loading}
      />

      <ConditionsStrip conditions={displayConditions} freshness={freshness} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-6">
        {activeTab === 'dashboard' && (
          <div
            className={
              mapFullscreen ? '' : 'grid lg:grid-cols-12 gap-5 items-start'
            }
          >
            <div
              className={
                mapFullscreen ? '' : 'lg:col-span-7 xl:col-span-8 space-y-3'
              }
            >
              <ZoneMapLazy
                zones={zones}
                selectedZoneId={selectedZoneId}
                onSelectZone={handleSelectZone}
                overlay={mapOverlay}
                setOverlay={setMapOverlay}
                fullscreen={mapFullscreen}
                onToggleFullscreen={() => setMapFullscreen((v) => !v)}
              />
            </div>

            {!mapFullscreen && (
              <div className="lg:col-span-5 xl:col-span-4 sticky top-20">
                <ZoneDetailPanel
                  zone={selectedZone}
                  onClose={() => setSelectedZoneId(null)}
                  onSelectAnotherZone={(id) => setSelectedZoneId(id)}
                  allZones={zones}
                  weatherAsOf={freshness?.weatherAsOf}
                />
              </div>
            )}

            {mapFullscreen && selectedZone && (
              <div className="fixed top-20 right-3 bottom-16 w-[min(100vw-1.5rem,360px)] z-[210] overflow-y-auto shadow-2xl">
                <ZoneDetailPanel
                  zone={selectedZone}
                  onClose={() => setSelectedZoneId(null)}
                  onSelectAnotherZone={(id) => setSelectedZoneId(id)}
                  allZones={zones}
                  weatherAsOf={freshness?.weatherAsOf}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'overview' && (
          <CityRiskOverview
            zones={zones}
            onSelectZone={(zone) => {
              setSelectedZoneId(zone.id);
              setActiveTab('dashboard');
            }}
          />
        )}

        {activeTab === 'methodology' && <MethodologyPage />}

        {activeTab === 'admin' && (
          <AdminDataView
            zones={zones}
            cityConditions={displayConditions}
            onUpdateZone={handleUpdateZone}
            onUpdateCityConditions={(c) => setCityConditions(c)}
            onResetData={handleRefresh}
          />
        )}
      </main>

      <footer className="bg-[#1F3D2E] text-[#EDE6D6] border-t-2 border-[#14291F] py-4 px-6 text-xs font-mono-data mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>ICT Health · Dengue Surveillance</span>
          <span className="text-[#EDE6D6]/60">
            Islamabad · Open-Meteo · OpenStreetMap
          </span>
        </div>
      </footer>
    </div>
  );
}
