/**
 * Free per-block satellite sampling via Element84 / Planetary Computer STAC + COG.
 * No Earth Engine, no Sentinel Hub key.
 *
 * Strategy: download full band COGs once (curl, resumable) then sample locally.
 * Remote range-reads via geotiff.fromUrl are unreliable on flaky S3 links.
 *
 * NDVI: Sentinel-2 L2A (red + nir) — Element84 HTTPS COGs (EPSG:32643)
 * LST: Landsat C2 L2 ST — Planetary Computer signed HTTPS
 */

// @ts-nocheck — geotiff ReadRastersOptions typings omit bbox window overloads
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromFile } from 'geotiff';

export const STAC_SEARCH = 'https://earth-search.aws.element84.com/v1/search';
/** Planetary Computer — Landsat assets are signed HTTPS (Element84 returns s3:// only). */
export const PC_STAC_SEARCH =
  'https://planetarycomputer.microsoft.com/api/stac/v1/search';
export const PC_SAS_SIGN =
  'https://planetarycomputer.microsoft.com/api/sas/v1/sign';

const COG_CACHE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'cogs'
);

export interface StacAssetScene {
  id: string;
  datetime: string;
  cloudCover: number | null;
  href: string;
  /** Extra band for NDVI pair */
  href2?: string;
}

export interface CellSamplePoint {
  cellId: string;
  lat: number;
  lng: number;
  west: number;
  south: number;
  east: number;
  north: number;
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

/** WGS84 → UTM zone (meters). Zone inferred from longitude when zone omitted. */
export function wgs84ToUtm(
  lng: number,
  lat: number,
  zone?: number
): { x: number; y: number; zone: number } {
  const z = zone ?? Math.floor((lng + 180) / 6) + 1;
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e = Math.sqrt(f * (2 - f));
  const e2 = e * e;
  const ep2 = e2 / (1 - e2);
  const lon0 = (((z - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const latR = (lat * Math.PI) / 180;
  const lonR = (lng * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(latR) * Math.sin(latR));
  const T = Math.tan(latR) * Math.tan(latR);
  const C = ep2 * Math.cos(latR) * Math.cos(latR);
  const A = Math.cos(latR) * (lonR - lon0);
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * latR -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(2 * latR) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * latR) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * latR));
  const x =
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A * A * A * A * A) / 120) +
    500000.0;
  const y =
    k0 *
    (M +
      N *
        Math.tan(latR) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A * A * A * A * A * A) /
            720));
  return { x, y, zone: z };
}

/** Convert s3://bucket/key → https virtual-hosted URL (geotiff/curl reject s3://). */
export function httpsFromStacHref(href: string): string {
  if (!href) return href;
  if (href.startsWith('https://') || href.startsWith('http://')) return href;
  const m = href.match(/^s3:\/\/([^/]+)\/(.+)$/i);
  if (m) {
    const bucket = m[1];
    const key = m[2];
    if (bucket.includes('.')) return `https://${bucket}/${key}`;
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }
  return href;
}

function featureCoversPoint(
  f: { bbox?: number[] },
  lng: number,
  lat: number
): boolean {
  const bb = f.bbox;
  if (bb && bb.length >= 4) {
    return lng >= bb[0] && lat >= bb[1] && lng <= bb[2] && lat <= bb[3];
  }
  return true;
}

type StacFeature = {
  id: string;
  bbox?: number[];
  properties: {
    datetime?: string;
    'eo:cloud_cover'?: number;
  };
  assets: Record<string, { href?: string }>;
};

async function stacSearch(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ features: StacFeature[] }> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/geo+json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`STAC search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

function cloudOf(f: StacFeature): number {
  const c = f.properties['eo:cloud_cover'];
  return typeof c === 'number' ? c : 100;
}

function bboxCenter(bbox: [number, number, number, number]): {
  lng: number;
  lat: number;
} {
  return {
    lng: (bbox[0] + bbox[2]) / 2,
    lat: (bbox[1] + bbox[3]) / 2,
  };
}

async function signPlanetaryComputerHref(href: string): Promise<string> {
  const https = httpsFromStacHref(href);
  if (https.includes('blob.core.windows.net') && https.includes('?')) {
    return https;
  }
  const u = `${PC_SAS_SIGN}?href=${encodeURIComponent(https)}`;
  const res = await fetch(u);
  if (!res.ok) {
    throw new Error(`PC SAS sign ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  const j = (await res.json()) as { href?: string };
  if (!j.href) throw new Error('PC SAS sign returned no href');
  return j.href;
}

/** Cache key ignores SAS querystring so re-signed URLs hit the same file. */
function cogCachePath(url: string, label: string): string {
  const bare = url.split('?')[0];
  const base = bare.split('/').pop() || 'band.tif';
  const hash = createHash('sha1').update(bare).digest('hex').slice(0, 10);
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return join(COG_CACHE, `${label}_${hash}_${safe}`);
}

