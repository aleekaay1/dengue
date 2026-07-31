/**
 * Vegetation / shade density (NDVI) per zone.
 *
 * Urban values: Earth Engine Sentinel-2 median (2026-06-01 → 2026-07-31).
 * Rural values: provisional estimates until EE script is re-run for new points.
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
  // Confirmed EE (urban)
  'zone-f6': { vegetationIndex: 0.36, shadeCoverage: 36, asOfDate: '2026-07-31' },
  'zone-f7': { vegetationIndex: 0.36, shadeCoverage: 36, asOfDate: '2026-07-31' },
  'zone-bluearea': { vegetationIndex: 0.34, shadeCoverage: 34, asOfDate: '2026-07-31' },
  'zone-f8': { vegetationIndex: 0.33, shadeCoverage: 33, asOfDate: '2026-07-31' },
  'zone-g6': { vegetationIndex: 0.4, shadeCoverage: 40, asOfDate: '2026-07-31' },
  'zone-g9': { vegetationIndex: 0.3, shadeCoverage: 30, asOfDate: '2026-07-31' },
  'zone-f10': { vegetationIndex: 0.36, shadeCoverage: 36, asOfDate: '2026-07-31' },
  'zone-g11': { vegetationIndex: 0.23, shadeCoverage: 23, asOfDate: '2026-07-31' },
  'zone-i8': { vegetationIndex: 0.28, shadeCoverage: 28, asOfDate: '2026-07-31' },
  'zone-diplomatic': { vegetationIndex: 0.41, shadeCoverage: 41, asOfDate: '2026-07-31' },
  // Provisional rural (replace after EE run — expect higher canopy)
  'zone-bharakahu': { vegetationIndex: 0.52, shadeCoverage: 52, asOfDate: '2026-07-31' },
  'zone-banigala': { vegetationIndex: 0.58, shadeCoverage: 58, asOfDate: '2026-07-31' },
  'zone-nilore': { vegetationIndex: 0.48, shadeCoverage: 48, asOfDate: '2026-07-31' },
  'zone-chirah': { vegetationIndex: 0.55, shadeCoverage: 55, asOfDate: '2026-07-31' },
  'zone-tarnol': { vegetationIndex: 0.44, shadeCoverage: 44, asOfDate: '2026-07-31' },
  'zone-golra': { vegetationIndex: 0.5, shadeCoverage: 50, asOfDate: '2026-07-31' },
  'zone-sihala': { vegetationIndex: 0.46, shadeCoverage: 46, asOfDate: '2026-07-31' },
  'zone-rawat': { vegetationIndex: 0.38, shadeCoverage: 38, asOfDate: '2026-07-31' },
  'zone-koral': { vegetationIndex: 0.49, shadeCoverage: 49, asOfDate: '2026-07-31' },
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
