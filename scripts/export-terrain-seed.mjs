/**
 * Write supabase/migrations/005_seed_terrain_depressions.sql
 * and lib/terrainDepressions.seed.ts from data/terrain_depressions.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('data/terrain_depressions.json', 'utf8'));

const rows = data.zones.map((z, i) => {
  const comma = i < data.zones.length - 1 ? ',' : '';
  const dem = String(z.demSource).replace(/'/g, "''");
  return `  ('${z.zoneId}', ${z.depressionDepthAvg}, ${z.depressionAreaPct}, ${z.depressionRiskScore}, '${dem}', '${z.computedAt}')${comma}`;
});

const sql = `-- Seed terrain_depressions from offline batch (NOT daily cron).
-- Source: data/terrain_depressions.json — regenerate via: npm run terrain && node scripts/export-terrain-seed.mjs

INSERT INTO public.terrain_depressions (
  zone_id, depression_depth_avg, depression_area_pct,
  depression_risk_score, dem_source, computed_at
)
VALUES
${rows.join('\n')}
ON CONFLICT (zone_id) DO UPDATE SET
  depression_depth_avg = EXCLUDED.depression_depth_avg,
  depression_area_pct = EXCLUDED.depression_area_pct,
  depression_risk_score = EXCLUDED.depression_risk_score,
  dem_source = EXCLUDED.dem_source,
  computed_at = EXCLUDED.computed_at;
`;

writeFileSync('supabase/migrations/005_seed_terrain_depressions.sql', sql);

const ts = `/**
 * Auto-generated from data/terrain_depressions.json — do not edit by hand.
 * Regenerate: npm run terrain && node scripts/export-terrain-seed.mjs
 *
 * Bundled so Vercel serverless can load terrain without a filesystem GeoTIFF.
 * This is a RARE-REFRESH structural layer (not daily weather/NDVI).
 */
export const TERRAIN_DEPRESSIONS_SEED = ${JSON.stringify(data, null, 2)} as const;
`;

writeFileSync('lib/terrainDepressions.seed.ts', ts);
console.log(`Exported ${data.zones.length} zones → SQL + lib/terrainDepressions.seed.ts`);
