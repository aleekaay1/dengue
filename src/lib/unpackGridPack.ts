/** Client-side unpack of public/grid_cells_pack.json (no serverless). */

import type { GridCellDto } from '../components/gridMapUtils';
import { ZONE_META } from '../../lib/zoneMeta';

const TEHSIL = new Map(ZONE_META.map((z) => [z.id, z.tehsil]));

function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export interface GridPackFile {
  cellSizeM?: number;
  cellCount?: number;
  computedAt?: string;
  zoneIds?: string[];
  cells: unknown[];
}

export function unpackGridPack(raw: GridPackFile): {
  cellSizeM: number;
  computedAt: string | null;
  cells: GridCellDto[];
} {
  const zoneIds = raw.zoneIds ?? [];
  const cells: GridCellDto[] = [];

  for (let i = 0; i < raw.cells.length; i++) {
    const row = raw.cells[i];
    if (!Array.isArray(row)) {
      cells.push(row as GridCellDto);
      continue;
    }
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
    const population = pop ?? 0;
    const riskScore = risk ?? 0;
    cells.push({
      cellId: `ict_${raw.cellSizeM ?? 50}m_${i}`,
      lat,
      lng,
      west,
      south,
      east,
      north,
      zoneId,
      tehsil: TEHSIL.get(zoneId) ?? '',
      ndvi: (ndvi100 ?? 30) / 100,
      lst: (lst10 ?? temp10 ?? 350) / 10,
      temperature: (temp10 ?? 295) / 10,
      humidity: hum ?? 60,
      rainfall: (rain10 ?? 0) / 10,
      depressionScore: dep ?? 0,
      settlementDensity: (settle100 ?? 30) / 100,
      population,
      riskScore,
      riskLevel: riskLevel(riskScore),
      peopleAtRisk: Math.round(riskScore * population),
    });
  }

  return {
    cellSizeM: raw.cellSizeM ?? 50,
    computedAt: raw.computedAt ?? null,
    cells,
  };
}

export function cellsInView(
  cells: GridCellDto[],
  bounds: { west: number; south: number; east: number; north: number },
  zoneIds?: Set<string>
): GridCellDto[] {
  return cells.filter((c) => {
    if (zoneIds && !zoneIds.has(c.zoneId)) return false;
    return (
      c.lng >= bounds.west &&
      c.lng <= bounds.east &&
      c.lat >= bounds.south &&
      c.lat <= bounds.north
    );
  });
}
