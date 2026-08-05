/**
 * Display aggregation: merge 50 m source cells into a non-overlapping ~200 m
 * fishnet. Each block uses snap-grid bounds (not min/max of members) so tiles
 * never overlap — overlapping fills were causing dark/light patches.
 */

import type { GridCellDto } from '../components/gridMapUtils';

/** Display block size in metres (source pack is 50 m). */
export const DISPLAY_BLOCK_M = 200;

/** Fixed reference latitude for ICT so lng degrees/metre stay consistent. */
const ICT_REF_LAT = 33.70;

function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function displayGridStep(blockM = DISPLAY_BLOCK_M): {
  degLat: number;
  degLng: number;
} {
  const degLat = blockM / 111_320;
  const degLng =
    blockM / (111_320 * Math.cos((ICT_REF_LAT * Math.PI) / 180));
  return { degLat, degLng };
}

/**
 * Keep cells worth showing. Parks / green belts (high vegetation) and terrain
 * sinks (standing-water risk) stay even when settlement is low — those used
 * to be dropped and made parks look empty/low-risk on the map.
 */
export function isDisplayWorthy(c: GridCellDto): boolean {
  const parkOrGreen = c.ndvi >= 0.32;
  const sink = c.depressionScore >= 22;
  if (parkOrGreen || sink) return true;
  if (c.settlementDensity < 0.16 && c.riskScore < 42) return false;
  if (c.settlementDensity < 0.12 && c.ndvi < 0.2 && c.riskScore < 48) {
    return false; // bare empty fringe only
  }
  return true;
}

/**
 * Snap fine cells into a regular fishnet. Bounds = exact tile edges (WGS84).
 * Center lat/lng = geometric center of that tile (pasteable into Google Maps).
 */
export function aggregateToDisplayBlocks(
  cells: GridCellDto[],
  blockM = DISPLAY_BLOCK_M
): GridCellDto[] {
  const { degLat, degLng } = displayGridStep(blockM);
  const buckets = new Map<string, { r: number; k: number; members: GridCellDto[] }>();

  for (const c of cells) {
    if (!isDisplayWorthy(c)) continue;
    // Bucket by cell center so assignment is stable
    const r = Math.floor(c.lat / degLat);
    const k = Math.floor(c.lng / degLng);
    const key = `${r}_${k}`;
    const cur = buckets.get(key);
    if (cur) cur.members.push(c);
    else buckets.set(key, { r, k, members: [c] });
  }

  const out: GridCellDto[] = [];
  for (const [key, { r, k, members }] of buckets) {
    // Exact non-overlapping tile (do NOT union member extents)
    const south = r * degLat;
    const north = (r + 1) * degLat;
    const west = k * degLng;
    const east = (k + 1) * degLng;
    const lat = (south + north) / 2;
    const lng = (west + east) / 2;

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
    const settle = sumSettle / n;
    const population = Math.round(sumPop / n);

    out.push({
      cellId: `blk_${blockM}m_${key}`,
      lat: Math.round(lat * 1e7) / 1e7,
      lng: Math.round(lng * 1e7) / 1e7,
      west: Math.round(west * 1e7) / 1e7,
      south: Math.round(south * 1e7) / 1e7,
      east: Math.round(east * 1e7) / 1e7,
      north: Math.round(north * 1e7) / 1e7,
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
