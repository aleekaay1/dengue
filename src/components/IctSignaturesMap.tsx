import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import {
  aggregateToDisplayBlocks,
  CAPITAL_PILOT_BBOX,
  filterCapitalPilot,
} from '../lib/aggregateBlocks';
import { unpackGridPack, type GridPackFile } from '../lib/unpackGridPack';
import { Layers } from 'lucide-react';

const CENTER: L.LatLngExpression = [33.71, 73.06];
const GRADIENT: Record<string, string> = {
  0.2: '#3b82f6',
  0.4: '#22c55e',
  0.55: '#eab308',
  0.75: '#f97316',
  1.0: '#dc2626',
};

/**
 * Clean ICT capital-territory risk signatures — no zone markers, no block lattice.
 * Soft heat from real aggregated cell scores inside the urban pilot bbox.
 */
export const IctSignaturesMap: React.FC<{ gridEpoch?: number }> = ({
  gridEpoch = 0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatRef = useRef<L.HeatLayer | null>(null);
  const [points, setPoints] = useState<[number, number, number][]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading');
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setStatus('loading');
      try {
        const res = await fetch(
          `/grid_cells_pack.json?v=${encodeURIComponent(String(gridEpoch))}&sig=1`
        );
        if (!res.ok) {
          if (!cancelled) setStatus('empty');
          return;
        }
        const raw = (await res.json()) as GridPackFile;
        const { cells, computedAt } = unpackGridPack(raw);
        const pilot = filterCapitalPilot(cells);
        const blocks = aggregateToDisplayBlocks(pilot);
        // Signatures: medium+ risk only, soft intensity
        const pts: [number, number, number][] = blocks
          .filter((c) => c.riskScore >= 40)
          .map((c) => [
            c.lat,
            c.lng,
            Math.min(1, Math.max(0.28, (c.riskScore / 100) * 1.15)),
          ]);
        if (!cancelled) {
          setPoints(pts);
          setAsOf(computedAt);
          setStatus(pts.length ? 'ready' : 'empty');
        }
      } catch {
        if (!cancelled) setStatus('empty');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gridEpoch]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const b = CAPITAL_PILOT_BBOX;
    const map = L.map(containerRef.current, {
      center: CENTER,
      zoom: 13,
      zoomControl: true,
      maxZoom: 17,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; OpenStreetMap · ICT capital risk signatures (pilot)',
    }).addTo(map);
    map.fitBounds(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      { padding: [24, 24], maxZoom: 13 }
    );
    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
      heatRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }
    if (!points.length) return;
    const layer = L.heatLayer(points, {
      radius: 36,
      blur: 32,
      maxZoom: 16,
      max: 1,
      minOpacity: 0.35,
      gradient: GRADIENT,
    });
    layer.addTo(map);
    heatRef.current = layer;
  }, [points]);

  const countLabel = useMemo(() => {
    if (status === 'loading') return 'Loading signatures…';
    if (status === 'empty') return 'No signature points';
    return `${points.length.toLocaleString()} risk signatures · capital pilot`;
  }, [status, points.length]);

  return (
    <div className="bg-[#14291F] border-2 border-[#2D5843] rounded-xs shadow-md overflow-hidden flex flex-col min-h-[560px] h-[min(72vh,720px)]">
      <div className="bg-[#1F3D2E] p-3 border-b border-[#2D5843] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading font-extrabold text-sm uppercase tracking-wide text-[#EDE6D6]">
            ICT Capital Territory — Risk signatures
          </h2>
          <p className="font-mono-data text-[10px] text-[#EDE6D6]/55 mt-0.5">
            Clean map · no zones · no block grid · urban pilot only
          </p>
        </div>
        <span className="font-mono-data text-[10px] text-[#D9A441]">
          {countLabel}
          {asOf ? ` · ${asOf.slice(0, 10)}` : ''}
        </span>
      </div>

      <div className="relative flex-1 min-h-[420px]">
        <div ref={containerRef} className="absolute inset-0 z-0" />
        <div className="absolute bottom-3 left-3 bg-[#1F3D2E]/95 border border-[#2D5843] p-2.5 rounded-xs text-[11px] text-[#EDE6D6] z-[500] pointer-events-none max-w-[220px]">
          <div className="font-heading font-bold text-xs uppercase mb-1 flex items-center justify-between gap-2">
            <span>Activity signature</span>
            <Layers className="w-3 h-3 text-[#D9A441]" />
          </div>
          <p className="text-[10px] text-[#EDE6D6]/65 mb-1.5 leading-snug">
            Soft heat from real block scores (medium+). Not tied to zone
            polygons.
          </p>
          <div className="h-2 w-36 rounded-xs mb-1 bg-gradient-to-r from-blue-500 via-yellow-400 to-red-600" />
          <div className="flex justify-between font-mono-data text-[10px] text-[#EDE6D6]/60">
            <span>Lower</span>
            <span>Higher</span>
          </div>
        </div>
      </div>
    </div>
  );
};
