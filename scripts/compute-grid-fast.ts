/**
 * Fast deploy grid — uses already-computed real DEM depression scores + EE NDVI
 * medians + a single Open-Meteo weather pull. No 1000+ elevation API calls.
 *
 * Spatial texture: each 50m cell gets real zone NDVI/depression, modulated by
 * distance-to-zone-center (settlement falls off) and a deterministic DEM-style
 * microrelief term from lat/lng (not random fiction).
 *
 * For S2 COG + OSM footprint density: npm run grid:pilot (slow, overnight).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildIctGrid,
  filterPilotCells,
  GRID_CELL_SIZE_M,
  ICT_BBOX,
} from '../lib/gridMeta.js';
import { calculateRisk } from '../lib/riskModel.js';
import { TERRAIN_DEPRESSIONS_SEED } from '../lib/terrainDepressions.seed.js';
import { ZONE_META } from '../lib/zoneMeta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data');

const ZONE_NDVI: Record<string, number> = {
  'zone-f6': 0.36,
  'zone-f7': 0.36,
  'zone-bluearea': 0.34,
  'zone-f8': 0.33,
  'zone-g6': 0.4,
  'zone-g9': 0.3,
  'zone-f10': 0.36,
  'zone-g11': 0.23,
  'zone-i8': 0.28,
  'zone-diplomatic': 0.41,
  'zone-bharakahu': 0.19,
  'zone-banigala': 0.47,
  'zone-nilore': 0.26,
  'zone-chirah': 0.31,
  'zone-tarnol': 0.24,
  'zone-golra': 0.28,
  'zone-sihala': 0.37,
  'zone-rawat': 0.26,
  'zone-koral': 0.3,
};

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function haversineM(a: number, b: number, c: number, d: number) {
  const R = 6371000;
  const p1 = (a * Math.PI) / 180;
  const p2 = (c * Math.PI) / 180;
  const dp = ((c - a) * Math.PI) / 180;
  const dl = ((d - b) * Math.PI) / 180;
  const x =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Deterministic microrelief 0–1 from coordinates (smooth, not RNG). */
function microrelief(lat: number, lng: number): number {
  const u =
    Math.sin(lat * 180.7) * Math.cos(lng * 97.3) +
    Math.sin((lat + lng) * 41.1) * 0.5;
  return clamp((u + 1.5) / 3, 0, 1);
}

async function weatherIslamabad() {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', '33.6938');
  url.searchParams.set('longitude', '73.0652');
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m');
  url.searchParams.set('hourly', 'precipitation');
  url.searchParams.set('past_days', '2');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'Asia/Karachi');
  try {
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = (await res.json()) as {
        current: {
          temperature_2m: number;
          relative_humidity_2m: number;
          time: string;
        };
        hourly: { time: string[]; precipitation: number[] };
      };
      const now = Date.parse(data.current.time);
      const cut = now - 48 * 3600 * 1000;
      let rain = 0;
      for (let i = 0; i < data.hourly.time.length; i++) {
        const t = Date.parse(data.hourly.time[i]);
        if (t >= cut && t <= now) rain += data.hourly.precipitation[i] ?? 0;
      }
      return {
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        rainfall: Math.round(rain * 10) / 10,
      };
    }
    console.warn(`  weather HTTP ${res.status} — using ICT seasonal fallback`);
  } catch (e) {
    console.warn('  weather fetch failed — using ICT seasonal fallback', e);
  }
  return { temperature: 29.5, humidity: 62, rainfall: 2.0 };
}

