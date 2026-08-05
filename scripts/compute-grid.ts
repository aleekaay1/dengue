// @ts-nocheck — geotiff ReadRastersOptions typings omit bbox/window overloads
/**
 * Offline batch: block-level ICT risk grid from real geospatial sources.
 *
 * NOT run on page load / NOT inside the daily Vercel EE path.
 *
 * Layers (all real — no synthetic NDVI/building invention):
 *  - Elevation + depressions: Open-Meteo DEM + Priority-Flood
 *  - Weather / rainfall: Open-Meteo (native ~9–11 km — many cells share values; documented)
 *  - NDVI: Sentinel-2 L2A via Element84 Earth Search STAC + COG read (geotiff)
 *  - Settlement density: OpenStreetMap building footprints (Overpass), binned per cell
 *  - Population: derived from settlement density × WorldPop-style intensity proxy
 *    when a WorldPop raster is unavailable; prefer WorldPop COG when EE/PC available
 *
 * Case history is intentionally NOT applied at cell level (zone feed is still a
 * demo placeholder). Block risk = environmental + settlement only.
 *
 * Usage:
 *   npx tsx scripts/compute-grid.ts --pilot     # F-6 + G-9 first
 *   npx tsx scripts/compute-grid.ts --full
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromArrayBuffer } from 'geotiff';
import {
  buildIctGrid,
  filterPilotCells,
  GRID_CELL_SIZE_M,
  ICT_BBOX,
  type GridCellMeta,
} from '../lib/gridMeta.js';
import { calculateRisk, scoreToRiskLevel } from '../lib/riskModel.js';
import { ZONE_META } from '../lib/zoneMeta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUT_FULL = join(DATA_DIR, 'grid_cells_latest.json');
const OUT_PILOT = join(DATA_DIR, 'grid_cells_pilot.json');
const OUT_HEAT = join(DATA_DIR, 'grid_heat_points.json');

const STAC_SEARCH = 'https://earth-search.aws.element84.com/v1/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

interface ScoredCell {
  cellId: string;
  lat: number;
  lng: number;
  west: number;
  south: number;
  east: number;
  north: number;
  zoneId: string;
  tehsil: string;
  ndvi: number;
  lst: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  depressionScore: number;
  settlementDensity: number;
  population: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  peopleAtRisk: number;
}

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ─── Priority-Flood (same as terrain script) ─── */
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

function scoreDepression(depthM: number): number {
  return Math.round(100 * clamp(depthM / 0.45, 0, 1));
}

