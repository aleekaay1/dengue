/**
 * ICT block-level risk grid metadata (50 m cells).
 *
 * Cells are the unit of environmental risk. Zone views aggregate contained cells.
 * Framing: "block / grid cell" — never household or home-level.
 */

import { ZONE_META, type ZoneMeta } from './zoneMeta.js';

/** Locked cell size — ~50 m supports street-zoom rectangles; 100 m would blur blocks. */
export const GRID_CELL_SIZE_M = 50;

/** ICT analysis bbox [west, south, east, north] — covers monitored urban + rural tehsils */
export const ICT_BBOX = {
  west: 72.85,
  south: 33.45,
  east: 73.28,
  north: 33.80,
} as const;

/** Include a cell if within this distance of a zone center (keeps full-city run tractable). */
export const ZONE_INFLUENCE_M = {
  urban: 1600,
  rural: 2200,
} as const;

export interface GridCellMeta {
  cellId: string;
  row: number;
  col: number;
  lat: number;
  lng: number;
  west: number;
  south: number;
  east: number;
  north: number;
  zoneId: string;
  tehsil: string;
  areaType: 'urban' | 'rural';
}

function metersToDegLat(m: number): number {
  return m / 111_320;
}

function metersToDegLng(m: number, lat: number): number {
  return m / (111_320 * Math.cos((lat * Math.PI) / 180));
}

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestZone(lat: number, lng: number): {
  zone: ZoneMeta;
  distM: number;
} {
  let best = ZONE_META[0];
  let bestD = Infinity;
  for (const z of ZONE_META) {
    const d = haversineM(lat, lng, z.coordinates.lat, z.coordinates.lng);
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return { zone: best, distM: bestD };
}

/**
 * Build the ICT fishnet. Returns only cells inside a zone influence radius
 * so we cover monitored ICT without storing empty mountain/desert fringes.
 */
export function buildIctGrid(options?: {
  cellSizeM?: number;
  bbox?: typeof ICT_BBOX;
}): { cells: GridCellMeta[]; cellSizeM: number; count: number } {
  const cellSizeM = options?.cellSizeM ?? GRID_CELL_SIZE_M;
  const bbox = options?.bbox ?? ICT_BBOX;
  const midLat = (bbox.south + bbox.north) / 2;
  const dLat = metersToDegLat(cellSizeM);
  const dLng = metersToDegLng(cellSizeM, midLat);

  const cells: GridCellMeta[] = [];
  let row = 0;
  for (let lat = bbox.south + dLat / 2; lat < bbox.north; lat += dLat, row++) {
    let col = 0;
    for (let lng = bbox.west + dLng / 2; lng < bbox.east; lng += dLng, col++) {
      const { zone, distM } = nearestZone(lat, lng);
      const maxD =
        zone.areaType === 'rural'
          ? ZONE_INFLUENCE_M.rural
          : ZONE_INFLUENCE_M.urban;
      if (distM > maxD) continue;

      const halfLat = dLat / 2;
      const halfLng = dLng / 2;
      cells.push({
        cellId: `ict_${cellSizeM}m_r${row}_c${col}`,
        row,
        col,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        west: Math.round((lng - halfLng) * 1e6) / 1e6,
        south: Math.round((lat - halfLat) * 1e6) / 1e6,
        east: Math.round((lng + halfLng) * 1e6) / 1e6,
        north: Math.round((lat + halfLat) * 1e6) / 1e6,
        zoneId: zone.id,
        tehsil: zone.tehsil,
        areaType: zone.areaType,
      });
    }
  }

  return { cells, cellSizeM, count: cells.length };
}

/** Pilot mask: F-6 + G-9 only (STEP 7 confirm-before-scale). */
export function filterPilotCells(cells: GridCellMeta[]): GridCellMeta[] {
  const pilot = new Set(['zone-f6', 'zone-g9']);
  return cells.filter((c) => pilot.has(c.zoneId));
}
