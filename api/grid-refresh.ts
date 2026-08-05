import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listZoneIdsForRefresh,
  refreshGridZone,
} from '../lib/refreshGridZone.js';
import {
  createServiceClient,
  hasServiceRole,
  isSupabaseConfigured,
} from '../lib/supabase.js';
import { ZONE_META } from '../lib/zoneMeta.js';
import { sendJson } from './_http.js';

/**
 * Chunked block-grid refresh — one zone per request (real Open-Meteo + EE NDVI/LST).
 *
 * GET  ?action=zones          → ordered zone list for the UI progress loop
 * GET  ?action=status         → cell count + latest computed_at
 * POST ?zone=zone-f6          → analyze that zone and upsert to Supabase
 * POST ?step=0                → same by index into ZONE_META
 */

export async function handleGridRefreshRequest(
  url: URL,
  method: string
): Promise<{ status: number; body: unknown }> {
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return {
      status: 503,
      body: {
        error:
          'Supabase service role required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.',
      },
    };
  }

  const action = url.searchParams.get('action');
  if (method === 'GET' && (action === 'zones' || !action && url.searchParams.get('zones') === '1')) {
    return {
      status: 200,
      body: {
        zones: ZONE_META.map((z, i) => ({
          step: i,
          id: z.id,
          name: z.name,
          tehsil: z.tehsil,
        })),
        count: ZONE_META.length,
      },
    };
  }

  if (method === 'GET' && action === 'status') {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from('grid_cells')
      .select('*', { count: 'exact', head: true });
    const { data } = await supabase
      .from('grid_cells')
      .select('computed_at, zone_id')
      .order('computed_at', { ascending: false })
      .limit(1);
    return {
      status: 200,
      body: {
        cellCount: count ?? 0,
        latestComputedAt: data?.[0]?.computed_at ?? null,
        latestZoneId: data?.[0]?.zone_id ?? null,
        zoneCount: listZoneIdsForRefresh().length,
      },
    };
  }

  if (method !== 'POST' && method !== 'GET') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  // Allow GET with zone= for simple polling tools; prefer POST from UI
  const zoneParam = url.searchParams.get('zone');
  const stepParam = url.searchParams.get('step');
  let zoneId = zoneParam;
  if (!zoneId && stepParam != null) {
    const ids = listZoneIdsForRefresh();
    const step = Number(stepParam);
    if (!Number.isInteger(step) || step < 0 || step >= ids.length) {
      return { status: 400, body: { error: 'Invalid step' } };
    }
    zoneId = ids[step];
  }
  if (!zoneId) {
    return {
      status: 400,
      body: {
        error: 'Provide zone=zone-f6 or step=0 (and action=zones to list)',
      },
    };
  }

  try {
    const supabase = createServiceClient();
    const result = await refreshGridZone(supabase, zoneId);
    const ids = listZoneIdsForRefresh();
    const step = ids.indexOf(zoneId);
    return {
      status: 200,
      body: {
        ok: true,
        ...result,
        step,
        totalSteps: ids.length,
        nextStep: step >= 0 && step < ids.length - 1 ? step + 1 : null,
        nextZoneId: step >= 0 && step < ids.length - 1 ? ids[step + 1] : null,
      },
    };
  } catch (err) {
    console.error('[grid-refresh]', err);
    return {
      status: 500,
      body: {
        ok: false,
        zoneId,
        error: err instanceof Error ? err.message : 'Grid refresh failed',
      },
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/api/grid-refresh', `https://${host}`);
  const result = await handleGridRefreshRequest(url, req.method ?? 'GET');
  sendJson(res, result.status, result.body);
}
