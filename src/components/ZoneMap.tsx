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
  cellPopupHtml,
  type GridCellDto,
} from './gridMapUtils';

interface ZoneMapProps {
  zones: ZoneData[];
  selectedZoneId: string | null;
  onSelectZone: (zone: ZoneData) => void;
  overlay: MapOverlay;
  setOverlay: (overlay: MapOverlay) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

type AreaFilter = 'all' | AreaType;
type TehsilFilter = 'all' | string;
/** Blocks = real 50m cells; Zones = aggregated markers only */
type MapGrain = 'blocks' | 'zones';

const ISLAMABAD_CENTER: L.LatLngExpression = [33.6938, 73.0652];
const DEFAULT_ZOOM = 12;
/** Above this zoom, solid choropleth blocks (no heat lattice) */
const CELL_RECT_ZOOM = 11;

const HEAT_GRADIENT: Record<string, string> = {
  0.15: '#1d4ed8',
  0.35: '#22c55e',
  0.55: '#eab308',
  0.75: '#f97316',
  1.0: '#dc2626',
};

const VEG_GRADIENT: Record<string, string> = {
  0.2: '#d9f99d',
  0.45: '#86efac',
  0.7: '#16a34a',
  1.0: '#14532d',
};

const CASES_GRADIENT: Record<string, string> = {
  0.2: '#fde68a',
  0.45: '#fb923c',
  0.7: '#dc2626',
  1.0: '#7f1d1d',
};

const TERRAIN_GRADIENT: Record<string, string> = {
  0.15: '#e0f2fe',
  0.4: '#38bdf8',
  0.65: '#0284c7',
  1.0: '#0c4a6e',
};

function riskMarkerColor(level: ZoneData['riskLevel']): string {
  if (level === 'high') return '#B5432A';
  if (level === 'medium') return '#D9A441';
  return '#4C8C6B';
}

function hash01(seed: string, salt: number): number {
  let h = salt * 374761393;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 1103515245);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Visible zone heat when block grid file is unavailable */
function zoneFallbackHeat(
  zones: ZoneData[],
  overlay: MapOverlay
): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (const zone of zones) {
    let intensity = zone.riskScore / 100;
    if (overlay === 'vegetation') intensity = zone.vegetationIndex;
    else if (overlay === 'terrain')
      intensity = (zone.depressionRiskScore ?? 0) / 100;
    else if (overlay === 'cases') {
      const recent = zone.pastCases[zone.pastCases.length - 1]?.count ?? 0;
      intensity = recent / 30;
    }
    intensity = Math.min(1, Math.max(0.2, intensity));
    const { lat, lng } = zone.coordinates;
    const ruralScale = zone.areaType === 'rural' ? 1.35 : 1;
    points.push([lat, lng, intensity]);
    for (let r = 1; r <= 4; r++) {
      const spokes = 8 + r * 2;
      const radiusDeg = 0.007 * r * ruralScale;
      for (let s = 0; s < spokes; s++) {
        const angle = (s / spokes) * Math.PI * 2 + hash01(zone.id, r) * 0.3;
        points.push([
          lat + Math.cos(angle) * radiusDeg * 0.75,
          lng + Math.sin(angle) * radiusDeg,
          intensity * (1 - r / 5.5),
        ]);
      }
    }
  }
  return points;
}

