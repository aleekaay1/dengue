import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  cellsInBbox,
  loadGridCells,
  nearestCell,
} from '../lib/api/gridCells.js';
import { sendJson } from './_http.js';

/**
 * GET /api/grid
 *   ?bbox=west,south,east,north  — cells in view (for canvas layer)
 *   ?lat=&lng=                   — single nearest cell detail
 *   ?summary=1                   — counts + sources only
 *   ?heat=1                      — compact [lat,lng,intensity][] for overview
 */
export async function handleGridRequest(url: URL): Promise<{
  status: number;
  body: unknown;
}> {
  const grid = loadGridCells();

  if (url.searchParams.get('summary') === '1') {
    return {
      status: 200,
      body: {
        cellSizeM: grid.cellSizeM,
        cellCount: grid.cellCount,
        computedAt: grid.computedAt,
        pilot: grid.pilot,
        sources: grid.sources,
      },
    };
  }

  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const cell = nearestCell(grid.cells, lat, lng);
    if (!cell) return { status: 404, body: { error: 'No grid cell nearby' } };
    return { status: 200, body: { cell, cellSizeM: grid.cellSizeM } };
  }

  if (url.searchParams.get('heat') === '1') {
    const points = grid.cells.map(
      (c) => [c.lat, c.lng, Math.max(0.05, c.riskScore / 100)] as const
    );
    return {
      status: 200,
      body: {
        cellSizeM: grid.cellSizeM,
        computedAt: grid.computedAt,
        count: points.length,
        points,
      },
    };
  }

  const bboxRaw = url.searchParams.get('bbox');
  if (bboxRaw) {
    const parts = bboxRaw.split(',').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      return { status: 400, body: { error: 'bbox must be west,south,east,north' } };
    }
    const [west, south, east, north] = parts;
    let cells = cellsInBbox(grid.cells, { west, south, east, north });
    // Cap for client safety — prefer denser zoom (caller should use tighter bbox)
    const max = Number(url.searchParams.get('limit') ?? 8000);
    if (cells.length > max) {
      // Thin: keep every Nth by risk so hotspots remain
      const step = Math.ceil(cells.length / max);
      cells = cells.filter((_, i) => i % step === 0);
    }
    return {
      status: 200,
      body: {
        cellSizeM: grid.cellSizeM,
        computedAt: grid.computedAt,
        count: cells.length,
        cells,
      },
    };
  }

  // Default: compact heat for whole grid
  return {
    status: 200,
    body: {
      cellSizeM: grid.cellSizeM,
      computedAt: grid.computedAt,
      pilot: grid.pilot,
      cellCount: grid.cellCount,
      sources: grid.sources,
      points: grid.cells.map((c) => [
        c.lat,
        c.lng,
        Math.max(0.05, c.riskScore / 100),
      ]),
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/api/grid', `https://${host}`);
  const result = await handleGridRequest(url);
  sendJson(res, result.status, result.body);
}
