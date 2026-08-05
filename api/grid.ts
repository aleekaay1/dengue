import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  cellsInBbox,
  loadGridCells,
  nearestCell,
} from '../lib/api/gridCells.js';
import {
  cellsInBboxFromSupabase,
  gridSummaryFromSupabase,
  heatPointsFromSupabase,
  nearestCellFromSupabase,
} from '../lib/api/gridFromSupabase.js';
import { GRID_CELL_SIZE_M } from '../lib/gridMeta.js';
import { createReadClient, isSupabaseConfigured } from '../lib/supabase.js';
import { sendJson } from './_http.js';

/**
 * GET /api/grid
 * Prefers Supabase cached cells (real refresh output). Falls back to offline pack.
 *   ?bbox=west,south,east,north
 *   ?lat=&lng=
 *   ?summary=1
 *   ?heat=1
 */
export async function handleGridRequest(url: URL): Promise<{
  status: number;
  body: unknown;
}> {
  const useSb = isSupabaseConfigured();
  let sbCount = 0;
  if (useSb) {
    try {
      const sb = createReadClient();
      const summary = await gridSummaryFromSupabase(sb);
      sbCount = summary.cellCount;

      if (url.searchParams.get('summary') === '1') {
        if (sbCount > 0) {
          return {
            status: 200,
            body: {
              source: 'supabase',
              cellSizeM: summary.cellSizeM,
              cellCount: summary.cellCount,
              computedAt: summary.computedAt,
              pilot: false,
              sources: {
                weather: 'open-meteo (on refresh)',
                ndvi: 'earth-engine zone medians',
                dem: 'terrain depression seed',
              },
            },
          };
        }
      }

      if (sbCount > 0) {
        if (url.searchParams.get('heat') === '1') {
          const heat = await heatPointsFromSupabase(sb);
          return {
            status: 200,
            body: {
              source: 'supabase',
              cellSizeM: GRID_CELL_SIZE_M,
              computedAt: heat.computedAt,
              count: heat.count,
              points: heat.points,
            },
          };
        }

        const lat = Number(url.searchParams.get('lat'));
        const lng = Number(url.searchParams.get('lng'));
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const cell = await nearestCellFromSupabase(sb, lat, lng);
          if (!cell) return { status: 404, body: { error: 'No grid cell nearby' } };
          return {
            status: 200,
            body: { source: 'supabase', cell, cellSizeM: GRID_CELL_SIZE_M },
          };
        }

        const bboxRaw = url.searchParams.get('bbox');
        if (bboxRaw) {
          const parts = bboxRaw.split(',').map(Number);
          if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
            return {
              status: 400,
              body: { error: 'bbox must be west,south,east,north' },
            };
          }
          const [west, south, east, north] = parts;
          const max = Number(url.searchParams.get('limit') ?? 8000);
          const { cells, computedAt } = await cellsInBboxFromSupabase(
            sb,
            { west, south, east, north },
            max
          );
          return {
            status: 200,
            body: {
              source: 'supabase',
              cellSizeM: GRID_CELL_SIZE_M,
              computedAt,
              count: cells.length,
              cells,
            },
          };
        }

        // Default compact heat
        const heat = await heatPointsFromSupabase(sb);
        return {
          status: 200,
          body: {
            source: 'supabase',
            cellSizeM: GRID_CELL_SIZE_M,
            computedAt: heat.computedAt,
            cellCount: heat.count,
            count: heat.count,
            points: heat.points,
          },
        };
      }
    } catch (err) {
      console.warn('[api/grid] Supabase read failed, using file pack', err);
    }
  }

  // Filesystem fallback (committed offline pack)
  const grid = loadGridCells();

  if (url.searchParams.get('summary') === '1') {
    return {
      status: 200,
      body: {
        source: 'file',
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
    return {
      status: 200,
      body: { source: 'file', cell, cellSizeM: grid.cellSizeM },
    };
  }

  if (url.searchParams.get('heat') === '1') {
    const points = grid.cells
      .filter((_, i) => i % 5 === 0)
      .map(
        (c) =>
          [c.lat, c.lng, Math.max(0.12, (c.riskScore / 100) * 1.25)] as [
            number,
            number,
            number,
          ]
      );
    return {
      status: 200,
      body: {
        source: 'file',
        cellSizeM: grid.cellSizeM,
        computedAt: grid.computedAt,
        count: grid.cellCount,
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
    const max = Number(url.searchParams.get('limit') ?? 8000);
    if (cells.length > max) {
      const step = Math.ceil(cells.length / max);
      cells = cells.filter((_, i) => i % step === 0);
    }
    return {
      status: 200,
      body: {
        source: 'file',
        cellSizeM: grid.cellSizeM,
        computedAt: grid.computedAt,
        count: cells.length,
        cells,
      },
    };
  }

  return {
    status: 200,
    body: {
      source: 'file',
      cellSizeM: grid.cellSizeM,
      computedAt: grid.computedAt,
      pilot: grid.pilot,
      cellCount: grid.cellCount,
      sources: grid.sources,
      points: grid.cells
        .filter((_, i) => i % 5 === 0)
        .map((c) => [
          c.lat,
          c.lng,
          Math.max(0.12, (c.riskScore / 100) * 1.25),
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