export const ZoneMap: React.FC<ZoneMapProps> = ({
  zones,
  selectedZoneId,
  onSelectZone,
  overlay,
  setOverlay,
  fullscreen,
  onToggleFullscreen,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatRef = useRef<L.HeatLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const cellsRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectZone);
  const fitKeyRef = useRef('');
  const overlayRef = useRef(overlay);
  const grainRef = useRef<MapGrain>('blocks');

  const [hoveredZone, setHoveredZone] = useState<ZoneData | null>(null);
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  const [tehsilFilter, setTehsilFilter] = useState<TehsilFilter>('all');
  const [mapGrain, setMapGrain] = useState<MapGrain>('blocks');
  const [gridPoints, setGridPoints] = useState<[number, number, number][] | null>(
    null
  );
  const [allGridCells, setAllGridCells] = useState<GridCellDto[]>([]);
  const [cellSizeM, setCellSizeM] = useState(50);
  const [gridMeta, setGridMeta] = useState<{
    count: number;
    computedAt: string | null;
    pilot: boolean;
  } | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  onSelectRef.current = onSelectZone;
  overlayRef.current = overlay;
  grainRef.current = mapGrain;

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

  // Static /grid_heat.json ships with the client (Vercel-safe). API is for zoomed cells.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let points: [number, number, number][] | null = null;
        let meta = { count: 0, computedAt: null as string | null, pilot: false };
        let size = 50;

        const staticRes = await fetch('/grid_heat.json');
        if (staticRes.ok) {
          const data = (await staticRes.json()) as {
            cellSizeM?: number;
            computedAt?: string | null;
            count?: number;
            points?: [number, number, number][];
          };
          if (data.points?.length) {
            points = data.points;
            size = data.cellSizeM ?? 50;
            meta = {
              count: data.count ?? data.points.length,
              computedAt: data.computedAt ?? null,
              pilot: false,
            };
          }
        }

        if (!points?.length) {
          const api = await fetch('/api/grid?heat=1');
          if (api.ok) {
            const data = (await api.json()) as {
              cellSizeM?: number;
              computedAt?: string | null;
              count?: number;
              points?: [number, number, number][];
            };
            if (data.points?.length) {
              points = data.points;
              size = data.cellSizeM ?? 50;
              meta = {
                count: data.count ?? data.points.length,
                computedAt: data.computedAt ?? null,
                pilot: false,
              };
            }
          }
        }

        if (cancelled || !points?.length) return;
        setCellSizeM(size);
        setGridMeta(meta);
        setGridPoints(points);
      } catch {
        /* zoneFallbackHeat */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Always refresh visible cells in Blocks mode (choropleth + hover reasons)
  useEffect(() => {
    if (mapGrain !== 'blocks') return;
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    const b = map.getBounds().pad(0.15);
    const bbox = [
      b.getWest(),
      b.getSouth(),
      b.getEast(),
      b.getNorth(),
    ].join(',');
    const limit = map.getZoom() >= CELL_RECT_ZOOM ? 8000 : 2500;
    void (async () => {
      try {
        const res = await fetch(`/api/grid?bbox=${bbox}&limit=${limit}`);
        if (!res.ok) return;
        const body = (await res.json()) as { cells?: GridCellDto[] };
        if (!cancelled && body.cells?.length) setAllGridCells(body.cells);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zoom, mapGrain]);

  const heatPoints = useMemo(() => {
    // Zones mode: soft zone clouds. Blocks overview: thinned static heat (no lattice).
    if (mapGrain === 'zones' || !gridPoints?.length) {
      return zoneFallbackHeat(filteredZones, overlay);
    }
    if (filteredZones.length < zones.length) {
      const zoneFilter = new Set(filteredZones.map((z) => z.id));
      // Prefer viewport cells when filtering
      if (allGridCells.length) {
        return allGridCells
          .filter((c) => zoneFilter.has(c.zoneId))
          .filter((_, i) => i % 3 === 0)
          .map(
            (c) =>
              [c.lat, c.lng, cellIntensity(c, overlay)] as [
                number,
                number,
                number,
              ]
          );
      }
    }
    return gridPoints;
  }, [
    mapGrain,
    gridPoints,
    filteredZones,
    overlay,
    allGridCells,
    zones.length,
  ]);

  const redrawCellRects = useCallback(() => {
    const map = mapRef.current;
    const group = cellsRef.current;
    if (!map || !group) return;
    group.clearLayers();

    if (grainRef.current !== 'blocks') return;
    if (map.getZoom() < CELL_RECT_ZOOM) return;
    if (!allGridCells.length) return;

    const bounds = map.getBounds();
    const pad = 0.003;
    const zoneFilter = new Set(filteredZones.map((z) => z.id));

    const visible = allGridCells.filter(
      (c) =>
        zoneFilter.has(c.zoneId) &&
        c.lat >= bounds.getSouth() - pad &&
        c.lat <= bounds.getNorth() + pad &&
        c.lng >= bounds.getWest() - pad &&
        c.lng <= bounds.getEast() + pad
    );

    const maxDraw = 5000;
    const step = visible.length > maxDraw ? Math.ceil(visible.length / maxDraw) : 1;

    for (let i = 0; i < visible.length; i += step) {
      const c = visible[i];
      const intensity = cellIntensity(c, overlayRef.current);
      const fill = cellFillColor(intensity, overlayRef.current);
      const rect = L.rectangle(
        [
          [c.south, c.west],
          [c.north, c.east],
        ],
        {
          color: 'rgba(20,30,20,0.45)',
          weight: 0.6,
          fillColor: fill,
          fillOpacity: 0.88,
          interactive: true,
        }
      );
      const html = cellPopupHtml(c, cellSizeM);
      rect.bindTooltip(html, {
        direction: 'top',
        sticky: true,
        opacity: 1,
        className: 'block-risk-tooltip',
      });
      rect.bindPopup(html, { maxWidth: 340 });
      group.addLayer(rect);
    }
  }, [allGridCells, filteredZones, cellSizeM]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: ISLAMABAD_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
      maxZoom: 19,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · block grid 50m',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    cellsRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const onZoom = () => {
      setZoom(map.getZoom());
      redrawCellRects();
      // Fade heat when rectangles take over
      if (heatRef.current) {
        const el = (heatRef.current as unknown as { _canvas?: HTMLCanvasElement })
          ._canvas;
        if (el) {
          el.style.opacity = map.getZoom() >= CELL_RECT_ZOOM ? '0.15' : '0.9';
        }
      }
    };
    map.on('zoomend moveend', onZoom);

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.off('zoomend moveend', onZoom);
      map.remove();
      mapRef.current = null;
      heatRef.current = null;
      markersRef.current = null;
      cellsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    redrawCellRects();
  }, [redrawCellRects, overlay, mapGrain, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    requestAnimationFrame(() => map.invalidateSize());
  }, [fullscreen]);

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

    if (mapGrain === 'zones' && !gridPoints?.length) {
      // zone-only fallback
    }

    const gradient =
      overlay === 'vegetation'
        ? VEG_GRADIENT
        : overlay === 'cases'
          ? CASES_GRADIENT
          : overlay === 'terrain'
            ? TERRAIN_GRADIENT
            : HEAT_GRADIENT;

    // Blocks at z11+: solid rectangles only — hide heat so the lattice of dots never shows
    if (mapGrain === 'blocks' && map.getZoom() >= CELL_RECT_ZOOM) {
      return;
    }

    const z = map.getZoom();
    const radiusPx = z >= 12 ? 32 : 40;
    const blurPx = z >= 12 ? 28 : 36;

    const layer = L.heatLayer(heatPoints, {
      radius: radiusPx,
      blur: blurPx,
      maxZoom: 17,
      max: 1,
      minOpacity: 0.55,
      gradient,
    });
    layer.addTo(map);
    heatRef.current = layer;
  }, [heatPoints, overlay, mapGrain, cellSizeM, gridPoints?.length, zoom]);

  useEffect(() => {
    const group = markersRef.current;
    const map = mapRef.current;
    if (!group || !map) return;

    group.clearLayers();

    for (const zone of filteredZones) {
      const isSelected = zone.id === selectedZoneId;
      const marker = L.circleMarker(
        [zone.coordinates.lat, zone.coordinates.lng],
        {
          radius: isSelected ? 9 : 6,
          color: isSelected ? '#EDE6D6' : '#14291F',
          weight: isSelected ? 3 : 1.5,
          fillColor: riskMarkerColor(zone.riskLevel),
          fillOpacity: mapGrain === 'zones' ? 0.95 : 0.75,
        }
      );

      marker.bindTooltip(
        `<strong>${zone.name}</strong><br/>${zone.tehsil} · zone rollup<br/>Risk ${zone.riskScore}/100`,
        { direction: 'top', offset: [0, -8], opacity: 0.95 }
      );

      marker.on('click', () => onSelectRef.current(zone));
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
      map.fitBounds(bounds.pad(0.2), {
        animate: true,
        maxZoom: mapGrain === 'blocks' ? 14 : 12,
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

  const selectedName =
    zones.find((z) => z.id === selectedZoneId)?.name ?? 'None';

  const shellClass = fullscreen
    ? 'fixed inset-0 z-[200] bg-[#14291F] flex flex-col'
    : 'bg-[#14291F] border-2 border-[#2D5843] rounded-xs shadow-md overflow-hidden relative flex flex-col h-full min-h-[520px]';

  return (
    <div className={shellClass}>
      <div className="bg-[#1F3D2E] p-3 border-b border-[#2D5843] flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-[#D9A441] rounded-full" />
          <h2 className="font-heading font-extrabold text-sm uppercase tracking-wide text-[#EDE6D6]">
            ICT Block Risk Map
          </h2>
          <span className="font-mono-data text-[10px] text-[#EDE6D6]/50">
            {gridMeta
              ? `${gridMeta.count} × ${cellSizeM}m cells${gridMeta.pilot ? ' (pilot)' : ''}`
              : `${filteredZones.length} zones`}
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
                onClick={() => setMapGrain(key)}
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
                ['cases', 'People', 'bg-[#B5432A] text-white'],
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

      <div className={`relative flex-1 ${fullscreen ? 'min-h-0' : 'min-h-[420px]'}`}>
        <div ref={containerRef} className="absolute inset-0 z-0" />

        <div className="absolute bottom-3 left-3 bg-[#1F3D2E]/95 border border-[#2D5843] p-2.5 rounded-xs text-[11px] text-[#EDE6D6] shadow-lg z-[500] pointer-events-none max-w-[240px]">
          <div className="font-heading font-bold text-xs uppercase mb-1.5 border-b border-[#2D5843] pb-1 flex items-center justify-between gap-2">
            <span>
              {zoom >= CELL_RECT_ZOOM && mapGrain === 'blocks'
                ? `${cellSizeM}m surveillance blocks`
                : overlay === 'risk'
                  ? 'Block risk overview'
                  : overlay === 'vegetation'
                    ? 'Canopy (NDVI)'
                    : overlay === 'terrain'
                      ? 'Terrain sinks'
                      : 'People-at-risk'}
            </span>
            <Layers className="w-3 h-3 text-[#D9A441]" />
          </div>
          <p className="text-[10px] text-[#EDE6D6]/70 mb-1.5 leading-snug">
            {zoom >= CELL_RECT_ZOOM && mapGrain === 'blocks'
              ? 'Hover any block for NDVI, LST, terrain, settlement & score factors. Not household-level.'
              : 'Zoom in for solid coloured blocks with hover explanations (ministry view).'}
          </p>
          <div
            className={`h-2 w-36 rounded-xs mb-1.5 bg-gradient-to-r ${
              overlay === 'vegetation'
                ? 'from-lime-200 via-green-500 to-green-950'
                : overlay === 'cases'
                  ? 'from-amber-200 via-orange-500 to-red-900'
                  : overlay === 'terrain'
                    ? 'from-sky-100 via-sky-500 to-sky-950'
                    : 'from-blue-600 via-yellow-400 to-red-600'
            }`}
          />
          <div className="flex justify-between font-mono-data text-[10px] text-[#EDE6D6]/70">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        {hoveredZone && (
          <div className="absolute top-3 right-3 bg-[#1F3D2E] border border-[#D9A441] p-3 rounded-xs shadow-2xl text-[#EDE6D6] z-[500] max-w-[260px] pointer-events-none">
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
            <div className="text-[10px] font-mono-data text-[#D9A441] mb-1.5 uppercase">
              Zone rollup · {hoveredZone.tehsil}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono-data text-[11px]">
              <div>
                <span className="text-[#EDE6D6]/50">Temp </span>
                {hoveredZone.temperature}°C
              </div>
              <div>
                <span className="text-[#EDE6D6]/50">Humidity </span>
                {hoveredZone.humidity}%
              </div>
              <div>
                <span className="text-[#EDE6D6]/50">NDVI </span>
                {hoveredZone.vegetationIndex}
              </div>
              <div>
                <span className="text-[#EDE6D6]/50">Terrain </span>
                {hoveredZone.depressionRiskScore ?? 0}/100
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#1F3D2E] px-3 py-2 border-t border-[#2D5843] text-xs font-mono-data text-[#EDE6D6]/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#D9A441]" />
          <span>
            Real 50m blocks · OSM + DEM + weather
            {gridMeta?.computedAt
              ? ` · grid ${gridMeta.computedAt.slice(0, 10)}`
              : ''}
          </span>
        </div>
        <div>
          Selected:{' '}
          <strong className="text-white font-bold">{selectedName}</strong>
        </div>
      </div>
    </div>
  );
};