function runCurl(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('curl.exe', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl exited ${code}`));
    });
  });
}

/**
 * Download a COG with curl (resumable). Range-request sampling over S3 is flaky
 * from many networks; a one-shot download is more reliable.
 */
export async function ensureLocalCog(
  url: string,
  label: string
): Promise<string> {
  mkdirSync(COG_CACHE, { recursive: true });
  const dest = cogCachePath(url, label);
  if (existsSync(dest) && statSync(dest).size > 1_000_000) {
    console.log(
      `  ${label}: cache hit ${dest} (${Math.round(statSync(dest).size / 1e6)} MB)`
    );
    return dest;
  }

  console.log(`  ${label}: downloading COG → ${dest}`);
  const tmp = `${dest}.partial`;
  // -C - resume; -L follow redirects; --retry for flaky links
  const args = [
    '-L',
    '--fail',
    '--retry',
    '8',
    '--retry-delay',
    '3',
    '--retry-all-errors',
    '-C',
    '-',
    '--connect-timeout',
    '60',
    '--max-time',
    '0',
    '-o',
    tmp,
    url,
  ];
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await runCurl(args);
      // atomic-ish rename
      const { renameSync } = await import('node:fs');
      if (existsSync(dest)) {
        try {
          renameSync(dest, `${dest}.bak`);
        } catch {
          /* ignore */
        }
      }
      renameSync(tmp, dest);
      console.log(
        `  ${label}: downloaded ${Math.round(statSync(dest).size / 1e6)} MB`
      );
      return dest;
    } catch (err) {
      lastErr = err;
      console.warn(`  ${label}: download attempt ${attempt}/4 failed`, (err as Error).message);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

/** Best low-cloud Sentinel-2 L2A scene covering the bbox center (HTTPS COGs). */
export async function findSentinel2Scene(
  bbox: [number, number, number, number],
  daysBack = 120
): Promise<StacAssetScene | null> {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 86400000);
  const { lng, lat } = bboxCenter(bbox);
  const json = await stacSearch(STAC_SEARCH, {
    collections: ['sentinel-2-l2a'],
    bbox,
    datetime: `${start.toISOString()}/${end.toISOString()}`,
    limit: 80,
    query: { 'eo:cloud_cover': { lt: 45 } },
  });

  const features = [...(json.features ?? [])]
    .filter((f) => featureCoversPoint(f, lng, lat))
    .sort((a, b) => cloudOf(a) - cloudOf(b));

  const ranked = [
    ...features.filter((f) => /43SCT|43SBU/i.test(f.id)),
    ...features.filter((f) => !/43SCT|43SBU/i.test(f.id)),
  ];

  for (const f of ranked) {
    const red = f.assets.red?.href ?? f.assets.B04?.href;
    const nir = f.assets.nir?.href ?? f.assets.B08?.href;
    if (red && nir) {
      return {
        id: f.id,
        datetime: f.properties.datetime ?? '',
        cloudCover: f.properties['eo:cloud_cover'] ?? null,
        href: httpsFromStacHref(red),
        href2: httpsFromStacHref(nir),
      };
    }
  }
  return null;
}

/**
 * Landsat C2 L2 surface-temperature COG via Planetary Computer (signed HTTPS).
 */
export async function findLandsatLstScene(
  bbox: [number, number, number, number],
  daysBack = 180
): Promise<StacAssetScene | null> {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 86400000);
  const { lng, lat } = bboxCenter(bbox);
  const json = await stacSearch(PC_STAC_SEARCH, {
    collections: ['landsat-c2-l2'],
    bbox,
    datetime: `${start.toISOString()}/${end.toISOString()}`,
    limit: 40,
    query: { 'eo:cloud_cover': { lt: 40 } },
  });

  const features = [...(json.features ?? [])]
    .filter((f) => featureCoversPoint(f, lng, lat))
    .sort((a, b) => cloudOf(a) - cloudOf(b));

  for (const f of features) {
    const st =
      f.assets.lwir11?.href ??
      f.assets.ST_B10?.href ??
      f.assets.st_b10?.href ??
      f.assets['lwir11']?.href;
    if (!st) continue;
    try {
      const signed = await signPlanetaryComputerHref(st);
      return {
        id: f.id,
        datetime: f.properties.datetime ?? '',
        cloudCover: f.properties['eo:cloud_cover'] ?? null,
        href: signed,
      };
    } catch (err) {
      console.warn('  PC sign failed for', f.id, (err as Error)?.message);
    }
  }
  return null;
}

function utmZoneFromEpsg(epsg: number | undefined): number | null {
  if (!epsg) return null;
  if (epsg >= 32601 && epsg <= 32660) return epsg - 32600;
  if (epsg >= 32701 && epsg <= 32760) return epsg - 32700;
  return null;
}

/** Sample a local COG at each cell center (one window read — fast). */
async function sampleBandAtCells(
  cogUrl: string,
  cells: CellSamplePoint[],
  options: {
    scale?: (raw: number) => number;
    metersPerPixel?: number;
    label?: string;
  } = {}
): Promise<Float64Array> {
  const scale = options.scale ?? ((v) => v);
  const mpp = options.metersPerPixel ?? 40;
  const label = options.label ?? 'band';

  const localPath = await ensureLocalCog(cogUrl, label);
  console.log(`  Opening local COG (${label})…`);
  const tiff = await fromFile(localPath);
  const image = await tiff.getImage();
  const geo = image.getGeoKeys?.() ?? {};
  const epsg = geo.ProjectedCSTypeGeoKey as number | undefined;
  const zone = utmZoneFromEpsg(epsg) ?? 43;
  const imgBb = image.getBoundingBox() as [number, number, number, number];
  const isProjected = Boolean(epsg && epsg > 32600);

  console.log(
    `  ${label}: EPSG:${epsg ?? '?'} zone ${zone} · image [${imgBb.map((n) => Math.round(n)).join(', ')}]`
  );

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const xy: Array<{ x: number; y: number }> = new Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (isProjected) {
      const p = wgs84ToUtm(c.lng, c.lat, zone);
      xy[i] = { x: p.x, y: p.y };
      west = Math.min(west, p.x);
      east = Math.max(east, p.x);
      south = Math.min(south, p.y);
      north = Math.max(north, p.y);
    } else {
      xy[i] = { x: c.lng, y: c.lat };
      west = Math.min(west, c.lng);
      east = Math.max(east, c.lng);
      south = Math.min(south, c.lat);
      north = Math.max(north, c.lat);
    }
  }

  const pad = mpp * 2;
  west = Math.max(imgBb[0], west - pad);
  south = Math.max(imgBb[1], south - pad);
  east = Math.min(imgBb[2], east + pad);
  north = Math.min(imgBb[3], north + pad);

  const out = new Float64Array(cells.length);
  out.fill(Number.NaN);
  if (east <= west || north <= south) {
    console.warn(`  ${label}: request window outside COG — all NaN`);
    return out;
  }

  const width = clamp(Math.ceil((east - west) / mpp), 8, 4096);
  const height = clamp(Math.ceil((north - south) / mpp), 8, 4096);
  console.log(
    `  ${label}: reading ${width}×${height} @ ~${mpp}m from local file…`
  );

  const rasters = await image.readRasters({
    bbox: [west, south, east, north],
    width,
    height,
    resampleMethod: 'bilinear',
  });

  const band = rasters[0] as Float32Array | Uint16Array | Int16Array;
  const rw = rasters.width as number;
  const rh = rasters.height as number;

  let hits = 0;
  for (let i = 0; i < cells.length; i++) {
    const { x, y } = xy[i];
    if (x < west || x > east || y < south || y > north) continue;
    const px = clamp(Math.floor(((x - west) / (east - west)) * (rw - 1)), 0, rw - 1);
    const py = clamp(Math.floor(((north - y) / (north - south)) * (rh - 1)), 0, rh - 1);
    const raw = Number(band[py * rw + px]);
    if (!Number.isFinite(raw) || raw === 0) continue;
    out[i] = scale(raw);
    hits++;
  }
  console.log(`  ${label}: ${hits}/${cells.length} finite samples`);
  return out;
}

/** Sample NDVI at each cell center from Sentinel-2 red+nir COGs. */
export async function sampleNdviPerCell(
  cells: CellSamplePoint[],
  scene: StacAssetScene
): Promise<Float64Array> {
  if (!scene.href2) throw new Error('Sentinel scene missing nir band');
  const red = await sampleBandAtCells(scene.href, cells, {
    label: 'S2_red',
    metersPerPixel: 40,
    scale: (v) => (v > 1 ? v / 10000 : v),
  });
  const nir = await sampleBandAtCells(scene.href2, cells, {
    label: 'S2_nir',
    metersPerPixel: 40,
    scale: (v) => (v > 1 ? v / 10000 : v),
  });

  const out = new Float64Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const r = red[i];
    const n = nir[i];
    if (!Number.isFinite(r) || !Number.isFinite(n)) {
      out[i] = Number.NaN;
      continue;
    }
    const den = n + r;
    out[i] = den > 0 ? clamp((n - r) / den, -0.2, 1) : Number.NaN;
  }
  return out;
}

/**
 * Landsat C2 L2 surface temperature → °C.
 * Collection-2 ST: Kelvin = DN * 0.00341802 + 149.0
 */
export async function sampleLstPerCell(
  cells: CellSamplePoint[],
  scene: StacAssetScene
): Promise<Float64Array> {
  return sampleBandAtCells(scene.href, cells, {
    label: 'Landsat_ST',
    metersPerPixel: 30,
    scale: (dn) => {
      let k = dn;
      if (!(dn > 200 && dn < 400)) {
        k = dn * 0.00341802 + 149.0;
      }
      const c = k - 273.15;
      if (c < -40 || c > 80) return Number.NaN;
      return c;
    },
  });
}

export function countFinite(arr: Float64Array): number {
  let n = 0;
  for (let i = 0; i < arr.length; i++) if (Number.isFinite(arr[i])) n++;
  return n;
}
