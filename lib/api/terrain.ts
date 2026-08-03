/**
 * Terrain / standing-water (depression) risk — structural, not live weather.
 *
 * Loaded from the rare-refresh bundled seed (lib/terrainDepressions.seed.ts)
 * or optionally from Supabase `terrain_depressions` when present.
 *
 * Do NOT call DEM APIs from the daily cron. Recompute with:
 *   npm run terrain   (Open-Meteo + Priority-Flood)
 *   or scripts/terrain/compute_depressions.py (GLO-30 + richdem)
 * then: node scripts/export-terrain-seed.mjs
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { TERRAIN_DEPRESSIONS_SEED } from '../terrainDepressions.seed.js';

export interface TerrainDepressionReading {
  zoneId: string;
  depressionDepthAvg: number;
  depressionAreaPct: number;
  /** Normalized 0–100 structural risk score */
  depressionRiskScore: number;
  demSource: string;
  computedAt: string;
}

export interface TerrainBundle {
  byZone: Record<string, TerrainDepressionReading>;
  demSource: string | null;
  computedAt: string | null;
}

function loadSeedFile(): TerrainBundle {
  const seed = TERRAIN_DEPRESSIONS_SEED;
  const byZone: Record<string, TerrainDepressionReading> = {};
  for (const z of seed.zones ?? []) {
    byZone[z.zoneId] = {
      zoneId: z.zoneId,
      depressionDepthAvg: z.depressionDepthAvg,
      depressionAreaPct: z.depressionAreaPct,
      depressionRiskScore: z.depressionRiskScore,
      demSource: z.demSource ?? seed.demSource ?? 'unknown',
      computedAt: z.computedAt ?? seed.computedAt ?? new Date().toISOString(),
    };
  }
  return {
    byZone,
    demSource: seed.demSource ?? null,
    computedAt: seed.computedAt ?? null,
  };
}

/** Sync load from committed seed — primary path for SSR / cron assembly. */
export function loadTerrainDepressions(): TerrainBundle {
  return loadSeedFile();
}

/**
 * Prefer Supabase when the rare-batch table has rows; fall back to seed JSON.
 * Still never fetches DEM live.
 */
export async function loadTerrainDepressionsAsync(
  supabase?: SupabaseClient | null
): Promise<TerrainBundle> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('terrain_depressions').select('*');
      if (!error && data?.length) {
        const byZone: Record<string, TerrainDepressionReading> = {};
        let demSource: string | null = null;
        let computedAt: string | null = null;
        for (const row of data) {
          byZone[row.zone_id] = {
            zoneId: row.zone_id,
            depressionDepthAvg: row.depression_depth_avg,
            depressionAreaPct: row.depression_area_pct,
            depressionRiskScore: row.depression_risk_score,
            demSource: row.dem_source,
            computedAt: row.computed_at,
          };
          demSource = row.dem_source;
          computedAt = row.computed_at;
        }
        return { byZone, demSource, computedAt };
      }
    } catch {
      // table missing or RLS — use seed
    }
  }
  return loadSeedFile();
}
