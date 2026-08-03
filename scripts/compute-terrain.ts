/**
 * Offline / batch: standing-water (terrain depression) risk for ICT zones.
 *
 * NOT part of the daily weather/NDVI cron. Terrain is essentially static —
 * re-run quarterly, or after major construction that reshapes drainage.
 *
 * Pipeline:
 *  1. Sample elevation on a local grid per zone (Open-Meteo DEM ~90 m; same
 *     structural idea as Copernicus GLO-30 / SRTM sinks).
 *  2. Priority-Flood fill depressions (Barnes-style) → depth-of-fill.
 *  3. Aggregate per zone → write data/terrain_depressions.json
 *
 * Prefer scripts/terrain/compute_depressions.py (richdem + GLO-30 GeoTIFF)
 * when Python + Earth Engine exports are available — this TS path is the
 * runnable fallback that produces real zone metrics without Python.
 *
 * Usage: npx tsx scripts/compute-terrain.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZONE_META } from '../lib/zoneMeta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'terrain_depressions.json');

const DEM_SOURCE = 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill';
/** Depth (m) above which a cell counts as "in a depression" */
const DEPTH_THRESHOLD_M = 0.25;
/** Grid half-width in degrees (~900 m urban / ~1100 m rural at ICT lat) */
const HALF_DEG_URBAN = 0.008;
const HALF_DEG_RURAL = 0.01;
const GRID_N = 11; // 11×11 = 121 samples / zone (~2 API batches of ≤80)

interface ZoneTerrain {
  zoneId: string;
  zoneName: string;
  depressionDepthAvg: number;
  depressionAreaPct: number;
  depressionRiskScore: number;
  elevMin: number;
  elevMax: number;
  elevMean: number;
  demSource: string;
  computedAt: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Min-heap for Priority-Flood */
class MinHeap {
  private a: { r: number; c: number; z: number }[] = [];
  get size() {
    return this.a.length;
  }
  push(item: { r: number; c: number; z: number }) {
    this.a.push(item);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].z <= this.a[i].z) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let s = i;
        if (l < this.a.length && this.a[l].z < this.a[s].z) s = l;
        if (r < this.a.length && this.a[r].z < this.a[s].z) s = r;
        if (s === i) break;
        [this.a[i], this.a[s]] = [this.a[s], this.a[i]];
        i = s;
      }
    }
    return top;
  }
}

/**
 * Priority-Flood depression fill (edge cells drain freely).
 * Returns filled elevations; depth = filled − original.
 */
function fillDepressions(elev: number[][]): number[][] {
  const rows = elev.length;
  const cols = elev[0].length;
  const filled = elev.map((row) => row.map(() => Number.POSITIVE_INFINITY));
  const closed = elev.map((row) => row.map(() => false));
  const heap = new MinHeap();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) {
        filled[r][c] = elev[r][c];
        closed[r][c] = true;
        heap.push({ r, c, z: elev[r][c] });
      }
    }
  }

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const;

  while (heap.size) {
    const cur = heap.pop();
    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr;
      const nc = cur.c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      if (closed[nr][nc]) continue;
      closed[nr][nc] = true;
      const fz = Math.max(elev[nr][nc], filled[cur.r][cur.c]);
      filled[nr][nc] = fz;
      heap.push({ r: nr, c: nc, z: fz });
    }
  }

  return filled;
}

