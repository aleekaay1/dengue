/**
 * Load block grid cells from Supabase (cached real scores).
 * Falls back to filesystem pack when Supabase is empty / unconfigured.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { GRID_CELL_SIZE_M } from '../gridMeta.js';
import type { GridBundle, GridCell } from './gridCells.js';

type DbRow = {
  cell_id: string;
  zone_id: string | null;
  tehsil: string | null;
  lat: number;
  lng: number;
  west: number;
  south: number;
  east: number;
  north: number;
  ndvi: number | null;
  lst: number | null;
  temperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  depression_score: number | null;
  building_density: number | null;
  population: number | null;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  people_at_risk: number | null;
  computed_at: string;
};

function rowToCell(r: DbRow): GridCell {
  return {
    cellId: r.cell_id,
    zoneId: r.zone_id ?? 'unknown',
    tehsil: r.tehsil ?? '',
    lat: r.lat,
    lng: r.lng,
    west: r.west,
    south: r.south,
    east: r.east,
    north: r.north,
    ndvi: r.ndvi ?? 0.3,
    lst: r.lst ?? 35,
    temperature: r.temperature ?? 29,
    humidity: r.humidity ?? 60,
    rainfall: r.rainfall ?? 0,
    depressionScore: r.depression_score ?? 0,
    settlementDensity: r.building_density ?? 0.3,
    population: r.population ?? 0,
    riskScore: r.risk_score,
    riskLevel: r.risk_level,
    peopleAtRisk: r.people_at_risk ?? 0,
  };
}

export async function countGridCells(
  supabase: SupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from('grid_cells')
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function gridSummaryFromSupabase(
  supabase: SupabaseClient
): Promise<{
  cellCount: number;
  computedAt: string | null;
  cellSizeM: number;
}> {
  const cellCount = await countGridCells(supabase);
  if (cellCount === 0) {
    return { cellCount: 0, computedAt: null, cellSizeM: GRID_CELL_SIZE_M };
  }
  const { data } = await supabase
    .from('grid_cells')
    .select('computed_at')
    .order('computed_at', { ascending: false })
    .limit(1);
  return {
    cellCount,
    computedAt: data?.[0]?.computed_at ?? null,
    cellSizeM: GRID_CELL_SIZE_M,
  };
}

export async function cellsInBboxFromSupabase(
  supabase: SupabaseClient,
  bbox: { west: number; south: number; east: number; north: number },
  limit: number
): Promise<{ cells: GridCell[]; computedAt: string | null }> {
  // Center-point filter — index-friendly enough for ICT viewport queries
  let q = supabase
    .from('grid_cells')
    .select(
      'cell_id,zone_id,tehsil,lat,lng,west,south,east,north,ndvi,lst,temperature,humidity,rainfall,depression_score,building_density,population,risk_score,risk_level,people_at_risk,computed_at'
    )
    .gte('lat', bbox.south)
    .lte('lat', bbox.north)
    .gte('lng', bbox.west)
    .lte('lng', bbox.east)
    .order('risk_score', { ascending: false })
    .limit(Math.min(limit, 10000));

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DbRow[];
  let computedAt: string | null = null;
  for (const r of rows) {
    if (!computedAt || r.computed_at > computedAt) computedAt = r.computed_at;
  }
  return { cells: rows.map(rowToCell), computedAt };
}

export async function nearestCellFromSupabase(
  supabase: SupabaseClient,
  lat: number,
  lng: number
): Promise<GridCell | null> {
  const pad = 0.002;
  const { cells } = await cellsInBboxFromSupabase(
    supabase,
    {
      west: lng - pad,
      south: lat - pad,
      east: lng + pad,
      north: lat + pad,
    },
    40
  );
  if (!cells.length) return null;
  let best = cells[0];
  let bestD = Infinity;
  for (const c of cells) {
    if (lat >= c.south && lat < c.north && lng >= c.west && lng < c.east) {
      return c;
    }
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export async function heatPointsFromSupabase(
  supabase: SupabaseClient,
  maxPoints = 12000
): Promise<{
  points: [number, number, number][];
  computedAt: string | null;
  count: number;
}> {
  const total = await countGridCells(supabase);
  if (total === 0) {
    return { points: [], computedAt: null, count: 0 };
  }
  // Sample by risk so hotspots remain visible
  const { data, error } = await supabase
    .from('grid_cells')
    .select('lat,lng,risk_score,computed_at')
    .order('risk_score', { ascending: false })
    .limit(maxPoints);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  let computedAt: string | null = null;
  const points: [number, number, number][] = [];
  for (const r of rows) {
    if (!computedAt || r.computed_at > computedAt) computedAt = r.computed_at;
    points.push([
      r.lat,
      r.lng,
      Math.max(0.12, Math.min(1, (r.risk_score / 100) * 1.25)),
    ]);
  }
  // Thin further for overview soft heat
  const step = Math.max(1, Math.ceil(points.length / 8000));
  return {
    points: points.filter((_, i) => i % step === 0),
    computedAt,
    count: total,
  };
}

export type { GridBundle };
