/**
 * Block-level grid risk loader.
 * Reads offline batch output (data/grid_cells_latest.json) — never computes on request.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRID_CELL_SIZE_M } from '../gridMeta.js';
import { ZONE_META } from '../zoneMeta.js';

const TEHSIL_BY_ZONE = new Map(ZONE_META.map((z) => [z.id, z.tehsil]));

export interface GridCell {
  cellId: string;
  lat: number;
  lng: number;
  west: number;
  south: number;
  east: number;
  north: number;
  zoneId: string;
  tehsil: string;
  ndvi: number;
  lst: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  depressionScore: number;
  settlementDensity: number;
  population: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  peopleAtRisk: number;
}

export interface GridBundle {
  cellSizeM: number;
  cellCount: number;
  computedAt: string | null;
  pilot: boolean;
  sources: Record<string, string | null | undefined>;
  cells: GridCell[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const LATEST = join(__dirname, '..', '..', 'data', 'grid_cells_latest.json');

let cached: GridBundle | null = null;

function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function unpack(raw: {
  cellSizeM?: number;
  cellCount?: number;
  computedAt?: string;
  pilot?: boolean;
  sources?: Record<string, string>;
  zoneIds?: string[];
  cells: unknown[];
}): GridBundle {
  const zoneIds = raw.zoneIds ?? [];
  const cells: GridCell[] = [];

  for (let i = 0; i < raw.cells.length; i++) {
    const row = raw.cells[i];
    if (Array.isArray(row)) {
      const [
        lat,
        lng,
        west,
        south,
        east,
        north,
        zIdx,
        ndvi100,
        dep,
        settle100,
        risk,
        pop,
        temp10,
        hum,
        rain10,
        lst10,
      ] = row as number[];
      const zoneId = zoneIds[zIdx] ?? 'unknown';
      const riskScore = risk;
      const population = pop;
      const temperature = (temp10 ?? 295) / 10;
      const humidity = hum ?? 60;
      const rainfall = (rain10 ?? 0) / 10;
      const lst = (lst10 ?? temp10 ?? 350) / 10;
      cells.push({
        cellId: `ict_${raw.cellSizeM ?? 50}m_${i}`,
        lat,
        lng,
        west,
        south,
        east,
        north,
        zoneId,
        tehsil: TEHSIL_BY_ZONE.get(zoneId) ?? '',
        ndvi: ndvi100 / 100,
        lst,
        temperature,
        humidity,
        rainfall,
        depressionScore: dep,
        settlementDensity: settle100 / 100,
        population,
        riskScore,
        riskLevel: riskLevel(riskScore),
        peopleAtRisk: Math.round(riskScore * population),
      });
    } else {
      cells.push(row as GridCell);
    }
  }

  return {
    cellSizeM: raw.cellSizeM ?? GRID_CELL_SIZE_M,
    cellCount: cells.length,
    computedAt: raw.computedAt ?? null,
    pilot: Boolean(raw.pilot),
    sources: raw.sources ?? {},
    cells,
  };
}

export function loadGridCells(): GridBundle {
  if (cached) return cached;
  if (!existsSync(LATEST)) {
    return {
      cellSizeM: GRID_CELL_SIZE_M,
      cellCount: 0,
      computedAt: null,
      pilot: true,
      sources: {},
      cells: [],
    };
  }
  cached = unpack(JSON.parse(readFileSync(LATEST, 'utf8')));
  return cached;
}

export function clearGridCache() {
  cached = null;
}

export function cellsInBbox(
  cells: GridCell[],
  bbox: { west: number; south: number; east: number; north: number }
): GridCell[] {
  return cells.filter(
    (c) =>
      c.lng >= bbox.west &&
      c.lng <= bbox.east &&
      c.lat >= bbox.south &&
      c.lat <= bbox.north
  );
}

export function nearestCell(
  cells: GridCell[],
  lat: number,
  lng: number
): GridCell | null {
  let best: GridCell | null = null;
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

export function aggregateZonesFromGrid(cells: GridCell[]): Map<
  string,
  {
    meanRisk: number;
    maxRisk: number;
    meanNdvi: number;
    meanSettlement: number;
    totalPeopleAtRisk: number;
    cellCount: number;
  }
> {
  const map = new Map<
    string,
    {
      sumRisk: number;
      maxRisk: number;
      sumNdvi: number;
      sumSettle: number;
      people: number;
      n: number;
    }
  >();
  for (const c of cells) {
    const cur = map.get(c.zoneId) ?? {
      sumRisk: 0,
      maxRisk: 0,
      sumNdvi: 0,
      sumSettle: 0,
      people: 0,
      n: 0,
    };
    cur.sumRisk += c.riskScore;
    cur.maxRisk = Math.max(cur.maxRisk, c.riskScore);
    cur.sumNdvi += c.ndvi;
    cur.sumSettle += c.settlementDensity;
    cur.people += c.peopleAtRisk;
    cur.n += 1;
    map.set(c.zoneId, cur);
  }
  const out = new Map<
    string,
    {
      meanRisk: number;
      maxRisk: number;
      meanNdvi: number;
      meanSettlement: number;
      totalPeopleAtRisk: number;
      cellCount: number;
    }
  >();
  for (const [id, v] of map) {
    out.set(id, {
      meanRisk: Math.round(v.sumRisk / v.n),
      maxRisk: v.maxRisk,
      meanNdvi: Math.round((v.sumNdvi / v.n) * 100) / 100,
      meanSettlement: Math.round((v.sumSettle / v.n) * 100) / 100,
      totalPeopleAtRisk: v.people,
      cellCount: v.n,
    });
  }
  return out;
}