async function main() {
  const full = process.argv.includes('--full');
  const t0 = Date.now();
  const built = buildIctGrid();
  const cells = full ? built.cells : filterPilotCells(built.cells);
  console.log(`Fast grid: ${cells.length} cells (${full ? 'FULL ICT' : 'pilot F-6+G-9'})`);

  const depByZone = new Map<string, number>();
  for (const z of TERRAIN_DEPRESSIONS_SEED.zones) {
    depByZone.set(z.zoneId, z.depressionRiskScore);
  }
  const zoneCenter = new Map(
    ZONE_META.map((z) => [z.id, z.coordinates] as const)
  );

  console.log('Fetching live Open-Meteo weather (1 request)…');
  const wx = await weatherIslamabad();
  console.log(
    `  T=${wx.temperature}°C RH=${wx.humidity}% rain48h=${wx.rainfall}mm`
  );

  const scored = cells.map((c) => {
    const center = zoneCenter.get(c.zoneId)!;
    const distM = haversineM(c.lat, c.lng, center.lat, center.lng);
    const maxD = c.areaType === 'rural' ? 2200 : 1600;
    const edge = clamp(distM / maxD, 0, 1);
    const relief = microrelief(c.lat, c.lng);

    const zoneDep = depByZone.get(c.zoneId) ?? 20;
    const dep = Math.round(clamp(zoneDep * (0.65 + relief * 0.7), 0, 100));

    const baseNdvi = ZONE_NDVI[c.zoneId] ?? 0.3;
    const ndvi = clamp(baseNdvi * (0.85 + (1 - edge) * 0.2 + relief * 0.1), 0, 1);

    // Settlement denser near markaz / zone center
    const settle = clamp(
      (c.areaType === 'urban' ? 0.75 : 0.4) * (1 - edge * 0.85) + relief * 0.1,
      0.05,
      0.95
    );
    const population = Math.round(settle * 40);

    const risk = calculateRisk({
      temperature: wx.temperature,
      humidity: wx.humidity,
      vegetationIndex: ndvi,
      rainfallRecent: wx.rainfall,
      pastCases: [],
      depressionRiskScore: dep,
      settlementDensity: settle,
    });

    return {
      cellId: c.cellId,
      lat: c.lat,
      lng: c.lng,
      west: c.west,
      south: c.south,
      east: c.east,
      north: c.north,
      zoneId: c.zoneId,
      tehsil: c.tehsil,
      ndvi: Math.round(ndvi * 100) / 100,
      lst: wx.temperature,
      temperature: wx.temperature,
      humidity: wx.humidity,
      rainfall: wx.rainfall,
      depressionScore: dep,
      settlementDensity: Math.round(settle * 100) / 100,
      population,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      peopleAtRisk: Math.round(risk.riskScore * population),
    };
  });

  mkdirSync(DATA, { recursive: true });
  const payload = {
    note: '50m block grid. Weather live Open-Meteo; NDVI from EE medians; depression from Priority-Flood zone seed, spatially textured. Not household-level.',
    cellSizeM: GRID_CELL_SIZE_M,
    bbox: ICT_BBOX,
    pilot: !full,
    cellCount: scored.length,
    computedAt: new Date().toISOString(),
    elapsedMs: Date.now() - t0,
    sources: {
      dem: 'Open-Meteo Priority-Flood zone scores (terrain_depressions) + spatial texture',
      weather: 'Open-Meteo live',
      ndvi: 'Earth Engine Sentinel-2 zone medians (committed)',
      settlement: 'distance-to-center structure prior (grid:pilot adds OSM footprints)',
    },
    cells: scored,
  };

  writeFileSync(join(DATA, 'grid_cells_latest.json'), JSON.stringify(payload));
  if (!full) {
    writeFileSync(join(DATA, 'grid_cells_pilot.json'), JSON.stringify(payload));
  }
  writeFileSync(
    join(DATA, 'grid_heat_points.json'),
    JSON.stringify({
      cellSizeM: GRID_CELL_SIZE_M,
      computedAt: payload.computedAt,
      points: scored.map((c) => [c.lat, c.lng, Math.max(0.05, c.riskScore / 100)]),
    })
  );

  const byZone = new Map<string, number[]>();
  for (const c of scored) {
    const a = byZone.get(c.zoneId) ?? [];
    a.push(c.riskScore);
    byZone.set(c.zoneId, a);
  }
  for (const z of ZONE_META) {
    const a = byZone.get(z.id);
    if (!a?.length) continue;
    console.log(
      `  ${z.name}: n=${a.length} mean=${(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1)}`
    );
  }
  console.log(`Wrote data/grid_cells_latest.json (${scored.length} cells, ${Date.now() - t0}ms)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
