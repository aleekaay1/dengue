import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { ZoneData, MapOverlay, AreaType } from '../types';
import { RiskBadge } from './RiskBadge';
import { Layers, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { TEHSILS } from '../../lib/zoneMeta';
import {
  cellFillColor,
  cellIntensity,
  type GridCellDto,
} from './gridMapUtils';
import { unpackGridPack, type GridPackFile } from '../lib/unpackGridPack';
import {
  aggregateToDisplayBlocks,
  DISPLAY_BLOCK_M,
} from '../lib/aggregateBlocks';

interface ZoneMapProps {
  zones: ZoneData[];
  selectedZoneId: string | null;
  onSelectZone: (zone: ZoneData) => void;
  selectedBlockId: string | null;
  onSelectBlock: (cell: GridCellDto | null) => void;
  overlay: MapOverlay;
  setOverlay: (overlay: MapOverlay) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  gridEpoch?: number;
}

type AreaFilter = 'all' | AreaType;
type TehsilFilter = 'all' | string;
type MapGrain = 'blocks' | 'zones';

const ISLAMABAD_CENTER: L.LatLngExpression = [33.6938, 73.0652];
const DEFAULT_ZOOM = 12;

const HEAT_GRADIENT: Record<string, string> = {
  0.15: '#1d4ed8',
  0.35: '#22c55e',
  0.55: '#eab308',
  0.75: '#f97316',
  1.0: '#dc2626',
};

function riskMarkerColor(level: ZoneData['riskLevel']): string {
  if (level === 'high') return '#B5432A';
  if (level === 'medium') return '#D9A441';
  return '#4C8C6B';
}

function zoneCenterHeat(
  zones: ZoneData[],
  overlay: MapOverlay
): [number, number, number][] {
  return zones.map((zone) => {
    let intensity = zone.riskScore / 100;
    if (overlay === 'vegetation') intensity = zone.vegetationIndex;
    else if (overlay === 'terrain')
      intensity = (zone.depressionRiskScore ?? 0) / 100;
    else if (overlay === 'cases') {
      const recent = zone.pastCases[zone.pastCases.length - 1]?.count ?? 0;
      intensity = Math.min(1, recent / 30);
    }
    return [
      zone.coordinates.lat,
      zone.coordinates.lng,
      Math.min(1, Math.max(0.25, intensity)),
    ];
  });
}

export const ZoneMap: React.FC<ZoneMapProps> = ({
  zones,
  selectedZoneId,
  onSelectZone,
  selectedBlockId,
  onSelectBlock,
  overlay,
  setOverlay,
  fullscreen,
  onToggleFullscreen,
  gridEpoch = 0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatRef = useRef<L.HeatLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const cellsRef = useRef<L.LayerGroup | null>(null);
  const onSelectZoneRef = useRef(onSelectZone);
  const onSelectBlockRef = useRef(onSelectBlock);
  const fitKeyRef = useRef('');
  const overlayRef = useRef(overlay);
  const grainRef = useRef<MapGrain>('blocks');
  const selectedBlockRef = useRef(selectedBlockId);

  const [hoveredZone, setHoveredZone] = useState<ZoneData | null>(null);
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  const [tehsilFilter, setTehsilFilter] = useState<TehsilFilter>('all');
  const [mapGrain, setMapGrain] = useState<MapGrain>('blocks');
  const [displayBlocks, setDisplayBlocks] = useState<GridCellDto[]>([]);
  const [gridMeta, setGridMeta] = useState<{
    count: number;
    sourceCount: number;
    computedAt: string | null;
  } | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [moveTick, setMoveTick] = useState(0);

  onSelectZoneRef.current = onSelectZone;
  onSelectBlockRef.current = onSelectBlock;
  overlayRef.current = overlay;
  grainRef.current = mapGrain;
  selectedBlockRef.current = selectedBlockId;

  const filteredZones = useMemo(() => {
    return zones.filter((z) => {
      if (areaFilter !== 'all' && z.areaType !== areaFilter) return false;
      if (tehsilFilter !== 'all' && z.tehsil !== tehsilFilter) return false;
      return true;
    });
  }, [zones, areaFilter, tehsilFilter]);

  const tehsilOptions = useMemo(() => {
    const present = new Set(zones.map((z) => z.tehsil));
    return TEHSILS.filter((t) => present.has(t));
  }, [zones]);

  // Load pack → filter empty/river → aggregate to ~200 m display blocks
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const packRes = await fetch(
          `/grid_cells_pack.json?v=${encodeURIComponent(String(gridEpoch))}&cb=3`
        );
        if (!packRes.ok) return;
        const raw = (await packRes.json()) as GridPackFile;
        const unpacked = unpackGridPack(raw);
        if (cancelled || !unpacked.cells.length) return;
        const blocks = aggregateToDisplayBlocks(unpacked.cells);
        setDisplayBlocks(blocks);
        setGridMeta({
          count: blocks.length,
          sourceCount: unpacked.cells.length,
          computedAt: unpacked.computedAt,
        });
      } catch {
        /* empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gridEpoch]);

  const heatPoints = useMemo(() => {
    if (mapGrain === 'zones') return zoneCenterHeat(filteredZones, overlay);
    const zoneFilter = new Set(filteredZones.map((z) => z.id));
    const src = displayBlocks.filter((c) => zoneFilter.has(c.zoneId));
    // Overview heat: only elevated risk, thinned
    return src
      .filter((c) => c.riskScore >= 45)
      .filter((_, i) => i % 2 === 0)
      .map(
        (c) =>
          [c.lat, c.lng, cellIntensity(c, overlay)] as [
            number,
            number,
            number,
          ]
      );
  }, [mapGrain, filteredZones, overlay, displayBlocks]);

  const redrawCellRects = useCallback(() => {
    const map = mapRef.current;
    const group = cellsRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (grainRef.current !== 'blocks') return;
    if (!displayBlocks.length) return;

    const bounds = map.getBounds();
    const pad = 0.006;
    const zoneFilter = new Set(filteredZones.map((z) => z.id));
    const z = map.getZoom();

    let visible = displayBlocks.filter(
      (c) =>
        zoneFilter.has(c.zoneId) &&
        c.lat >= bounds.getSouth() - pad &&
        c.lat <= bounds.getNorth() + pad &&
        c.lng >= bounds.getWest() - pad &&
        c.lng <= bounds.getEast() + pad
    );

    // Prefer medium+ risk when zoomed out
    if (z < 12) {
      visible = visible.filter((c) => c.riskScore >= 42);
    }

    const maxDraw = z >= 13 ? 900 : z >= 12 ? 550 : 320;
    const step =
      visible.length > maxDraw ? Math.ceil(visible.length / maxDraw) : 1;

    for (let i = 0; i < visible.length; i += step) {
      const c = visible[i];
      const intensity = cellIntensity(c, overlayRef.current);
      const fill = cellFillColor(intensity, overlayRef.current);
      const selected = c.cellId === selectedBlockRef.current;
      const rect = L.rectangle(
        [
          [c.south, c.west],
          [c.north, c.east],
        ],
        {
          color: selected ? '#D9A441' : 'rgba(20,30,20,0.25)',
          weight: selected ? 2 : 0.4,
          fillColor: fill,
          fillOpacity: selected ? 0.55 : 0.32,
          interactive: true,
        }
      );
      rect.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectBlockRef.current(c);
      });
      group.addLayer(rect);
    }
  }, [displayBlocks, filteredZones]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: ISLAMABAD_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
      maxZoom: 18,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ~200m risk blocks',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    cellsRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on('zoomend moveend', () => {
      setZoom(map.getZoom());
      setMoveTick((t) => t + 1);
    });
    map.on('click', () => {
      // click empty map clears block selection
      onSelectBlockRef.current(null);
    });

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      heatRef.current = null;
      markersRef.current = null;
      cellsRef.current = null;
    };
  }, []);

  useEffect(() => {
    redrawCellRects();
  }, [redrawCellRects, overlay, mapGrain, zoom, moveTick, selectedBlockId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    requestAnimationFrame(() => map.invalidateSize());
  }, [fullscreen, selectedBlockId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) onToggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, onToggleFullscreen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    // Blocks mode: rectangles only (map stays readable)
    if (mapGrain === 'blocks') return;

    const layer = L.heatLayer(heatPoints, {
      radius: 48,
      blur: 42,
      maxZoom: 17,
      max: 1,
      minOpacity: 0.4,
      gradient: HEAT_GRADIENT,
    });
    layer.addTo(map);
    heatRef.current = layer;
  }, [heatPoints, mapGrain, zoom]);

  useEffect(() => {
    const group = markersRef.current;
    const map = mapRef.current;
    if (!group || !map) return;

    group.clearLayers();

    // Zone markers only in Zones mode (or faint in Blocks)
    for (const zone of filteredZones) {
      const isSelected = zone.id === selectedZoneId;
      const marker = L.circleMarker(
        [zone.coordinates.lat, zone.coordinates.lng],
        {
          radius: isSelected ? 8 : mapGrain === 'zones' ? 6 : 4,
          color: isSelected ? '#EDE6D6' : '#14291F',
          weight: isSelected ? 2.5 : 1,
          fillColor: riskMarkerColor(zone.riskLevel),
          fillOpacity: mapGrain === 'zones' ? 0.95 : 0.35,
        }
      );

      marker.bindTooltip(`${zone.name} · ${zone.riskScore}`, {
        direction: 'top',
        offset: [0, -6],
        opacity: 0.9,
        sticky: false,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectBlockRef.current(null);
        onSelectZoneRef.current(zone);
      });
      marker.on('mouseover', () => setHoveredZone(zone));
      marker.on('mouseout', () =>
        setHoveredZone((prev) => (prev?.id === zone.id ? null : prev))
      );

      group.addLayer(marker);
    }

    const fitKey = `${filteredZones.map((z) => z.id).join(',')}|${fullscreen}|${mapGrain}`;
    if (filteredZones.length && fitKey !== fitKeyRef.current) {
      const bounds = L.latLngBounds(
        filteredZones.map(
          (z) => [z.coordinates.lat, z.coordinates.lng] as [number, number]
        )
      );
      map.fitBounds(bounds.pad(0.18), {
        animate: true,
        maxZoom: mapGrain === 'blocks' ? 13 : 12,
      });
      fitKeyRef.current = fitKey;
    }
  }, [filteredZones, selectedZoneId, fullscreen, mapGrain]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedZoneId) return;
    const zone = filteredZones.find((z) => z.id === selectedZoneId);
    if (!zone) return;
    map.panTo([zone.coordinates.lat, zone.coordinates.lng], { animate: true });
  }, [selectedZoneId, filteredZones]);

  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el) return;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shellClass = fullscreen
    ? 'fixed inset-0 z-[200] bg-[#14291F] flex flex-col'
    : 'bg-[#14291F] border-2 border-[#2D5843] rounded-xs shadow-md overflow-hidden relative flex flex-col h-[min(70vh,640px)] min-h-[480px]';

  return (
    <div className={shellClass}>
      <div className="bg-[#1F3D2E] p-3 border-b border-[#2D5843] flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-[#D9A441] rounded-full" />
          <h2 className="font-heading font-extrabold text-sm uppercase tracking-wide text-[#EDE6D6]">
            ICT Risk Map
          </h2>
          <span className="font-mono-data text-[10px] text-[#EDE6D6]/50">
            {gridMeta
              ? `${gridMeta.count.toLocaleString()} × ~${DISPLAY_BLOCK_M}m blocks`
              : 'Loading…'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[#14291F] p-1 rounded-xs border border-[#2D5843]">
            {(
              [
                ['blocks', 'Blocks', 'bg-sky-700 text-white'],
                ['zones', 'Zones', 'bg-[#D9A441] text-[#23241F]'],
              ] as const
            ).map(([key, label, activeClass]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMapGrain(key);
                  if (key === 'zones') onSelectBlock(null);
                }}
                className={`px-2.5 py-1 text-xs font-heading font-bold rounded-xs transition-colors ${
                  mapGrain === key
                    ? activeClass
                    : 'text-[#EDE6D6]/70 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#14291F] p-1 rounded-xs border border-[#2D5843]">
            {(
              [
                ['risk', 'Risk', 'bg-[#D9A441] text-[#23241F]'],
                ['vegetation', 'Canopy', 'bg-[#4C8C6B] text-white'],
                ['terrain', 'Terrain', 'bg-sky-700 text-white'],
              ] as const
            ).map(([key, label, activeClass]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOverlay(key)}
                className={`px-2.5 py-1 text-xs font-heading font-bold rounded-xs transition-colors ${
                  overlay === key
                    ? activeClass
                    : 'text-[#EDE6D6]/70 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-xs border border-[#2D5843] text-[#EDE6D6] hover:bg-[#14291F]"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen map'}
          >
            {fullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="px-3 py-2 bg-[#14291F] border-b border-[#2D5843] flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-heading font-bold uppercase text-[#EDE6D6]/60">
          Area
        </span>
        {(
          [
            ['all', 'All ICT'],
            ['urban', 'Urban'],
            ['rural', 'Rural'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setAreaFilter(key);
              setTehsilFilter('all');
            }}
            className={`px-2 py-0.5 text-[11px] font-heading font-bold rounded-xs border ${
              areaFilter === key
                ? 'bg-[#4C8C6B] border-[#4C8C6B] text-white'
                : 'border-[#2D5843] text-[#EDE6D6]/70'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-[10px] font-heading font-bold uppercase text-[#EDE6D6]/60 ml-2">
          Tehsil
        </span>
        <button
          type="button"
          onClick={() => setTehsilFilter('all')}
          className={`px-2 py-0.5 text-[11px] font-heading font-bold rounded-xs border ${
            tehsilFilter === 'all'
              ? 'bg-[#D9A441] border-[#D9A441] text-[#23241F]'
              : 'border-[#2D5843] text-[#EDE6D6]/70'
          }`}
        >
          All
        </button>
        {tehsilOptions.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTehsilFilter(t)}
            className={`px-2 py-0.5 text-[11px] font-heading font-bold rounded-xs border ${
              tehsilFilter === t
                ? 'bg-[#D9A441] border-[#D9A441] text-[#23241F]'
                : 'border-[#2D5843] text-[#EDE6D6]/70'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0 z-0" />

        <div className="absolute bottom-3 left-3 bg-[#1F3D2E]/95 border border-[#2D5843] p-2.5 rounded-xs text-[11px] text-[#EDE6D6] shadow-lg z-[500] pointer-events-none max-w-[220px]">
          <div className="font-heading font-bold text-xs uppercase mb-1 flex items-center justify-between gap-2">
            <span>
              {mapGrain === 'blocks'
                ? `~${DISPLAY_BLOCK_M}m risk blocks`
                : 'Zone rollup'}
            </span>
            <Layers className="w-3 h-3 text-[#D9A441]" />
          </div>
          <p className="text-[10px] text-[#EDE6D6]/70 mb-1.5 leading-snug">
            {mapGrain === 'blocks'
              ? 'Click a block for details on the right. Empty/river cells hidden. Map stays visible under translucent fills.'
              : 'Zone markers only — switch to Blocks for lat/lng cells.'}
          </p>
          <div className="h-2 w-36 rounded-xs mb-1 bg-gradient-to-r from-blue-600 via-yellow-400 to-red-600" />
          <div className="flex justify-between font-mono-data text-[10px] text-[#EDE6D6]/70">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        {hoveredZone && mapGrain === 'zones' && (
          <div className="absolute top-3 right-3 bg-[#1F3D2E] border border-[#D9A441] p-3 rounded-xs shadow-2xl text-[#EDE6D6] z-[500] max-w-[240px] pointer-events-none">
            <div className="flex items-center justify-between gap-2 border-b border-[#2D5843] pb-1.5 mb-1.5">
              <span className="font-heading font-extrabold text-sm text-white uppercase">
                {hoveredZone.name}
              </span>
              <RiskBadge
                level={hoveredZone.riskLevel}
                score={hoveredZone.riskScore}
                size="sm"
              />
            </div>
            <div className="text-[10px] font-mono-data text-[#D9A441] uppercase">
              {hoveredZone.tehsil}
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#1F3D2E] px-3 py-2 border-t border-[#2D5843] text-xs font-mono-data text-[#EDE6D6]/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#D9A441]" />
          <span>
            Exact lat/lng blocks · click for score
            {gridMeta?.computedAt
              ? ` · ${gridMeta.computedAt.slice(0, 10)}`
              : ''}
          </span>
        </div>
        <div>
          {gridMeta
            ? `from ${gridMeta.sourceCount.toLocaleString()} × 50m cells`
            : ''}
        </div>
      </div>
    </div>
  );
};
