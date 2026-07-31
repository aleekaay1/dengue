/**
 * Historical dengue case data for Islamabad zones.
 *
 * Investigation (2026-07):
 * - PITB Dengue Activity Tracking System (DATS) and Disease Surveillance System
 *   are internal government platforms; no documented public JSON API.
 * - Islamabad / ICT case feeds are not publicly available as JSON for MVP use.
 *
 * Strategy: attempt known public endpoints; on failure, load last persisted
 * seed/snapshot and surface a loud scrape-failure status (never fail silently).
 * Results are intended to be written to Supabase by the daily cron — never
 * scraped on every page load.
 */

import { CACHE_TTL, getCached, setCache } from './cache';

export interface WeeklyCaseCount {
  week: string;
  count: number;
}

export interface ZoneCaseHistory {
  zoneId: string;
  pastCases: WeeklyCaseCount[];
  /** Most recent case-report date (ISO date) represented by the series */
  asOfDate: string;
}

export interface DengueCasesResult {
  byZone: Record<string, ZoneCaseHistory>;
  source: 'punjab-api' | 'scrape' | 'seed-snapshot';
  scrapeOk: boolean;
  scrapeError?: string;
  fetchedAt: string;
  asOfDate: string;
}

/** Last-known MVP seed for Islamabad sectors. Replace via cron when scrape/API works. */
const SEED_CASES: Record<string, WeeklyCaseCount[]> = {
  'zone-f6': [
    { week: 'W24', count: 3 },
    { week: 'W25', count: 5 },
    { week: 'W26', count: 8 },
    { week: 'W27', count: 12 },
    { week: 'W28', count: 16 },
  ],
  'zone-f7': [
    { week: 'W24', count: 2 },
    { week: 'W25', count: 4 },
    { week: 'W26', count: 7 },
    { week: 'W27', count: 10 },
    { week: 'W28', count: 14 },
  ],
  'zone-bluearea': [
    { week: 'W24', count: 5 },
    { week: 'W25', count: 8 },
    { week: 'W26', count: 11 },
    { week: 'W27', count: 15 },
    { week: 'W28', count: 19 },
  ],
  'zone-f8': [
    { week: 'W24', count: 2 },
    { week: 'W25', count: 3 },
    { week: 'W26', count: 5 },
    { week: 'W27', count: 7 },
    { week: 'W28', count: 9 },
  ],
  'zone-g6': [
    { week: 'W24', count: 7 },
    { week: 'W25', count: 10 },
    { week: 'W26', count: 14 },
    { week: 'W27', count: 18 },
    { week: 'W28', count: 24 },
  ],
  'zone-g9': [
    { week: 'W24', count: 4 },
    { week: 'W25', count: 6 },
    { week: 'W26', count: 9 },
    { week: 'W27', count: 12 },
    { week: 'W28', count: 15 },
  ],
  'zone-f10': [
    { week: 'W24', count: 1 },
    { week: 'W25', count: 2 },
    { week: 'W26', count: 3 },
    { week: 'W27', count: 5 },
    { week: 'W28', count: 7 },
  ],
  'zone-g11': [
    { week: 'W24', count: 2 },
    { week: 'W25', count: 3 },
    { week: 'W26', count: 4 },
    { week: 'W27', count: 6 },
    { week: 'W28', count: 8 },
  ],
  'zone-i8': [
    { week: 'W24', count: 3 },
    { week: 'W25', count: 5 },
    { week: 'W26', count: 6 },
    { week: 'W27', count: 8 },
    { week: 'W28', count: 10 },
  ],
  'zone-diplomatic': [
    { week: 'W24', count: 0 },
    { week: 'W25', count: 0 },
    { week: 'W26', count: 1 },
    { week: 'W27', count: 1 },
    { week: 'W28', count: 2 },
  ],
};

const CANDIDATE_ENDPOINTS = [
  'https://dss.punjab.gov.pk/api/dengue/cases',
  'https://dss.punjab.gov.pk/api/v1/dengue',
];

async function tryPublicApi(): Promise<DengueCasesResult | null> {
  for (const endpoint of CANDIDATE_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) continue;
      const data = await res.json();
      // If a real schema appears, map it here.
      if (data && typeof data === 'object' && data.byZone) {
        return {
          byZone: data.byZone,
          source: 'punjab-api',
          scrapeOk: true,
          fetchedAt: new Date().toISOString(),
          asOfDate: data.asOfDate ?? new Date().toISOString().slice(0, 10),
        };
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function buildSeedResult(scrapeError: string): DengueCasesResult {
  const asOfDate = '2026-07-28'; // last curated seed date — update when live feed works
  const byZone: Record<string, ZoneCaseHistory> = {};
  for (const [zoneId, pastCases] of Object.entries(SEED_CASES)) {
    byZone[zoneId] = { zoneId, pastCases, asOfDate };
  }
  return {
    byZone,
    source: 'seed-snapshot',
    scrapeOk: false,
    scrapeError,
    fetchedAt: new Date().toISOString(),
    asOfDate,
  };
}

/**
 * Fetch dengue case histories. Never scrapes on every page load — cron should
 * call this once daily and persist to Supabase.
 */
export async function fetchDengueCases(options?: {
  bypassCache?: boolean;
}): Promise<DengueCasesResult> {
  const cacheKey = 'dengue-cases:islamabad';
  if (!options?.bypassCache) {
    const hit = getCached<DengueCasesResult>(cacheKey);
    if (hit) return hit.value;
  }

  const fromApi = await tryPublicApi();
  if (fromApi) {
    setCache(cacheKey, fromApi, CACHE_TTL.DENGUE_DAY);
    return fromApi;
  }

  const message =
    'No public ICT/Islamabad dengue JSON API available; using seed snapshot — schedule will keep trying daily.';
  console.error('[dengueCases] SCRAPE/API FAILURE:', message);

  const seed = buildSeedResult(message);
  setCache(cacheKey, seed, CACHE_TTL.DENGUE_DAY);
  return seed;
}

export function isDengueDataStale(asOfDate: string, maxAgeDays = 2): boolean {
  const asOf = new Date(`${asOfDate}T00:00:00Z`).getTime();
  const ageMs = Date.now() - asOf;
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}
