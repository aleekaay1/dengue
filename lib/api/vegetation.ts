/**
 * Vegetation / shade density (NDVI) per zone.
 *
 * All values: Earth Engine Sentinel-2 SR median (2026-06-01 → 2026-07-31).
 * Urban: 800m buffer · Rural: 1000m buffer · cloud < 30%.
 */

import { CACHE_TTL, getCached, setCache } from './cache.js';

export interface VegetationReading {
  vegetationIndex: number; // NDVI 0–1
  shadeCoverage: number; // % estimated canopy/shade
  asOfDate: string;
  source: 'static-precomputed' | 'earth-engine' | 'sentinel-hub';
  fetchedAt: string;
}

const STATIC_NDVI: Record<
  string,
  { vegetationIndex: number; shadeCoverage: number; asOfDate: string }
> = {
  // EE Console 2026-08-05 — S2 SR median 2026-06-01→07-31 (+ LST in data/ee_zone_ndvi_lst.json)
  'zone-f6': { vegetationIndex: 0.36, shadeCoverage: 36, asOfDate: '2026-07-31' },
  'zone-f7': { vegetationIndex: 0.36, shadeCoverage: 36, asOfDate: '2026-07-31' },
  'zone-bluearea': { vegetationIndex: 0.33, shadeCoverage: 33, asOfDate: '2026-07-31' },
  'zone-f8': { vegetationIndex: 0.33, shadeCoverage: 33, asOfDate: '2026-07-31' },
  'zone-g6': { vegetationIndex: 0.4, shadeCoverage: 40, asOfDate: '2026-07-31' },
  'zone-g9': { vegetationIndex: 0.3, shadeCoverage: 30, asOfDate: '2026-07-31' },
  'zone-f10': { vegetationIndex: 0.35, shadeCoverage: 35, asOfDate: '2026-07-31' },
  'zone-g11': { vegetationIndex: 0.23, shadeCoverage: 23, asOfDate: '2026-07-31' },
  'zone-i8': { vegetationIndex: 0.28, shadeCoverage: 28, asOfDate: '2026-07-31' },
  'zone-diplomatic': { vegetationIndex: 0.41, shadeCoverage: 41, asOfDate: '2026-07-31' },
  'zone-bharakahu': { vegetationIndex: 0.18, shadeCoverage: 18, asOfDate: '2026-07-31' },
  'zone-banigala': { vegetationIndex: 0.47, shadeCoverage: 47, asOfDate: '2026-07-31' },
  'zone-nilore': { vegetationIndex: 0.26, shadeCoverage: 26, asOfDate: '2026-07-31' },
  'zone-chirah': { vegetationIndex: 0.31, shadeCoverage: 31, asOfDate: '2026-07-31' },
  'zone-tarnol': { vegetationIndex: 0.24, shadeCoverage: 24, asOfDate: '2026-07-31' },
  'zone-golra': { vegetationIndex: 0.28, shadeCoverage: 28, asOfDate: '2026-07-31' },
  'zone-sihala': { vegetationIndex: 0.37, shadeCoverage: 37, asOfDate: '2026-07-31' },
  'zone-rawat': { vegetationIndex: 0.26, shadeCoverage: 26, asOfDate: '2026-07-31' },
  'zone-koral': { vegetationIndex: 0.3, shadeCoverage: 30, asOfDate: '2026-07-31' },
};

export async function fetchVegetationForZone(zoneId: string): Promise<VegetationReading> {
  const cacheKey = `vegetation:${zoneId}`;
  const hit = getCached<VegetationReading>(cacheKey);
  if (hit) return hit.value;

  const staticVal = STATIC_NDVI[zoneId];
  if (!staticVal) {
    throw new Error(`No static NDVI configured for zone ${zoneId}`);
  }

  const reading: VegetationReading = {
    ...staticVal,
    source: 'static-precomputed',
    fetchedAt: new Date().toISOString(),
  };

  setCache(cacheKey, reading, CACHE_TTL.VEGETATION_WEEK);
  return reading;
}

export async function fetchVegetationForZones(zoneIds: string[]): Promise<{
  readings: Record<string, VegetationReading>;
  errors: Record<string, string>;
}> {
  const readings: Record<string, VegetationReading> = {};
  const errors: Record<string, string> = {};

  for (const id of zoneIds) {
    try {
      readings[id] = await fetchVegetationForZone(id);
    } catch (err) {
      errors[id] = err instanceof Error ? err.message : String(err);
    }
  }

  return { readings, errors };
}
