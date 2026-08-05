/**
 * Refresh one zone's block cells with LIVE Open-Meteo weather + committed EE NDVI/LST.
 * Geometry comes from existing Supabase rows or generated fishnet.
 * Designed for chunked calls (one zone per request) so Vercel 60s limit is OK.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildIctGrid } from './gridMeta.js';
import { calculateRisk, scoreToRiskLevel } from './riskModel.js';
import { TERRAIN_DEPRESSIONS_SEED } from './terrainDepressions.seed.js';
import { ZONE_META } from './zoneMeta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function microrelief(lat: number, lng: number): number {
  const u =
    Math.sin(lat * 180.7) * Math.cos(lng * 97.3) +
    Math.sin((lat + lng) * 41.1) * 0.5;
  return clamp((u + 1.5) / 3, 0, 1);
}

function loadEe(): { ndvi: Record<string, number>; lst: Record<string, number> } {
  const p = join(__dirname, '..', 'data', 'ee_zone_ndvi_lst.json');
  if (!existsSync(p)) return { ndvi: {}, lst: {} };
  const j = JSON.parse(readFileSync(p, 'utf8')) as {
    ndvi?: Record<string, number>;
    lst?: Record<string, number>;
  };
  return { ndvi: j.ndvi ?? {}, lst: j.lst ?? {} };
}

async function fetchWeather(lat: number, lng: number) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m');
  url.searchParams.set('hourly', 'precipitation');
  url.searchParams.set('past_days', '2');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'Asia/Karachi');
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Open-Meteo ${res.status} for ${lat},${lng}`);
  }
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
    asOf: data.current.time,
  };
}

const depByZone = new Map<string, number>(
  TERRAIN_DEPRESSIONS_SEED.zones.map((z) => [z.zoneId, z.depressionRiskScore])
);

/**
 * Ensure fishnet geometry exists for one zone (chunk-safe for Vercel).
 * Scores are placeholders until refreshGridZone overwrites with live weather.
 */
export async function ensureZoneGeometry(
  supabase: SupabaseClient,
  zoneId: string
): Promise<{ inserted: number; total: number }> {
  const { count } = await supabase
    .from('grid_cells')
    .select('*', { count: 'exact', head: true })
    .eq('zone_id', zoneId);

  const { cells: all } = buildIctGrid();
  const cells = all.filter((c) => c.zoneId === zoneId);
  if (!cells.length) return { inserted: 0, total: 0 };
  if ((count ?? 0) >= cells.length * 0.85) {
    return { inserted: 0, total: count ?? 0 };
  }

  const now = new Date().toISOString();
  const ee = loadEe();
  const batchSize = 400;
  let inserted = 0;

  for (let i = 0; i < cells.length; i += batchSize) {
    const slice = cells.slice(i, i + batchSize);
    const rows = slice.map((c) => {
      const ndvi = ee.ndvi[c.zoneId] ?? 0.3;
      const lst = ee.lst[c.zoneId] ?? 38;
      return {
        cell_id: c.cellId,
        zone_id: c.zoneId,
        tehsil: c.tehsil,
        lat: c.lat,
        lng: c.lng,
        west: c.west,
        south: c.south,
        east: c.east,
        north: c.north,
        ndvi,
        lst,
        temperature: 29,
        humidity: 60,
        rainfall: 0,
        depression_score: depByZone.get(c.zoneId) ?? 20,
        building_density: c.areaType === 'urban' ? 0.5 : 0.3,
        population: 20,
        risk_score: 40,
        risk_level: 'medium' as const,
        people_at_risk: 800,
        computed_at: now,
        layer_meta: { seeded: true },
      };
    });
    const { error } = await supabase.from('grid_cells').upsert(rows, {
      onConflict: 'cell_id',
    });
    if (error) throw new Error(`grid seed upsert: ${error.message}`);
    inserted += rows.length;
  }
  return { inserted, total: cells.length };
}