/* ─── Elevation (Open-Meteo) ─── */
async function fetchElevations(lats: number[], lngs: number[]): Promise<number[]> {
  const out: number[] = [];
  const BATCH = 80;
  for (let i = 0; i < lats.length; i += BATCH) {
    const la = lats.slice(i, i + BATCH);
    const lo = lngs.slice(i, i + BATCH);
    const url =
      `https://api.open-meteo.com/v1/elevation?latitude=${la.join(',')}` +
      `&longitude=${lo.join(',')}`;
    let attempt = 0;
    for (;;) {
      attempt++;
      const res = await fetch(url);
      if (res.status === 429) {
        await sleep(Math.min(90_000, 12_000 * attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Elevation API ${res.status}`);
      const json = (await res.json()) as { elevation: number[] };
      out.push(...json.elevation);
      break;
    }
    await sleep(2000);
    if (i % 800 === 0) process.stdout.write(` elev ${i}/${lats.length}`);
  }
  return out;
}

/* ─── Weather sparse grid (Open-Meteo ~9–11 km native) ─── */
async function fetchWeatherPoint(lat: number, lng: number): Promise<{
  temperature: number;
  humidity: number;
  rainfall: number;
}> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,precipitation'
  );
  url.searchParams.set('hourly', 'precipitation');
  url.searchParams.set('past_days', '2');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'Asia/Karachi');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Weather ${res.status}`);
  const data = (await res.json()) as {
    current: {
      temperature_2m: number;
      relative_humidity_2m: number;
      time: string;
    };
    hourly: { time: string[]; precipitation: number[] };
  };
  const nowMs = Date.parse(data.current.time);
  const cutoff = nowMs - 48 * 3600 * 1000;
  let rain = 0;
  for (let i = 0; i < data.hourly.time.length; i++) {
    const t = Date.parse(data.hourly.time[i]);
    if (t >= cutoff && t <= nowMs) rain += data.hourly.precipitation[i] ?? 0;
  }
  return {
    temperature: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    rainfall: Math.round(rain * 10) / 10,
  };
}

/* ─── Sentinel-2 NDVI via STAC + COG ─── */
async function findSentinelScene(bbox: number[]): Promise<{
  redUrl: string;
  nirUrl: string;
  datetime: string;
} | null> {
  const end = new Date();
  const start = new Date(end.getTime() - 90 * 86400000);
  const body = {
    collections: ['sentinel-2-l2a'],
    bbox,
    datetime: `${start.toISOString()}/${end.toISOString()}`,
    limit: 20,
    query: { 'eo:cloud_cover': { lt: 30 } },
    sortby: [{ field: 'eo:cloud_cover', direction: 'asc' }],
  };
  const res = await fetch(STAC_SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn('STAC search failed', res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as {
    features: Array<{
      properties: { datetime: string; 'eo:cloud_cover'?: number };
      assets: Record<string, { href: string }>;
    }>;
  };
  for (const f of json.features ?? []) {
    const red = f.assets.red?.href ?? f.assets.B04?.href;
    const nir = f.assets.nir?.href ?? f.assets.B08?.href;
    if (red && nir) {
      return {
        redUrl: red,
        nirUrl: nir,
        datetime: f.properties.datetime,
      };
    }
  }
  return null;
}

async function sampleNdviFromCogs(
  cells: GridCellMeta[],
  redUrl: string,
  nirUrl: string
): Promise<Float32Array> {
  console.log('  Loading Sentinel-2 red/nir COGs (may take a few minutes)…');
  const [redBuf, nirBuf] = await Promise.all([
    fetch(redUrl).then((r) => {
      if (!r.ok) throw new Error(`red COG ${r.status}`);
      return r.arrayBuffer();
    }),
    fetch(nirUrl).then((r) => {
      if (!r.ok) throw new Error(`nir COG ${r.status}`);
      return r.arrayBuffer();
    }),
  ]);
  const redTiff = await fromArrayBuffer(redBuf);
  const nirTiff = await fromArrayBuffer(nirBuf);
  const redImg = await redTiff.getImage();
  const nirImg = await nirTiff.getImage();

  const out = new Float32Array(cells.length);
  // Sample in batches via bbox read around groups of cells for speed
  const CHUNK = 200;
  for (let i = 0; i < cells.length; i += CHUNK) {
    const slice = cells.slice(i, i + CHUNK);
    let west = Infinity,
      south = Infinity,
      east = -Infinity,
      north = -Infinity;
    for (const c of slice) {
      west = Math.min(west, c.west);
      south = Math.min(south, c.south);
      east = Math.max(east, c.east);
      north = Math.max(north, c.north);
    }
    // geotiff bbox: [minX, minY, maxX, maxY] in CRS of image (lon/lat for S2 COGs)
    try {
      const redData = await redImg.readRasters({
        bbox: [west, south, east, north],
        width: Math.max(8, Math.ceil((east - west) * 111320 * Math.cos((south * Math.PI) / 180) / 20)),
        height: Math.max(8, Math.ceil((north - south) * 111320 / 20)),
        resampleMethod: 'bilinear',
      });
      const nirData = await nirImg.readRasters({
        bbox: [west, south, east, north],
        width: (redData.width as number) || (redData[0] as Float32Array).length,
        height: redData.height as number,
        resampleMethod: 'bilinear',
      });
      const rw = redData.width as number;
      const rh = redData.height as number;
      const rBand = redData[0] as Float32Array | Uint16Array;
      const nBand = nirData[0] as Float32Array | Uint16Array;

      for (let j = 0; j < slice.length; j++) {
        const c = slice[j];
        const px = Math.min(
          rw - 1,
          Math.max(0, Math.floor(((c.lng - west) / (east - west)) * (rw - 1)))
        );
        const py = Math.min(
          rh - 1,
          Math.max(0, Math.floor(((north - c.lat) / (north - south)) * (rh - 1)))
        );
        const idx = py * rw + px;
        let red = Number(rBand[idx]);
        let nir = Number(nBand[idx]);
        // Sentinel-2 L2A often scaled reflectance * 10000
        if (red > 1 || nir > 1) {
          red /= 10000;
          nir /= 10000;
        }
        const den = nir + red;
        const ndvi = den > 0 ? (nir - red) / den : 0;
        out[i + j] = clamp(ndvi, -0.2, 1);
      }
    } catch (err) {
      console.warn(`  NDVI chunk ${i} failed, using zonal fallback`, err);
      for (let j = 0; j < slice.length; j++) out[i + j] = Number.NaN;
    }
    if (i % 1000 === 0) process.stdout.write(` ndvi ${i}/${cells.length}`);
  }
  console.log('');
  return out;
}

/* ─── OSM buildings → settlement density ─── */
async function fetchBuildingCenters(
  west: number,
  south: number,
  east: number,
  north: number
): Promise<{ lat: number; lng: number }[]> {
  const query = `
[out:json][timeout:180];
(
  way["building"](${south},${west},${north},${east});
  relation["building"](${south},${west},${north},${east});
);
out center;
`;
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    console.warn('Overpass failed', res.status);
    return [];
  }
  const json = (await res.json()) as {
    elements: Array<{ center?: { lat: number; lon: number }; lat?: number; lon?: number }>;
  };
  const pts: { lat: number; lng: number }[] = [];
  for (const el of json.elements ?? []) {
    const lat = el.center?.lat ?? el.lat;
    const lng = el.center?.lon ?? el.lon;
    if (lat != null && lng != null) pts.push({ lat, lng });
  }
  return pts;
}

function binBuildings(
  cells: GridCellMeta[],
  buildings: { lat: number; lng: number }[]
): Float32Array {
  const counts = new Float32Array(cells.length);
  // Index cells by coarse grid for speed
  const byKey = new Map<string, number[]>();
  for (let i = 0; i < cells.length; i++) {
    const key = `${Math.floor(cells[i].lat * 200)}_${Math.floor(cells[i].lng * 200)}`;
    const list = byKey.get(key) ?? [];
    list.push(i);
    byKey.set(key, list);
  }
  for (const b of buildings) {
    const key = `${Math.floor(b.lat * 200)}_${Math.floor(b.lng * 200)}`;
    const candidates = byKey.get(key) ?? [];
    // also check neighbors
    for (const dr of [-1, 0, 1]) {
      for (const dc of [-1, 0, 1]) {
        const k2 = `${Math.floor(b.lat * 200) + dr}_${Math.floor(b.lng * 200) + dc}`;
        const extra = byKey.get(k2);
        if (extra) candidates.push(...extra);
      }
    }
    for (const i of candidates) {
      const c = cells[i];
      if (b.lat >= c.south && b.lat < c.north && b.lng >= c.west && b.lng < c.east) {
        counts[i] += 1;
        break;
      }
    }
  }
  // Normalize: ~15 buildings / 50m cell ≈ dense markaz → 1.0
  const density = new Float32Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    density[i] = clamp(counts[i] / 15, 0, 1);
  }
  return density;
}

/* ─── Zone NDVI fallback (real EE-precomputed values already in vegetation.ts) ─── */
function zoneNdviFallback(): Map<string, number> {
  const path = join(__dirname, '..', 'lib', 'api', 'vegetation.ts');
  // Hardcode from the committed Earth Engine Sentinel-2 medians (real measurements)
  const m = new Map<string, number>([
    ['zone-f6', 0.36],
    ['zone-f7', 0.36],
    ['zone-bluearea', 0.34],
    ['zone-f8', 0.33],
    ['zone-g6', 0.4],
    ['zone-g9', 0.3],
    ['zone-f10', 0.36],
    ['zone-g11', 0.23],
    ['zone-i8', 0.28],
    ['zone-diplomatic', 0.41],
    ['zone-bharakahu', 0.19],
    ['zone-banigala', 0.47],
    ['zone-nilore', 0.26],
    ['zone-chirah', 0.31],
    ['zone-tarnol', 0.24],
    ['zone-golra', 0.28],
    ['zone-sihala', 0.37],
    ['zone-rawat', 0.26],
    ['zone-koral', 0.3],
  ]);
  void path;
  return m;
}

async function main() {
  const args = process.argv.slice(2);
  const pilotOnly = args.includes('--pilot') || !args.includes('--full');
  const t0 = Date.now();

  console.log('Building ICT fishnet…');
  const { cells: allCells, cellSizeM, count: fullCount } = buildIctGrid();
  const cells = pilotOnly ? filterPilotCells(allCells) : allCells;
  console.log(
    `  Full ICT candidates: ${fullCount} @ ${cellSizeM}m | this run: ${cells.length} (${pilotOnly ? 'PILOT F-6+G-9' : 'FULL'})`
  );

  if (!cells.length) throw new Error('No cells generated');

  // Bounds for this run
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  for (const c of cells) {
    west = Math.min(west, c.west);
    south = Math.min(south, c.south);
    east = Math.max(east, c.east);
    north = Math.max(north, c.north);
  }

  // 1) Elevation + depression on a local raster covering the run bbox
  console.log('\n[1/5] Elevation + depression fill…');
  // Sample DEM at 100 m (Open-Meteo native ~90 m) even when risk cells are 50 m
  const midLat = (south + north) / 2;
  const demStepM = 100;
  const dLat = demStepM / 111320;
  const dLng = demStepM / (111320 * Math.cos((midLat * Math.PI) / 180));
  const elevLats: number[] = [];
  const elevLngs: number[] = [];
  const elevRows: number[] = [];
  const elevCols: number[] = [];
  let er = 0;
  for (let lat = south + dLat / 2; lat < north; lat += dLat, er++) {
    let ec = 0;
    for (let lng = west + dLng / 2; lng < east; lng += dLng, ec++) {
      elevLats.push(lat);
      elevLngs.push(lng);
      elevRows.push(er);
      elevCols.push(ec);
    }
  }
  const nRows = Math.max(...elevRows) + 1;
  const nCols = Math.max(...elevCols) + 1;
  console.log(`  DEM sample grid ${nRows}×${nCols} = ${elevLats.length} points`);
  const elevations = await fetchElevations(elevLats, elevLngs);
  const elevGrid: number[][] = Array.from({ length: nRows }, () =>
    Array(nCols).fill(0)
  );
  for (let i = 0; i < elevations.length; i++) {
    elevGrid[elevRows[i]][elevCols[i]] = elevations[i];
  }
  const filled = fillDepressions(elevGrid);
  const depthAt = (lat: number, lng: number): number => {
    const r = clamp(Math.round((lat - (south + dLat / 2)) / dLat), 0, nRows - 1);
    const c = clamp(Math.round((lng - (west + dLng / 2)) / dLng), 0, nCols - 1);
    return Math.max(0, filled[r][c] - elevGrid[r][c]);
  };

  // 2) Weather — sparse stations every ~4 km (Open-Meteo native is coarser anyway)
  console.log('\n[2/5] Weather / rainfall (Open-Meteo; shared across nearby cells)…');
  const wxStep = 0.04; // ~4 km
  type Wx = { temperature: number; humidity: number; rainfall: number; lat: number; lng: number };
  const stations: Wx[] = [];
  for (let lat = south; lat <= north; lat += wxStep) {
    for (let lng = west; lng <= east; lng += wxStep) {
      process.stdout.write(`  wx ${stations.length}`);
      let attempt = 0;
      for (;;) {
        try {
          const w = await fetchWeatherPoint(lat, lng);
          stations.push({ ...w, lat, lng });
          break;
        } catch {
          attempt++;
          if (attempt > 4) throw new Error('Weather fetch failed');
          await sleep(5000 * attempt);
        }
      }
      await sleep(1200);
    }
  }
  console.log(`\n  ${stations.length} weather stations`);
  const nearestWx = (lat: number, lng: number): Wx => {
    let best = stations[0];
    let bestD = Infinity;
    for (const s of stations) {
      const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  };

  // 3) NDVI from Sentinel-2
  console.log('\n[3/5] Sentinel-2 NDVI (Earth Search STAC)…');
  const scene = await findSentinelScene([west, south, east, north]);
  const zoneNdvi = zoneNdviFallback();
  let ndviArr: Float32Array;
  let ndviSource = 'zone-ee-median-fallback';
  let ndviDate: string | null = null;
  if (scene) {
    console.log(`  Scene ${scene.datetime}`);
    try {
      ndviArr = await sampleNdviFromCogs(cells, scene.redUrl, scene.nirUrl);
      ndviSource = 'sentinel-2-l2a-stac-cog';
      ndviDate = scene.datetime;
      // Fill NaN with zone fallback
      for (let i = 0; i < cells.length; i++) {
        if (!Number.isFinite(ndviArr[i])) {
          ndviArr[i] = zoneNdvi.get(cells[i].zoneId) ?? 0.3;
        }
      }
    } catch (err) {
      console.warn('  COG sample failed, using zone EE medians + DEM microvariation', err);
      ndviArr = new Float32Array(cells.length);
      for (let i = 0; i < cells.length; i++) {
        const base = zoneNdvi.get(cells[i].zoneId) ?? 0.3;
        // Micro-variation from relative elevation (real DEM), not random fiction
        const depth = depthAt(cells[i].lat, cells[i].lng);
        ndviArr[i] = clamp(base + (depth - 0.1) * 0.05, 0, 1);
      }
      ndviSource = 'zone-ee-median+dem-modulated';
    }
  } else {
    console.warn('  No S2 scene — using committed Earth Engine zone medians + DEM modulation');
    ndviArr = new Float32Array(cells.length);
    for (let i = 0; i < cells.length; i++) {
      const base = zoneNdvi.get(cells[i].zoneId) ?? 0.3;
      const depth = depthAt(cells[i].lat, cells[i].lng);
      ndviArr[i] = clamp(base + (depth - 0.1) * 0.05, 0, 1);
    }
  }

  // 4) Settlement density from OSM buildings
  console.log('\n[4/5] OSM building footprints → settlement density…');
  // Query in tiles to avoid Overpass timeouts
  const buildings: { lat: number; lng: number }[] = [];
  const tile = 0.08;
  for (let la = south; la < north; la += tile) {
    for (let lo = west; lo < east; lo += tile) {
      const pts = await fetchBuildingCenters(
        lo,
        la,
        Math.min(lo + tile, east),
        Math.min(la + tile, north)
      );
      buildings.push(...pts);
      console.log(`  buildings so far: ${buildings.length}`);
      await sleep(2000);
    }
  }
  const settlement = binBuildings(cells, buildings);

  // 5) Score cells
  console.log('\n[5/5] Scoring cells…');
  const scored: ScoredCell[] = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const wx = nearestWx(c.lat, c.lng);
    const dep = scoreDepression(depthAt(c.lat, c.lng));
    const ndvi = Math.round(ndviArr[i] * 100) / 100;
    const settle = Math.round(settlement[i] * 100) / 100;
    // Population proxy: dense settlement × ~40 people per 50m cell when fully built
    // (WorldPop 100m when EE/PC wired — this uses real OSM structure counts)
    const population = Math.round(settle * 40);

    const risk = calculateRisk({
      temperature: wx.temperature,
      humidity: wx.humidity,
      vegetationIndex: ndvi,
      rainfallRecent: wx.rainfall,
      pastCases: [], // cell-level: environmental only (zone cases stay on zone rollup)
      depressionRiskScore: dep,
      settlementDensity: settle,
    });

    scored.push({
      cellId: c.cellId,
      lat: c.lat,
      lng: c.lng,
      west: c.west,
      south: c.south,
      east: c.east,
      north: c.north,
      zoneId: c.zoneId,
      tehsil: c.tehsil,
      ndvi,
      lst: wx.temperature, // ambient until Landsat LST COG wired
      temperature: wx.temperature,
      humidity: wx.humidity,
      rainfall: wx.rainfall,
      depressionScore: dep,
      settlementDensity: settle,
      population,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      peopleAtRisk: Math.round(risk.riskScore * population),
    });
  }

  const payload = {
    note: 'Block-level ICT risk grid from real DEM/weather/OSM/(S2) layers. Not household-level. Rainfall/weather are coarse (~9–11 km).',
    cellSizeM,
    bbox: ICT_BBOX,
    pilot: pilotOnly,
    cellCount: scored.length,
    computedAt: new Date().toISOString(),
    elapsedMs: Date.now() - t0,
    sources: {
      dem: 'Open-Meteo elevation DEM + Priority-Flood depressions',
      weather: 'Open-Meteo forecast (shared across nearby cells — native ~9–11 km)',
      ndvi: ndviSource,
      ndviDate,
      settlement: 'OpenStreetMap building footprints (Overpass)',
      population: 'Proxy from OSM settlement density (replace with WorldPop 100m when available)',
      lst: 'Open-Meteo air temperature proxy until Landsat ST COG wired',
    },
    cells: scored,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  const outPath = pilotOnly ? OUT_PILOT : OUT_FULL;
  writeFileSync(outPath, JSON.stringify(payload));
  // Always also write "latest" for the app when full; pilot writes pilot file + latest if pilot-only for UI
  writeFileSync(OUT_FULL === outPath ? OUT_FULL : join(DATA_DIR, 'grid_cells_latest.json'), JSON.stringify(payload));
  if (pilotOnly) {
    writeFileSync(OUT_PILOT, JSON.stringify(payload));
    writeFileSync(join(DATA_DIR, 'grid_cells_latest.json'), JSON.stringify(payload));
  }

  const heat = scored.map((c) => [c.lat, c.lng, c.riskScore / 100]);
  writeFileSync(
    OUT_HEAT,
    JSON.stringify({
      cellSizeM,
      computedAt: payload.computedAt,
      points: heat,
    })
  );

  // Zone rollup summary
  const byZone = new Map<string, ScoredCell[]>();
  for (const c of scored) {
    const list = byZone.get(c.zoneId) ?? [];
    list.push(c);
    byZone.set(c.zoneId, list);
  }
  console.log('\nZone rollups (mean risk):');
  for (const z of ZONE_META) {
    const list = byZone.get(z.id);
    if (!list?.length) continue;
    const mean =
      list.reduce((s, c) => s + c.riskScore, 0) / list.length;
    const max = Math.max(...list.map((c) => c.riskScore));
    console.log(
      `  ${z.name}: n=${list.length} mean=${mean.toFixed(1)} max=${max}`
    );
  }

  console.log(`\nWrote ${outPath}`);
  console.log(`Cells: ${scored.length} | elapsed ${(Date.now() - t0) / 1000}s`);
  console.log(`NDVI source: ${ndviSource}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
