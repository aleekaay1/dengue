/**
 * True per-block Sentinel-2 NDVI + Landsat LST — free Element84 STAC/COG.
 * No Earth Engine Console, no Sentinel Hub key.
 *
 *   npm run grid:sentinel:pilot   # capital urban bbox (faster)
 *   npm run grid:sentinel         # full ICT influence grid (~78k cells)
 *
 * Writes data/cell_satellite.json then you rebuild:
 *   npm run grid:fast:full && npm run grid:pack
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildIctGrid,
  CAPITAL_PILOT_BBOX,
  filterPilotCells,
  ICT_BBOX,
  type GridCellMeta,
} from '../lib/gridMeta.js';
import {
  countFinite,
  findLandsatLstScene,
  findSentinel2Scene,
  sampleLstPerCell,
  sampleNdviPerCell,
  type CellSamplePoint,
} from '../lib/stacSatellite.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data');
const OUT = join(DATA, 'cell_satellite.json');

function toPoints(cells: GridCellMeta[]): CellSamplePoint[] {
  return cells.map((c) => ({
    cellId: c.cellId,
    lat: c.lat,
    lng: c.lng,
    west: c.west,
    south: c.south,
    east: c.east,
    north: c.north,
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const capitalOnly = args.includes('--capital') || args.includes('--pilot-capital');
  const zonePilot = args.includes('--pilot'); // F-6 + G-9 only
  const t0 = Date.now();

  mkdirSync(DATA, { recursive: true });
  let { cells } = buildIctGrid();
  if (zonePilot) cells = filterPilotCells(cells);
  if (capitalOnly) {
    const b = CAPITAL_PILOT_BBOX;
    cells = cells.filter(
      (c) =>
        c.lng >= b.west &&
        c.lng <= b.east &&
        c.lat >= b.south &&
        c.lat <= b.north
    );
  }

  // STAC bbox from actual cells (not full ICT) so we pick the right MGRS / Landsat path-row.
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const c of cells) {
    west = Math.min(west, c.west);
    south = Math.min(south, c.south);
    east = Math.max(east, c.east);
    north = Math.max(north, c.north);
  }
  if (capitalOnly) {
    west = Math.max(west, CAPITAL_PILOT_BBOX.west);
    south = Math.max(south, CAPITAL_PILOT_BBOX.south);
    east = Math.min(east, CAPITAL_PILOT_BBOX.east);
    north = Math.min(north, CAPITAL_PILOT_BBOX.north);
  } else if (!zonePilot) {
    west = Math.max(west, ICT_BBOX.west);
    south = Math.max(south, ICT_BBOX.south);
    east = Math.min(east, ICT_BBOX.east);
    north = Math.min(north, ICT_BBOX.north);
  }
  const bbox: [number, number, number, number] = [west, south, east, north];

  console.log(
    `Sampling ${cells.length} cells · bbox ${bbox.map((n) => n.toFixed(4)).join(',')} · free STAC/COG`
  );

  const points = toPoints(cells);

  // ── Sentinel-2 NDVI ──
  console.log('\n[1/2] Sentinel-2 NDVI (Earth Search)…');
  const s2 = await findSentinel2Scene(bbox);
  if (!s2) throw new Error('No suitable Sentinel-2 scene found');
  console.log(
    `  Scene ${s2.id} · ${s2.datetime} · cloud ${s2.cloudCover ?? '?'}%`
  );
  const ndviArr = await sampleNdviPerCell(points, s2);
  const ndviOk = countFinite(ndviArr);
  console.log(`  NDVI finite: ${ndviOk}/${cells.length}`);

  // ── Landsat LST ──
  console.log('\n[2/2] Landsat surface temperature (Earth Search)…');
  let lstArr = new Float64Array(cells.length);
  lstArr.fill(Number.NaN);
  let lstSceneId: string | null = null;
  let lstDate: string | null = null;
  let lstOk = 0;
  try {
    const ls = await findLandsatLstScene(bbox);
    if (!ls) {
      console.warn('  No Landsat ST scene — NDVI-only file will be written');
    } else {
      console.log(
        `  Scene ${ls.id} · ${ls.datetime} · cloud ${ls.cloudCover ?? '?'}%`
      );
      lstArr = await sampleLstPerCell(points, ls);
      lstOk = countFinite(lstArr);
      lstSceneId = ls.id;
      lstDate = ls.datetime;
      console.log(`  LST finite: ${lstOk}/${cells.length}`);
    }
  } catch (err) {
    console.warn('  Landsat sample failed', err);
  }

  // Merge with previous file so --capital runs don't wipe rural cells
  type CellSat = { ndvi: number | null; lst: number | null };
  const byId: Record<string, CellSat> = {};
  if (existsSync(OUT) && (capitalOnly || zonePilot)) {
    try {
      const prev = JSON.parse(readFileSync(OUT, 'utf8')) as {
        cells?: Record<string, CellSat>;
      };
      Object.assign(byId, prev.cells ?? {});
      console.log(`  Merging into existing ${Object.keys(byId).length} cells`);
    } catch {
      /* fresh */
    }
  }

  for (let i = 0; i < cells.length; i++) {
    const ndvi = Number.isFinite(ndviArr[i])
      ? Math.round(ndviArr[i] * 1000) / 1000
      : null;
    const lst = Number.isFinite(lstArr[i])
      ? Math.round(lstArr[i] * 10) / 10
      : null;
    const prev = byId[cells[i].cellId];
    byId[cells[i].cellId] = {
      ndvi: ndvi ?? prev?.ndvi ?? null,
      lst: lst ?? prev?.lst ?? null,
    };
  }

  const payload = {
    note: 'Per-block satellite samples from free Element84 Earth Search STAC + COG. No Earth Engine.',
    computedAt: new Date().toISOString(),
    elapsedMs: Date.now() - t0,
    scope: capitalOnly ? 'capital-pilot' : zonePilot ? 'zone-pilot' : 'ict-full',
    cellCount: Object.keys(byId).length,
    sampledThisRun: cells.length,
    ndviFiniteThisRun: ndviOk,
    lstFiniteThisRun: lstOk,
    sources: {
      ndvi: 'sentinel-2-l2a (Element84 earth-search + COG)',
      ndviScene: s2.id,
      ndviDate: s2.datetime,
      ndviCloudCover: s2.cloudCover,
      lst: lstSceneId
        ? 'landsat-c2-l2 surface temperature (Planetary Computer signed COG)'
        : null,
      lstScene: lstSceneId,
      lstDate,
    },
    cells: byId,
  };

  writeFileSync(OUT, JSON.stringify(payload));
  console.log(`\nWrote ${OUT}`);
  console.log(`Total cells in file: ${payload.cellCount}`);
  console.log(`Elapsed ${(Date.now() - t0) / 1000}s`);
  console.log('\nNext: npm run grid:fast:full && npm run grid:pack');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