export async function refreshGridZone(
  supabase: SupabaseClient,
  zoneId: string
): Promise<{
  zoneId: string;
  zoneName: string;
  cellsUpdated: number;
  weather: { temperature: number; humidity: number; rainfall: number; asOf: string };
}> {
  const meta = ZONE_META.find((z) => z.id === zoneId);
  if (!meta) throw new Error(`Unknown zone ${zoneId}`);

  await ensureZoneGeometry(supabase, zoneId);

  const wx = await fetchWeather(meta.coordinates.lat, meta.coordinates.lng);
  const ee = loadEe();
  const baseNdvi = ee.ndvi[zoneId] ?? 0.3;
  const lst = ee.lst[zoneId] ?? wx.temperature + 8;
  const lstVals = Object.values(ee.lst);
  const lstMean =
    lstVals.length > 0
      ? lstVals.reduce((a, b) => a + b, 0) / lstVals.length
      : lst;

  const { data: existing, error: selErr } = await supabase
    .from('grid_cells')
    .select('cell_id, lat, lng, west, south, east, north, tehsil')
    .eq('zone_id', zoneId);
  if (selErr) throw new Error(selErr.message);
  if (!existing?.length) {
    throw new Error(`No grid cells for ${zoneId} — geometry seed failed`);
  }

  const zoneDep = depByZone.get(zoneId) ?? 20;
  const maxD = meta.areaType === 'rural' ? 2200 : 1600;
  const now = new Date().toISOString();

  const rows = existing.map((c) => {
    const distM = haversineM(
      c.lat,
      c.lng,
      meta.coordinates.lat,
      meta.coordinates.lng
    );
    const edge = clamp(distM / maxD, 0, 1);
    const relief = microrelief(c.lat, c.lng);
    const dep = Math.round(clamp(zoneDep * (0.65 + relief * 0.7), 0, 100));
    const ndvi = clamp(
      baseNdvi * (0.85 + (1 - edge) * 0.2 + relief * 0.1),
      0,
      1
    );
    const airForRisk = clamp(wx.temperature + (lst - lstMean) * 0.4, 18, 36);
    const settle = clamp(
      (meta.areaType === 'urban' ? 0.5 : 0.28) +
        relief * 0.4 +
        (ndvi < 0.28 ? 0.18 : 0) +
        (ndvi > 0.42 ? -0.08 : 0) -
        edge * 0.12,
      0.08,
      0.92
    );
    const population = Math.round(settle * 40);
    const risk = calculateRisk({
      temperature: airForRisk,
      humidity: wx.humidity,
      vegetationIndex: ndvi,
      rainfallRecent: wx.rainfall,
      pastCases: [],
      depressionRiskScore: dep,
      settlementDensity: settle,
    });

    return {
      cell_id: c.cell_id,
      zone_id: zoneId,
      tehsil: c.tehsil ?? meta.tehsil,
      lat: c.lat,
      lng: c.lng,
      west: c.west,
      south: c.south,
      east: c.east,
      north: c.north,
      ndvi: Math.round(ndvi * 100) / 100,
      lst: Math.round(lst * 10) / 10,
      temperature: Math.round(airForRisk * 10) / 10,
      humidity: wx.humidity,
      rainfall: wx.rainfall,
      depression_score: dep,
      building_density: Math.round(settle * 100) / 100,
      population,
      risk_score: risk.riskScore,
      risk_level: scoreToRiskLevel(risk.riskScore),
      people_at_risk: Math.round(risk.riskScore * population),
      computed_at: now,
      layer_meta: {
        weatherAsOf: wx.asOf,
        ndviSource: 'ee_zone_ndvi_lst.json',
        lstSource: 'ee_landsat',
        demSource: 'terrain_depressions seed',
      },
    };
  });

  const batchSize = 400;
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await supabase
      .from('grid_cells')
      .upsert(rows.slice(i, i + batchSize), { onConflict: 'cell_id' });
    if (error) throw new Error(`upsert ${zoneId}: ${error.message}`);
  }

  return {
    zoneId,
    zoneName: meta.name,
    cellsUpdated: rows.length,
    weather: wx,
  };
}

export function listZoneIdsForRefresh(): string[] {
  return ZONE_META.map((z) => z.id);
}
