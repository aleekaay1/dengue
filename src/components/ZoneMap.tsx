import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { ZoneData, MapOverlay, AreaType } from '../types';
import { RiskBadge } from './RiskBadge';
import { Layers, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { TEHSILS } from '../../lib/zoneMeta';

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

const ISLAMABAD_CENTER: L.LatLngExpression = [33.6938, 73.0652];
const DEFAULT_ZOOM = 11;

function hash01(seed: string, salt: number): number {
  let h = salt * 374761393;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 1103515245);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function overlayIntensity(zone: ZoneData, overlay: MapOverlay): number {
  if (overlay === 'vegetation') {
    return Math.min(1, Math.max(0.05, zone.vegetationIndex));
  }
  if (overlay === 'cases') {
    const recent = zone.pastCases[zone.pastCases.length - 1]?.count ?? 0;
    return Math.min(1, Math.max(0.05, recent / 30));
  }
  if (overlay === 'terrain') {
    return Math.min(1, Math.max(0.05, (zone.depressionRiskScore ?? 0) / 100));
  }
  return Math.min(1, Math.max(0.08, zone.riskScore / 100));
}

function buildHeatPoints(
  zones: ZoneData[],
  overlay: MapOverlay
): [number, number, number][] {
  const points: [number, number, number][] = [];

  for (const zone of zones) {
    const intensity = overlayIntensity(zone, overlay);
    const { lat, lng } = zone.coordinates;
    const ruralScale = zone.areaType === 'rural' ? 1.35 : 1;
    const rings = 3 + Math.round(intensity * 4);

    points.push([lat, lng, intensity]);

    for (let r = 1; r <= rings; r++) {
      const spokes = 6 + r * 2;
      const radiusDeg = 0.006 * r * (0.7 + intensity * 0.6) * ruralScale;
      for (let s = 0; s < spokes; s++) {
        const jitter = (hash01(zone.id, r * 17 + s) - 0.5) * 0.004 * ruralScale;
        const angle =
          (s / spokes) * Math.PI * 2 + hash01(zone.id, r) * 0.4;
        const falloff = intensity * (1 - r / (rings + 1.2));
        points.push([
          lat + Math.cos(angle) * radiusDeg * 0.75 + jitter * 0.5,
          lng + Math.sin(angle) * radiusDeg + jitter,
          Math.max(0.05, falloff),
        ]);
      }
    }
  }

  return points;
}

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
  const onSelectRef = useRef(onSelectZone);
  const fitKeyRef = useRef('');
  const [hoveredZone, setHoveredZone] = useState<ZoneData | null>(null);
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  const [tehsilFilter, setTehsilFilter] = useState<TehsilFilter>('all');

  onSelectRef.current = onSelectZone;

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

  const heatPoints = useMemo(
    () => buildHeatPoints(filteredZones, overlay),
    [filteredZones, overlay]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: ISLAMABAD_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      heatRef.current = null;
      markersRef.current = null;
    };
  }, []);

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

    const gradient =
      overlay === 'vegetation'
        ? VEG_GRADIENT
        : overlay === 'cases'
          ? CASES_GRADIENT
          : overlay === 'terrain'
            ? TERRAIN_GRADIENT
            : HEAT_GRADIENT;

    const layer = L.heatLayer(heatPoints, {
      radius: 28,
      blur: 22,
      maxZoom: 17,
      max: 1,
      minOpacity: 0.35,
      gradient,
    });
    layer.addTo(map);
    heatRef.current = layer;
  }, [heatPoints, overlay]);

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
          radius: isSelected ? 10 : zone.areaType === 'rural' ? 8 : 7,
          color: isSelected ? '#EDE6D6' : '#14291F',
          weight: isSelected ? 3 : 2,
          fillColor: riskMarkerColor(zone.riskLevel),
          fillOpacity: 0.95,
        }
      );

      marker.bindTooltip(
        `<strong>${zone.name}</strong><br/>${zone.tehsil} · ${zone.areaType}<br/>Risk ${zone.riskScore}/100`,
        { direction: 'top', offset: [0, -8], opacity: 0.95 }
      );

      marker.on('click', () => onSelectRef.current(zone));
      marker.on('mouseover', () => setHoveredZone(zone));
      marker.on('mouseout', () =>
        setHoveredZone((prev) => (prev?.id === zone.id ? null : prev))
      );

      group.addLayer(marker);
    }

    const fitKey = `${filteredZones.map((z) => z.id).join(',')}|${fullscreen}`;
    if (filteredZones.length && fitKey !== fitKeyRef.current) {
      const bounds = L.latLngBounds(
        filteredZones.map(
          (z) => [z.coordinates.lat, z.coordinates.lng] as [number, number]
        )
      );
      map.fitBounds(bounds.pad(0.25), {
        animate: true,
        maxZoom: areaFilter === 'all' && tehsilFilter === 'all' ? 12 : 13,
      });
      fitKeyRef.current = fitKey;
    }
  }, [filteredZones, selectedZoneId, fullscreen, areaFilter, tehsilFilter]);

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
            ICT Risk Heatmap
          </h2>
          <span className="font-mono-data text-[10px] text-[#EDE6D6]/50">
            {filteredZones.length}/{zones.length} zones
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[#14291F] p-1 rounded-xs border border-[#2D5843]">
            {(
              [
                ['risk', 'Risk', 'bg-[#D9A441] text-[#23241F]'],
                ['vegetation', 'Canopy', 'bg-[#4C8C6B] text-white'],
                ['cases', 'Cases', 'bg-[#B5432A] text-white'],
                ['terrain', 'Terrain', 'bg-sky-700 text-white'],
              ] as const
            ).map(([key, label, activeClass]) => (
              <button
                key={key}
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-heading font-bold uppercase bg-[#14291F] border border-[#2D5843] text-[#EDE6D6] hover:border-[#D9A441] hover:text-[#D9A441] rounded-xs"
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen map'}
          >
            {fullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            {fullscreen ? 'Exit' : 'Full'}
          </button>
        </div>
      </div>

      <div className="bg-[#14291F] px-3 py-2 border-b border-[#2D5843] flex flex-wrap gap-2 items-center z-10">
        <span className="text-[10px] font-mono-data uppercase text-[#EDE6D6]/50 mr-1">
          District
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
            className={`px-2 py-1 text-[11px] font-heading font-bold rounded-xs border transition-colors ${
              areaFilter === key
                ? 'bg-[#D9A441] text-[#23241F] border-[#D9A441]'
                : 'bg-[#1F3D2E] text-[#EDE6D6]/80 border-[#2D5843] hover:border-[#D9A441]/60'
            }`}
          >
            {label}
          </button>
        ))}

        <span className="text-[#EDE6D6]/20 mx-1">|</span>
        <span className="text-[10px] font-mono-data uppercase text-[#EDE6D6]/50 mr-1">
          Tehsil
        </span>
        <button
          type="button"
          onClick={() => setTehsilFilter('all')}
          className={`px-2 py-1 text-[11px] font-heading font-bold rounded-xs border ${
            tehsilFilter === 'all'
              ? 'bg-[#4C8C6B] text-white border-[#4C8C6B]'
              : 'bg-[#1F3D2E] text-[#EDE6D6]/80 border-[#2D5843]'
          }`}
        >
          All
        </button>
        {tehsilOptions.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTehsilFilter(t);
              const sample = zones.find((z) => z.tehsil === t);
              if (sample) setAreaFilter(sample.areaType);
            }}
            className={`px-2 py-1 text-[11px] font-heading font-bold rounded-xs border ${
              tehsilFilter === t
                ? 'bg-[#4C8C6B] text-white border-[#4C8C6B]'
                : 'bg-[#1F3D2E] text-[#EDE6D6]/80 border-[#2D5843] hover:border-[#4C8C6B]/60'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={`relative flex-1 ${fullscreen ? 'min-h-0' : 'min-h-[420px]'}`}>
        <div ref={containerRef} className="absolute inset-0 z-0" />

        <div className="absolute bottom-3 left-3 bg-[#1F3D2E]/95 border border-[#2D5843] p-2.5 rounded-xs text-[11px] text-[#EDE6D6] shadow-lg z-[500] pointer-events-none">
          <div className="font-heading font-bold text-xs uppercase mb-1.5 border-b border-[#2D5843] pb-1 flex items-center justify-between gap-2">
            <span>
              {overlay === 'risk'
                ? 'Risk intensity'
                : overlay === 'vegetation'
                  ? 'Canopy (NDVI)'
                  : overlay === 'terrain'
                    ? 'Terrain (standing water)'
                    : 'Weekly cases'}
            </span>
            <Layers className="w-3 h-3 text-[#D9A441]" />
          </div>
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
              {hoveredZone.district} · {hoveredZone.tehsil}
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
                <span className="text-[#EDE6D6]/50">Rain </span>
                {hoveredZone.rainfallRecent}mm
              </div>
              <div className="col-span-2">
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
          <span>OpenStreetMap · urban + rural ICT</span>
        </div>
        <div>
          Selected:{' '}
          <strong className="text-white font-bold">{selectedName}</strong>
        </div>
      </div>
    </div>
  );
};
