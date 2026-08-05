/**
 * Local full-ICT block refresh → Supabase (no Vercel time limit).
 * Requires .env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 *   npm run grid:refresh-local
 */
import { config } from 'dotenv';
import {
  listZoneIdsForRefresh,
  refreshGridZone,
} from '../lib/refreshGridZone.js';
import { createServiceClient, isSupabaseConfigured } from '../lib/supabase.js';

config({ path: '.env.local' });
config();

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createServiceClient();
  const zones = listZoneIdsForRefresh();
  console.log(`Refreshing ${zones.length} zones with live Open-Meteo…`);
  for (let i = 0; i < zones.length; i++) {
    const id = zones[i];
    process.stdout.write(`[${i + 1}/${zones.length}] ${id}… `);
    const r = await refreshGridZone(supabase, id);
    console.log(
      `${r.cellsUpdated} cells · ${r.weather.temperature}°C ${r.weather.humidity}% rain ${r.weather.rainfall}mm`
    );
    // polite pause for Open-Meteo
    await new Promise((res) => setTimeout(res, 400));
  }
  console.log('Done — next page load reads cached grid from Supabase.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
