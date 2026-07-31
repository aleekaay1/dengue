/**
 * Local refresh: build dashboard + optionally persist to Supabase.
 * Run: npm run refresh
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { buildDashboard } from '../lib/buildDashboard.ts';
import { persistDashboard } from '../lib/persistDashboard.ts';
import { createServiceClient, isSupabaseConfigured } from '../lib/supabase.ts';

const payload = await buildDashboard({ bypassCache: true });

console.log('Built', payload.zones.length, 'zones at', payload.builtAt);
console.log('Freshness:', JSON.stringify(payload.freshness, null, 2));
console.log('\nSample zones:');
for (const z of payload.zones.slice(0, 5)) {
  console.log(
    `  ${z.name}: T=${z.temperature}°C RH=${z.humidity}% rain=${z.rainfallRecent}mm NDVI=${z.vegetationIndex} score=${z.riskScore} (${z.riskLevel})`
  );
}

if (isSupabaseConfigured()) {
  await persistDashboard(createServiceClient(), payload);
  console.log('\nPersisted to Supabase.');
} else {
  console.log('\nSupabase not configured — skipped persist.');
}

if (!payload.freshness.dengueScrapeOk) {
  console.error('\nDENGUE SOURCE FAILURE:', payload.freshness.dengueScrapeError);
  process.exitCode = 0; // weather path still succeeded
}
