/**
 * Ingest Earth Engine Console JSON (zoneLayers) into vegetation + grid refresh.
 *
 * Usage:
 *   1. Run scripts/ee_ict_block_layers.js in EE Code Editor
 *   2. Copy Console JSON → save as data/ee_block_layers.json
 *   3. node scripts/ingest-ee-layers.mjs
 *   4. npm run grid:fast:full && node scripts/pack-grid.mjs
 *      (then copy heat to public — this script does that)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const path = 'data/ee_block_layers.json';
if (!existsSync(path)) {
  console.error('Missing', path, '— paste EE Console JSON there first');
  process.exit(1);
}
const ee = JSON.parse(readFileSync(path, 'utf8'));
const zones = ee.zoneLayers || ee.zones || [];
if (!zones.length) {
  console.error('No zoneLayers in EE JSON');
  process.exit(1);
}

const ndviMap = {};
const lstMap = {};
for (const z of zones) {
  if (z.zoneId && typeof z.ndvi === 'number') {
    ndviMap[z.zoneId] = Math.round(z.ndvi * 100) / 100;
  }
  if (z.zoneId && typeof z.lst === 'number') {
    lstMap[z.zoneId] = Math.round(z.lst * 10) / 10;
  }
}
writeFileSync(
  'data/ee_zone_ndvi_lst.json',
  JSON.stringify(
    { computedAt: ee.computedAt || new Date().toISOString(), ndvi: ndviMap, lst: lstMap },
    null,
    2
  )
);
console.log('Wrote data/ee_zone_ndvi_lst.json for', Object.keys(ndviMap).length, 'zones');
console.log('NDVI sample', ndviMap);
console.log('Next: npm run grid:fast:full && node scripts/pack-grid.mjs && node scripts/publish-heat.mjs');
