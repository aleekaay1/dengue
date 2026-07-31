/**
 * Vegetation / shade density (NDVI) per zone.
 *
 * TODO: replace static NDVI with live Earth Engine query
 * (Google Earth Engine REST / Sentinel Hub Statistics API).
 * Vegetation changes slowly — refresh weekly when live.
 */

import { CACHE_TTL, getCached, setCache } from './cache';

export interface VegetationReading {
  vegetationIndex: number; // NDVI 0–1
  shadeCoverage: number; // % estimated canopy/shade
  asOfDate: string;
  source: 'static-precomputed' | 'earth-engine' | 'sentinel-hub';
  fetchedAt: string;
}

/**
 * Islamabad NDVI from Google Earth Engine (Sentinel-2 SR median).
 * Window: 2026-06-01 → 2026-07-31, 800m buffer, cloud < 30%.
 * TODO: automate via Earth Engine API / service account (refresh weekly).
 */
const STATIC_NDVI: Record<
  string,
  { vegetationIndex: number; shadeCoverage: number; asOfDate: string }
> = {
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
};

export async function fetchVegetationForZone(zoneId: string): Promise<VegetationReading> {
  const cacheKey = `vegetation:${zoneId}`;
  const hit = getCached<VegetationReading>(cacheKey);
  if (hit) return hit.value;

  // TODO: replace static NDVI with live Earth Engine query
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
