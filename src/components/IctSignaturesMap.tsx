import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CAPITAL_PILOT_BBOX, filterCapitalPilot } from '../lib/aggregateBlocks';
import {
  extractRiskPeaks,
  signatureColor,
} from '../lib/riskSignatures';
import { unpackGridPack, type GridPackFile } from '../lib/unpackGridPack';
import type { GridCellDto } from './gridMapUtils';
import { Layers } from 'lucide-react';

const CENTER: L.LatLngExpression = [33.71, 73.06];

/**
 * Capital-territory risk signatures — discrete peaks only.
 * Uses exact 50 m cell lat/lng from the scored pack (Open-Meteo + EE NDVI/LST).
 * No heat lattice, no zone markers, no invented points.
 */
export const IctSignaturesMap: React.FC<{ gridEpoch?: number }> = ({
  gridEpoch = 0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [peaks, setPeaks] = useState<GridCellDto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading');
  const [asOf, setAsOf] = useState<string | null>(null);
  const [scanned, setScanned] = useState(0);
  const [threshold, setThreshold] = useState<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setStatus('loading');
      try {
        const res = await fetch(
          `/grid_cells_pack.json?v=${encodeURIComponent(String(gridEpoch))}&sig=3`
        );
        if (!res.ok) {
          if (!cancelled) setStatus('empty');
          return;
        }
        const raw = (await res.json()) as GridPackFile;
        const { cells, computedAt } = unpackGridPack(raw);
        const pilot = filterCapitalPilot(cells);
        // Adaptive: capital pack currently tops ~48 — absolute 52 matched nothing
        const found = extractRiskPeaks(pilot, {
          minScore: 40,
          minSettlement: 0.12,
          minSeparationM: 200,
          maxPeaks: 90,
          scorePercentile: 0.88,
        });
        if (!cancelled) {
          setPeaks(found.peaks);
          setScanned(pilot.length);
          setAsOf(computedAt);
          setThreshold({ min: found.minScore, max: found.maxScore });
          setStatus(found.peaks.length ? 'ready' : 'empty');
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
        '&copy; OpenStreetMap · real elevated-risk cell peaks (not a heat lattice)',
    }).addTo(map);
    map.fitBounds(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      { padding: [24, 24], maxZoom: 13 }
    );
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();

    for (const c of peaks) {
      const color = signatureColor(c.riskScore, threshold.max || 100);
      const rel = threshold.max
        ? c.riskScore / threshold.max
        : c.riskScore / 100;
      const radius = rel >= 0.95 ? 9 : rel >= 0.9 ? 7 : 6;
      const marker = L.circleMarker([c.lat, c.lng], {
        radius,
        color: '#1a1d21',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.88,
      });
      marker.bindPopup(
        `<div style="font:12px/1.4 system-ui,sans-serif;min-width:180px">
          <strong>Higher-risk peak</strong><br/>
          Score <b>${c.riskScore}</b>/100 · ${c.riskLevel}<br/>
          <span style="opacity:.75">${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}</span><br/>
          Vegetation ${c.ndvi.toFixed(2)} · built-up ${Math.round(c.settlementDensity * 100)}%<br/>
          Temp ${c.temperature.toFixed(1)}°C · humidity ${c.humidity}%
          <div style="margin-top:6px;font-size:10px;opacity:.7">
            Exact 50m cell from scored pack (top of local score range ${threshold.min}–${threshold.max}).
          </div>
        </div>`,
        { maxWidth: 280 }
      );
      group.addLayer(marker);
    }
  }, [peaks, threshold.max, threshold.min]);

  const countLabel = useMemo(() => {
    if (status === 'loading') return 'Scanning scored cells…';
    if (status === 'empty')
      return 'No peaks found in capital pilot cells';
    return `${peaks.length} peaks · scores ≥ ${threshold.min} (max ${threshold.max}) · ${scanned.toLocaleString()} cells`;
  }, [status, peaks.length, scanned, threshold]);

  return (
    <div className="bg-[#14291F] border-2 border-[#2D5843] rounded-xs shadow-md overflow-hidden flex flex-col min-h-[560px] h-[min(72vh,720px)]">
      <div className="bg-[#1F3D2E] p-3 border-b border-[#2D5843] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading font-extrabold text-sm uppercase tracking-wide text-[#EDE6D6]">
            ICT Capital Territory — Risk signatures
          </h2>
          <p className="font-mono-data text-[10px] text-[#EDE6D6]/55 mt-0.5">
            Real cell peaks only · no heat lattice · no invented marks
          </p>
        </div>
        <span className="font-mono-data text-[10px] text-[#D9A441]">
          {countLabel}
          {asOf ? ` · ${asOf.slice(0, 10)}` : ''}
        </span>
      </div>

      <div className="relative flex-1 min-h-[420px]">
        <div ref={containerRef} className="absolute inset-0 z-0" />
        <div className="absolute bottom-3 left-3 bg-[#1F3D2E]/95 border border-[#2D5843] p-2.5 rounded-xs text-[11px] text-[#EDE6D6] z-[500] pointer-events-none max-w-[240px]">
          <div className="font-heading font-bold text-xs uppercase mb-1 flex items-center justify-between gap-2">
            <span>Elevated peaks</span>
            <Layers className="w-3 h-3 text-[#D9A441]" />
          </div>
          <p className="text-[10px] text-[#EDE6D6]/70 mb-1.5 leading-snug">
            Each dot is a real 50 m cell among the highest scores in this area
            (local maximum). Threshold follows the data — not a fixed 70/100.
          </p>
          <div className="flex gap-3 font-mono-data text-[10px]">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-[#D9A441] mr-1" />
              med
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-[#D97706] mr-1" />
              high
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-[#B5432A] mr-1" />
              severe
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
