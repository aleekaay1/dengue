import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('data/grid_cells_latest.json', 'utf8'));
if (Array.isArray(raw.cells?.[0])) {
  console.log('already packed', (Buffer.byteLength(JSON.stringify(raw)) / 1e6).toFixed(1), 'MB');
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
  zoneIds,
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
  ]),
};
const json = JSON.stringify(packed);
writeFileSync('data/grid_cells_latest.json', json);
writeFileSync(
  'data/grid_heat_points.json',
  JSON.stringify({
    cellSizeM: raw.cellSizeM,
    computedAt: raw.computedAt,
    points: raw.cells.map((c) => [
      +c.lat.toFixed(5),
      +c.lng.toFixed(5),
      +(c.riskScore / 100).toFixed(3),
    ]),
  })
);
console.log('packed', (Buffer.byteLength(json) / 1e6).toFixed(1), 'MB', packed.cellCount, 'cells');
