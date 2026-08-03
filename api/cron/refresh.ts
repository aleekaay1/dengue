import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDashboard } from '../../lib/buildDashboard.js';
import { persistDashboard } from '../../lib/persistDashboard.js';
import { createServiceClient, isSupabaseConfigured } from '../../lib/supabase.js';
import { sendJson } from '../_http.js';

function authorize(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization;
  const headerSecret = req.headers['x-cron-secret'];
  if (auth === `Bearer ${secret}`) return true;
  if (typeof headerSecret === 'string' && headerSecret === secret) return true;
  return false;
}

/**
 * GET/POST /api/cron/refresh
 * Daily job: pull weather + vegetation + dengue → score → Supabase.
 *
 * Terrain / standing-water (DEM depressions) is NOT recomputed here — that is a
 * rare offline batch (npm run terrain). buildDashboard only reads the committed seed.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!authorize(req)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  try {
    const payload = await buildDashboard({ bypassCache: true });

    let persisted = false;
    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      await persistDashboard(supabase, payload);
      persisted = true;
    } else {
      console.warn(
        '[cron/refresh] Supabase not configured — built payload but did not persist'
      );
    }

    if (!payload.freshness.dengueScrapeOk) {
      console.error(
        '[cron/refresh] DENGUE SOURCE FAILURE:',
        payload.freshness.dengueScrapeError
      );
    }

    sendJson(res, 200, {
      ok: true,
      persisted,
      zones: payload.zones.length,
      freshness: payload.freshness,
      sample: payload.zones.slice(0, 3).map((z) => ({
        id: z.id,
        name: z.name,
        temperature: z.temperature,
        humidity: z.humidity,
        rainfallRecent: z.rainfallRecent,
        riskScore: z.riskScore,
        lastUpdated: z.lastUpdated,
      })),
      builtAt: payload.builtAt,
    });
  } catch (err) {
    console.error('[cron/refresh]', err);
    sendJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Refresh failed',
    });
  }
}

export async function handleRefreshRequest(
  reqHeaders: Headers
): Promise<{ status: number; body: unknown }> {
  const secret = process.env.CRON_SECRET;
  const auth = reqHeaders.get('authorization');
  const headerSecret = reqHeaders.get('x-cron-secret');
  const ok =
    Boolean(secret) &&
    (auth === `Bearer ${secret}` || headerSecret === secret);

  if (!ok) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  try {
    const payload = await buildDashboard({ bypassCache: true });
    let persisted = false;
    if (isSupabaseConfigured()) {
      await persistDashboard(createServiceClient(), payload);
      persisted = true;
    }
    if (!payload.freshness.dengueScrapeOk) {
      console.error(
        '[cron/refresh] DENGUE SOURCE FAILURE:',
        payload.freshness.dengueScrapeError
      );
    }
    return {
      status: 200,
      body: {
        ok: true,
        persisted,
        zones: payload.zones.length,
        freshness: payload.freshness,
        sample: payload.zones.slice(0, 3).map((z) => ({
          id: z.id,
          name: z.name,
          temperature: z.temperature,
          humidity: z.humidity,
          rainfallRecent: z.rainfallRecent,
          riskScore: z.riskScore,
          lastUpdated: z.lastUpdated,
        })),
        builtAt: payload.builtAt,
      },
    };
  } catch (err) {
    return {
      status: 500,
      body: {
        ok: false,
        error: err instanceof Error ? err.message : 'Refresh failed',
      },
    };
  }
}