function scoreDepression(depthAvg: number, areaPct: number): number {
  // Calibrated to ICT grids (~90 m DEM): fill depths are usually <0.5 m avg.
  // With GLO-30 + richdem, retune depthFullM toward ~2.0 if depths are larger.
  const depthNorm = clamp(depthAvg / 0.45, 0, 1);
  const areaNorm = clamp(areaPct / 18, 0, 1);
  return Math.round(100 * (0.55 * depthNorm + 0.45 * areaNorm));
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchElevations(
  lats: number[],
  lngs: number[]
): Promise<number[]> {
  const out: number[] = [];
  const BATCH = 80;
  for (let i = 0; i < lats.length; i += BATCH) {
    const la = lats.slice(i, i + BATCH);
    const lo = lngs.slice(i, i + BATCH);
    // Open-Meteo elevation requires literal commas (not %2C)
    const url =
      `https://api.open-meteo.com/v1/elevation?latitude=${la.join(',')}` +
      `&longitude=${lo.join(',')}`;

    let attempt = 0;
    for (;;) {
      attempt++;
      const res = await fetch(url);
      if (res.status === 429) {
        const wait = Math.min(90_000, 15_000 * attempt);
        console.warn(`\n    rate-limited — wait ${wait / 1000}s (attempt ${attempt})`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Elevation API ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as {
        elevation?: number[];
        reason?: string;
      };
      if (!json.elevation?.length) {
        throw new Error(json.reason ?? 'No elevation array in response');
      }
      out.push(...json.elevation);
      break;
    }
    // Stay under free-tier minutely limits
    await sleep(2500);
  }
  return out;
}

function buildGrid(
  lat: number,
  lng: number,
  halfDeg: number,
  n: number
): { lats: number[]; lngs: number[]; coords: { lat: number; lng: number }[] } {
  const lats: number[] = [];
  const lngs: number[] = [];
  const coords: { lat: number; lng: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const la = lat - halfDeg + (2 * halfDeg * i) / (n - 1);
      const lo = lng - halfDeg + (2 * halfDeg * j) / (n - 1);
      lats.push(la);
      lngs.push(lo);
      coords.push({ lat: la, lng: lo });
    }
  }
  return { lats, lngs, coords };
}

async function analyzeZone(meta: (typeof ZONE_META)[number]): Promise<ZoneTerrain> {
  const half = meta.areaType === 'rural' ? HALF_DEG_RURAL : HALF_DEG_URBAN;
  const { lats, lngs } = buildGrid(
    meta.coordinates.lat,
    meta.coordinates.lng,
    half,
    GRID_N
  );
  const elevations = await fetchElevations(lats, lngs);
  const elev: number[][] = [];
  for (let i = 0; i < GRID_N; i++) {
    elev.push(elevations.slice(i * GRID_N, (i + 1) * GRID_N));
  }

  const filled = fillDepressions(elev);
  const depths: number[] = [];
  let sinkCells = 0;
  for (let r = 0; r < GRID_N; r++) {
    for (let c = 0; c < GRID_N; c++) {
      const d = Math.max(0, filled[r][c] - elev[r][c]);
      depths.push(d);
      if (d >= DEPTH_THRESHOLD_M) sinkCells++;
    }
  }

  const depressionDepthAvg =
    Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 1000) / 1000;
  const depressionAreaPct =
    Math.round((100 * sinkCells) / depths.length * 10) / 10;
  const depressionRiskScore = scoreDepression(
    depressionDepthAvg,
    depressionAreaPct
  );

  const elevMin = Math.min(...elevations);
  const elevMax = Math.max(...elevations);
  const elevMean =
    Math.round(
      (elevations.reduce((a, b) => a + b, 0) / elevations.length) * 10
    ) / 10;

  return {
    zoneId: meta.id,
    zoneName: meta.name,
    depressionDepthAvg,
    depressionAreaPct,
    depressionRiskScore,
    elevMin,
    elevMax,
    elevMean,
    demSource: DEM_SOURCE,
    computedAt: new Date().toISOString(),
  };
}

async function main() {
  console.log(`Computing terrain depressions for ${ZONE_META.length} ICT zones…`);
  const zones: ZoneTerrain[] = [];
  for (const meta of ZONE_META) {
    process.stdout.write(`  ${meta.name}… `);
    const row = await analyzeZone(meta);
    zones.push(row);
    console.log(
      `depthAvg=${row.depressionDepthAvg}m area=${row.depressionAreaPct}% score=${row.depressionRiskScore}`
    );
  }

  // Sanity highlights for known waterlogging-prone areas
  const watch = ['zone-i8', 'zone-g11', 'zone-rawat', 'zone-sihala', 'zone-f6'];
  console.log('\nSanity check (known low / industrial / nullah-adjacent):');
  for (const id of watch) {
    const z = zones.find((x) => x.zoneId === id);
    if (z) {
      console.log(
        `  ${z.zoneName}: score=${z.depressionRiskScore} depth=${z.depressionDepthAvg}m area=${z.depressionAreaPct}% elev=${z.elevMean}m`
      );
    }
  }

  const payload = {
    // Rare refresh — do NOT wire into daily cron.
    note: 'Structural terrain depression metrics. Refresh quarterly or after major earthworks — not daily.',
    demSource: DEM_SOURCE,
    computedAt: new Date().toISOString(),
    depthThresholdM: DEPTH_THRESHOLD_M,
    zones,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
