import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { ZoneData, MapOverlay, AreaType } from '../types';
import { RiskBadge } from './RiskBadge';
import { Layers, MapPin, Maximize2, Minimize2 } from 'lucide-react';
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
    // Always from real display blocks (never zone-center-only blobs)
    const zoneFilter = new Set(filteredZones.map((z) => z.id));
    const src = displayBlocks.filter((c) => zoneFilter.has(c.zoneId));
    const minScore = mapGrain === 'zones' ? 48 : 45;
    return src
      .filter((c) => c.riskScore >= minScore)
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
    if (!displayBlocks.length) return;

    const bounds = map.getBounds();
    const pad = 0.006;
    const zoneFilter = new Set(filteredZones.map((z) => z.id));
    const z = map.getZoom();
    const zonesMode = grainRef.current === 'zones';

    let visible = displayBlocks.filter(
      (c) =>
        zoneFilter.has(c.zoneId) &&
        c.lat >= bounds.getSouth() - pad &&
        c.lat <= bounds.getNorth() + pad &&
        c.lng >= bounds.getWest() - pad &&
        c.lng <= bounds.getEast() + pad
    );

    // Zones view: hotspot tiles inside the zone (works at every zoom)
    if (zonesMode) {
      visible = visible.filter((c) => c.riskScore >= 45);
    } else if (z < 12) {
      visible = visible.filter((c) => c.riskScore >= 42);
    }

    let draw = visible;
    if (z < 12 && draw.length > 400) {
      draw = draw.filter((c) => c.riskScore >= 48);
    }
    if (draw.length > 800) {
      draw = draw.filter((c) => {
        let h = 0;
        for (let i = 0; i < c.cellId.length; i++)
          h = (h + c.cellId.charCodeAt(i) * (i + 1)) % 5;
        return h === 0 || h === 1 || h === 2;
      });
    }

    let selectedLayer: L.Rectangle | null = null;

    for (const c of draw) {
      const intensity = cellIntensity(c, overlayRef.current);
      const fill = cellFillColor(intensity, overlayRef.current);
      const selected = c.cellId === selectedBlockRef.current;
      const rect = L.rectangle(
        [
          [c.south, c.west],
          [c.north, c.east],
        ],
        {
          color: selected ? '#14532d' : 'rgba(20,40,20,0.28)',
          weight: selected ? 3 : 0.5,
          fillColor: selected ? '#22c55e' : fill,
          fillOpacity: selected ? 0.72 : zonesMode ? 0.38 : 0.3,
          interactive: true,
        }
      );
      rect.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectBlockRef.current(c);
      });
      group.addLayer(rect);
      if (selected) selectedLayer = rect;
    }
    selectedLayer?.bringToFront();
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

    // Soft overview heat only when zoomed out — zoomed-in uses rectangles
    if (map.getZoom() >= 13) return;

    const layer = L.heatLayer(heatPoints, {
      radius: mapGrain === 'zones' ? 28 : 32,
      blur: mapGrain === 'zones' ? 24 : 28,
      maxZoom: 16,
      max: 1,
      minOpacity: 0.28,
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
    ? 'fixed inset-0 z-[200] bg-white flex flex-col'
    : 'bg-white border border-[var(--line)] rounded-xl shadow-sm overflow-hidden relative flex flex-col h-[min(70vh,640px)] min-h-[480px]';

  return (
    <div className={shellClass}>
      <div className="bg-white p-3 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-heading font-bold text-sm text-[var(--ink)]">
            Islamabad risk map
          </h2>
          <span className="font-mono-data text-[10px] text-[var(--muted)] truncate">
            {gridMeta
              ? `${gridMeta.count.toLocaleString()} areas · ~${DISPLAY_BLOCK_M}m`
              : 'Loading…'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 bg-[var(--bg)] p-0.5 rounded-lg border border-[var(--line)]">
            {(
              [
                ['blocks', 'Areas'],
                ['zones', 'Zones'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMapGrain(key)}
                className={`px-2.5 py-1 text-xs font-heading font-semibold rounded-md transition-colors ${
                  mapGrain === key
                    ? 'bg-[var(--brand)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 bg-[var(--bg)] p-0.5 rounded-lg border border-[var(--line)]">
            {(
              [
                ['risk', 'Risk'],
                ['vegetation', 'Vegetation'],
                ['terrain', 'Low ground'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOverlay(key)}
                className={`px-2.5 py-1 text-xs font-heading font-semibold rounded-md transition-colors ${
                  overlay === key
                    ? 'bg-white text-[var(--ink)] shadow-sm'
                    : 'text-[var(--muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 bg-[var(--bg)] p-0.5 rounded-lg border border-[var(--line)]">
            {(
              [
                ['all', 'All'],
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
                className={`px-2 py-1 text-xs font-heading font-semibold rounded-md ${
                  areaFilter === key
                    ? 'bg-white text-[var(--ink)] shadow-sm'
                    : 'text-[var(--muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg)]"
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

      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0 z-0" />

        <div className="absolute bottom-3 left-3 bg-white/95 border border-[var(--line)] p-2.5 rounded-lg text-[11px] text-[var(--ink)] shadow-md z-[500] pointer-events-none max-w-[220px]">
          <div className="font-heading font-semibold text-xs mb-1 flex items-center justify-between gap-2">
            <span>
              {mapGrain === 'blocks' ? 'Risk areas' : 'Zone hotspots'}
            </span>
            <Layers className="w-3 h-3 text-[var(--brand)]" />
          </div>
          <p className="text-[10px] text-[var(--muted)] mb-1.5 leading-snug">
            {mapGrain === 'blocks'
              ? 'Click a coloured square for details. Green = selected.'
              : 'Zone pins plus elevated risk squares inside each zone — zoom in still shows hotspots.'}
          </p>
          <div className="h-1.5 w-36 rounded-full mb-1 bg-gradient-to-r from-blue-500 via-yellow-400 to-red-600" />
          <div className="flex justify-between font-mono-data text-[10px] text-[var(--muted)]">
            <span>Lower</span>
            <span>Higher</span>
          </div>
        </div>

        {hoveredZone && mapGrain === 'zones' && (
          <div className="absolute top-3 right-3 bg-white border border-[var(--line)] p-3 rounded-lg shadow-lg text-[var(--ink)] z-[500] max-w-[240px] pointer-events-none">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-heading font-bold text-sm">
                {hoveredZone.name}
              </span>
              <RiskBadge
                level={hoveredZone.riskLevel}
                score={hoveredZone.riskScore}
                size="sm"
              />
            </div>
            <div className="text-[10px] text-[var(--muted)]">
              {hoveredZone.tehsil}
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--bg)] px-3 py-2 border-t border-[var(--line)] text-xs text-[var(--muted)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[var(--brand)]" />
          <span>
            Click an area for score factors
            {gridMeta?.computedAt
              ? ` · updated ${gridMeta.computedAt.slice(0, 10)}`
              : ''}
          </span>
        </div>
      </div>
    </div>
  );
};
