/**
 * Display aggregation: merge 50 m source cells into ~200 m blocks so the map
 * stays readable. Bounds stay on real lat/lng (not zone blobs).
 * Filters out empty / water-like cells (low settlement + low risk).
 */

import type { GridCellDto } from '../components/gridMapUtils';

/** Display block size in metres (source pack is 50 m). */
export const DISPLAY_BLOCK_M = 200;

function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/** Keep cells that look settled or already elevated risk — drop river/empty fringe. */
export function isDisplayWorthy(c: GridCellDto): boolean {
  if (c.settlementDensity < 0.14 && c.ndvi > 0.42 && c.riskScore < 50) {
    return false; // canopy / water fringe
  }
  if (c.settlementDensity < 0.16 && c.riskScore < 42) return false;
  return true;
}

/**
 * Snap fine cells into larger rectangles keyed by geographic grid.
 * Center lat/lng and west/south/east/north are exact from member geometry.
 */
export function aggregateToDisplayBlocks(
  cells: GridCellDto[],
  blockM = DISPLAY_BLOCK_M
): GridCellDto[] {
  const degLat = blockM / 111_320;
  const buckets = new Map<string, GridCellDto[]>();

  for (const c of cells) {
    if (!isDisplayWorthy(c)) continue;
    const degLng =
      blockM / (111_320 * Math.cos((c.lat * Math.PI) / 180));
    const r = Math.floor(c.lat / degLat);
    const k = Math.floor(c.lng / degLng);
    const key = `${r}_${k}`;
    const list = buckets.get(key);
    if (list) list.push(c);
    else buckets.set(key, [c]);
  }

  const out: GridCellDto[] = [];
  for (const [key, members] of buckets) {
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    let sumRisk = 0;
    let sumNdvi = 0;
    let sumSettle = 0;
    let sumDep = 0;
    let sumTemp = 0;
    let sumHum = 0;
    let sumRain = 0;
    let sumLst = 0;
    let sumPop = 0;
    let maxRisk = 0;
    const zoneCounts = new Map<string, number>();

    for (const m of members) {
      west = Math.min(west, m.west);
      south = Math.min(south, m.south);
      east = Math.max(east, m.east);
      north = Math.max(north, m.north);
      sumRisk += m.riskScore;
      maxRisk = Math.max(maxRisk, m.riskScore);
      sumNdvi += m.ndvi;
      sumSettle += m.settlementDensity;
      sumDep += m.depressionScore;
      sumTemp += m.temperature;
      sumHum += m.humidity;
      sumRain += m.rainfall;
      sumLst += m.lst ?? m.temperature;
      sumPop += m.population;
      zoneCounts.set(m.zoneId, (zoneCounts.get(m.zoneId) ?? 0) + 1);
    }

    const n = members.length;
    // Blend mean + max so hotspots stay visible after merge
    const score = Math.round(
      Math.min(100, Math.max(0, maxRisk * 0.55 + (sumRisk / n) * 0.45))
    );
    let zoneId = members[0].zoneId;
    let bestZ = 0;
    for (const [z, cnt] of zoneCounts) {
      if (cnt > bestZ) {
        bestZ = cnt;
        zoneId = z;
      }
    }
    const tehsil = members.find((m) => m.zoneId === zoneId)?.tehsil ?? '';
    const lat = (south + north) / 2;
    const lng = (west + east) / 2;
    const settle = sumSettle / n;
    const population = Math.round(sumPop / n);

    out.push({
      cellId: `blk_${blockM}m_${key}`,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      west: Math.round(west * 1e6) / 1e6,
      south: Math.round(south * 1e6) / 1e6,
      east: Math.round(east * 1e6) / 1e6,
      north: Math.round(north * 1e6) / 1e6,
      zoneId,
      tehsil,
      ndvi: Math.round((sumNdvi / n) * 100) / 100,
      lst: Math.round((sumLst / n) * 10) / 10,
      temperature: Math.round((sumTemp / n) * 10) / 10,
      humidity: Math.round(sumHum / n),
      rainfall: Math.round((sumRain / n) * 10) / 10,
      depressionScore: Math.round(sumDep / n),
      settlementDensity: Math.round(settle * 100) / 100,
      population,
      riskScore: score,
      riskLevel: riskLevel(score),
      peopleAtRisk: Math.round(score * population),
    });
  }

  return out;
}

/** Urban capital pilot bbox — main Islamabad sectors (not full rural ICT). */
export const CAPITAL_PILOT_BBOX = {
  west: 72.97,
  south: 33.66,
  east: 73.14,
  north: 33.76,
} as const;

export function filterCapitalPilot(cells: GridCellDto[]): GridCellDto[] {
  const b = CAPITAL_PILOT_BBOX;
  return cells.filter(
    (c) =>
      c.lng >= b.west &&
      c.lng <= b.east &&
      c.lat >= b.south &&
      c.lat <= b.north
  );
}
