import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

mkdirSync('public', { recursive: true });
const src = existsSync('data/grid_heat_points.json')
  ? 'data/grid_heat_points.json'
  : null;
if (!src) {
  console.error('No data/grid_heat_points.json — run grid:fast:full first');
  process.exit(1);
}
const h = JSON.parse(readFileSync(src, 'utf8'));
// Prefer already-thinned pack output; boost intensity for readable overview
const pts = (h.points || []).map((p) => [
  p[0],
  p[1],
  Math.min(1, Math.max(0.22, Number(p[2]) * 1.2)),
]);
const out = {
  cellSizeM: h.cellSizeM || 50,
  computedAt: h.computedAt,
  count: pts.length,
  points: pts,
};
writeFileSync('public/grid_heat.json', JSON.stringify(out));
console.log('Published public/grid_heat.json', pts.length, 'points');
