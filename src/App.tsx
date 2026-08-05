import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ZoneData, ActiveTab, MapOverlay } from './types';
import type { InitialDashboardData } from './types/ssr';
import { Header } from './components/Header';
import { ConditionsStrip } from './components/ConditionsStrip';
import { ZoneMapLazy } from './components/ZoneMapLazy';
import { ZoneDetailPanel } from './components/ZoneDetailPanel';
import { BlockDetailPanel } from './components/BlockDetailPanel';
import { IctSignaturesMapLazy } from './components/IctSignaturesMapLazy';
import { CityRiskOverview } from './components/CityRiskOverview';
import { MethodologyPage } from './components/MethodologyPage';
import { AdminDataView } from './components/AdminDataView';
import { CrawlerDataBlock } from './components/CrawlerDataBlock';
import { useDashboardData } from './hooks/useDashboardData';
import type { GridCellDto } from './components/gridMapUtils';
import { DISPLAY_BLOCK_M } from './lib/aggregateBlocks';
import { AccuracyNote } from './components/AccuracyNote';
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
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState<{
    step: number;
    total: number;
  } | null>(null);
  const [gridEpoch, setGridEpoch] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState<GridCellDto | null>(null);

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
    setSelectedBlock(null);
    setSelectedZoneId(zone.id);
  };

  const handleUpdateZone = (updatedZone: ZoneData) => {
    setZones((prev) =>
      prev.map((z) => (z.id === updatedZone.id ? updatedZone : z))
    );
  };

  const handleRefresh = useCallback(() => {
    void (async () => {
      setAnalyzing('Updating zone weather & vegetation…');
      setAnalyzeProgress(null);
      try {
        await reload({ live: true, refresh: true });

        const listRes = await fetch('/api/grid-refresh?action=zones');
        if (!listRes.ok) {
          const err = (await listRes.json().catch(() => ({}))) as {
            error?: string;
          };
          setAnalyzing(
            err.error ||
              'Block grid refresh unavailable (connect Supabase service role). Zone feeds updated.'
          );
          await new Promise((r) => setTimeout(r, 2800));
          return;
        }
        const list = (await listRes.json()) as {
          zones: { id: string; name: string; step: number }[];
          count: number;
        };
        const total = list.count || list.zones.length;

        for (const z of list.zones) {
          setAnalyzing(`Analyzing ${z.name} — live weather + EE canopy…`);
          setAnalyzeProgress({ step: z.step + 1, total });
          const res = await fetch(
            `/api/grid-refresh?zone=${encodeURIComponent(z.id)}`,
            { method: 'POST' }
          );
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(body.error || `Failed on ${z.name}`);
          }
        }

        setGridEpoch((n) => n + 1);
        setAnalyzing('Saved to Supabase — map reloading cached blocks…');
        await new Promise((r) => setTimeout(r, 900));
      } catch (err) {
        setAnalyzing(
          err instanceof Error ? err.message : 'Analyze refresh failed'
        );
        await new Promise((r) => setTimeout(r, 3200));
      } finally {
        setAnalyzing(null);
        setAnalyzeProgress(null);
      }
    })();
  }, [reload]);

  if (loading && !cityConditions) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-9 h-9 text-[var(--brand)] animate-spin" />
        <div className="text-center">
          <h1 className="font-heading font-bold text-lg text-[var(--ink)]">
            Loading Islamabad data…
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-sm">
            Weather, vegetation, and zone scores
          </p>
        </div>
      </div>
    );
  }

  if (error && !cityConditions) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col items-center justify-center gap-4 p-6">
        <AlertTriangle className="w-9 h-9 text-[var(--risk-high)]" />
        <div className="text-center max-w-md">
          <h1 className="font-heading font-bold text-lg text-[var(--risk-high)]">
            Couldn’t load data
          </h1>
          <p className="text-sm text-[var(--muted)] mt-2 font-mono-data">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 inline-flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2 text-sm font-heading font-semibold rounded-lg"
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      <CrawlerDataBlock
        zones={zones}
        cityConditions={displayConditions}
        builtAt={builtAt}
      />

      {showBanner && (
        <div className="bg-[#fff8eb] text-[#6b4e16] border-b border-[#f0e0b8] px-4 py-2 text-[11px]">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            {freshness?.weatherLagged && freshness.weatherAsOf && (
              <span>Weather as of {freshness.weatherAsOf}</span>
            )}
            {freshness && !freshness.dengueScrapeOk && (
              <span>
                Case counts are demo placeholders — not a live hospital feed
              </span>
            )}
            {error && <span className="text-[var(--risk-high)]">{error}</span>}
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
        refreshing={loading || Boolean(analyzing)}
      />

      <ConditionsStrip conditions={displayConditions} freshness={freshness} />

      {analyzing && (
        <div className="sticky top-0 z-[180] bg-white border-b border-[var(--line)] px-4 py-3 shadow-sm">
          <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Loader2 className="w-5 h-5 text-[var(--brand)] animate-spin shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-heading font-semibold text-sm text-[var(--ink)]">
                Updating live weather…
              </p>
              <p className="text-[11px] text-[var(--muted)] truncate">{analyzing}</p>
            </div>
            {analyzeProgress && (
              <div className="font-mono-data text-xs text-[var(--brand)] shrink-0">
                {analyzeProgress.step}/{analyzeProgress.total}
              </div>
            )}
          </div>
          {analyzeProgress && (
            <div className="max-w-[1600px] mx-auto mt-2 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--brand)] transition-all duration-500"
                style={{
                  width: `${(analyzeProgress.step / analyzeProgress.total) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      <main className="flex-1 w-full mx-auto p-3 sm:p-4 lg:p-5 space-y-4 max-w-[1600px]">
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="relative">
              <ZoneMapLazy
                zones={zones}
                selectedZoneId={selectedZoneId}
                onSelectZone={handleSelectZone}
                selectedBlockId={selectedBlock?.cellId ?? null}
                onSelectBlock={setSelectedBlock}
                overlay={mapOverlay}
                setOverlay={setMapOverlay}
                fullscreen={mapFullscreen}
                onToggleFullscreen={() => setMapFullscreen((v) => !v)}
                gridEpoch={gridEpoch}
              />

              {selectedBlock && !mapFullscreen && (
                <div className="absolute top-14 right-3 w-[min(calc(100%-1.5rem),320px)] z-[120]">
                  <BlockDetailPanel
                    cell={selectedBlock}
                    cellSizeM={DISPLAY_BLOCK_M}
                    onClose={() => setSelectedBlock(null)}
                  />
                </div>
              )}

              {mapFullscreen && selectedBlock && (
                <div className="fixed top-20 right-3 w-[min(100vw-1.5rem,320px)] z-[220]">
                  <BlockDetailPanel
                    cell={selectedBlock}
                    cellSizeM={DISPLAY_BLOCK_M}
                    onClose={() => setSelectedBlock(null)}
                  />
                </div>
              )}
            </div>

            {!mapFullscreen && (
              <>
                <AccuracyNote />
                <div>
                  <h3 className="font-heading font-semibold text-sm text-[var(--ink)] mb-2">
                    Zone summary
                  </h3>
                  <ZoneDetailPanel
                    zone={selectedZone}
                    onClose={() => setSelectedZoneId(null)}
                    onSelectAnotherZone={(id) => {
                      setSelectedBlock(null);
                      setSelectedZoneId(id);
                    }}
                    allZones={zones}
                    weatherAsOf={freshness?.weatherAsOf}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'signatures' && (
          <IctSignaturesMapLazy gridEpoch={gridEpoch} />
        )}

        {activeTab === 'overview' && (
          <CityRiskOverview
            zones={zones}
            onSelectZone={(zone) => {
              setSelectedBlock(null);
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

      <footer className="bg-white border-t border-[var(--line)] py-4 px-6 text-xs text-[var(--muted)] mt-6">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>Islamabad dengue activity surveillance</span>
          <span>Open-Meteo · satellite vegetation · OpenStreetMap</span>
        </div>
      </footer>
    </div>
  );
}
