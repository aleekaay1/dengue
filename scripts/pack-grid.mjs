import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('data/grid_cells_latest.json', 'utf8'));
if (Array.isArray(raw.cells?.[0]) && raw.cells[0].length >= 16) {
  console.log('already packed v2', (Buffer.byteLength(JSON.stringify(raw)) / 1e6).toFixed(1), 'MB');
  process.exit(0);
}

const zoneIds = [...new Set(raw.cells.map((c) => c.zoneId))];
const zmap = Object.fromEntries(zoneIds.map((id, i) => [id, i]));
const packed = {
  note: raw.note,
  cellSizeM: raw.cellSizeM,
  bbox: raw.bbox,
  pilot: raw.pilot,
  cellCount: raw.cellCount,
  computedAt: raw.computedAt,
  sources: raw.sources,
  packVersion: 2,
  zoneIds,
  // lat,lng,w,s,e,n,zIdx,ndvi100,dep,settle100,risk,pop,temp10,hum,rain10,lst10
  cells: raw.cells.map((c) => [
    +c.lat.toFixed(5),
    +c.lng.toFixed(5),
    +c.west.toFixed(5),
    +c.south.toFixed(5),
    +c.east.toFixed(5),
    +c.north.toFixed(5),
    zmap[c.zoneId],
    Math.round(c.ndvi * 100),
    c.depressionScore,
    Math.round(c.settlementDensity * 100),
    c.riskScore,
    c.population,
    Math.round((c.temperature ?? 29) * 10),
    Math.round(c.humidity ?? 60),
    Math.round((c.rainfall ?? 0) * 10),
    Math.round((c.lst ?? c.temperature ?? 35) * 10),
  ]),
};
const json = JSON.stringify(packed);
writeFileSync('data/grid_cells_latest.json', json);
writeFileSync(
  'data/grid_heat_points.json',
  JSON.stringify({
    cellSizeM: raw.cellSizeM,
    computedAt: raw.computedAt,
    // Thin + boost for soft city overview (avoids visible lattice)
    points: raw.cells
      .filter((_, i) => i % 5 === 0)
      .map((c) => [
        +c.lat.toFixed(5),
        +c.lng.toFixed(5),
        Math.min(1, Math.max(0.2, (c.riskScore / 100) * 1.4)),
      ]),
  })
);
console.log('packed', (Buffer.byteLength(json) / 1e6).toFixed(1), 'MB', packed.cellCount, 'cells');
