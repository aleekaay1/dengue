/**
 * Quick verification: fetch Open-Meteo weather for all Islamabad zones.
 * Run: npx tsx scripts/test-weather.ts
 */

import { ZONE_META } from '../lib/zoneMeta.ts';
import { fetchWeatherForZones } from '../lib/api/weather.ts';

const zones = ZONE_META.map((z) => ({
  id: z.id,
  lat: z.coordinates.lat,
  lng: z.coordinates.lng,
}));

console.log('Fetching Open-Meteo weather for', zones.length, 'zones...\n');

const { readings, errors } = await fetchWeatherForZones(zones, {
  bypassCache: true,
});

for (const z of ZONE_META) {
  const r = readings[z.id];
  if (r) {
    console.log(
      `${z.name.padEnd(28)}  T=${String(r.temperature).padStart(5)}°C  RH=${String(r.humidity).padStart(3)}%  Rain48h=${String(r.rainfallRecent).padStart(5)}mm  asOf=${r.asOfDate}${r.isLagged ? ' (LAGGED)' : ''}`
    );
  } else {
    console.log(`${z.name.padEnd(28)}  ERROR: ${errors[z.id]}`);
  }
}

console.log('\nErrors:', Object.keys(errors).length ? errors : 'none');
