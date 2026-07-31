import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDashboard } from '../lib/buildDashboard.js';
import { createServiceClient, isSupabaseConfigured } from '../lib/supabase.js';
import { loadDashboardFromSupabase } from '../lib/loadDashboard.js';
import { createClient } from '@supabase/supabase-js';
import { sendJson } from './_http.js';

/**
 * GET /api/dashboard
 * Prefers Supabase when configured; otherwise builds live from external APIs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const forceLive = req.query.live === '1';

    if (!forceLive && isSupabaseConfigured()) {
      try {
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
        const key =
          process.env.VITE_SUPABASE_ANON_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(url, key);
        const payload = await loadDashboardFromSupabase(supabase);
        sendJson(res, 200, { ...payload, mode: 'supabase' });
        return;
      } catch (sbErr) {
        console.warn(
          '[api/dashboard] Supabase load failed, falling back to live build',
          sbErr
        );
      }
    }

    const payload = await buildDashboard({
      bypassCache: req.query.refresh === '1',
    });
    sendJson(res, 200, { ...payload, mode: 'live-build' });
  } catch (err) {
    console.error('[api/dashboard]', err);
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Failed to load dashboard',
    });
  }
}

/** Shared handler for Vite middleware. */
export async function handleDashboardRequest(
  url: URL
): Promise<{ status: number; body: unknown }> {
  try {
    const forceLive = url.searchParams.get('live') === '1';
    if (!forceLive && isSupabaseConfigured()) {
      try {
        const payload = await loadDashboardFromSupabase(createServiceClient());
        return { status: 200, body: { ...payload, mode: 'supabase' } };
      } catch {
        // Fall through to live build if DB empty
      }
    }
    const payload = await buildDashboard({
      bypassCache: url.searchParams.get('refresh') === '1',
    });
    return { status: 200, body: { ...payload, mode: 'live-build' } };
  } catch (err) {
    return {
      status: 500,
      body: {
        error: err instanceof Error ? err.message : 'Failed to load dashboard',
      },
    };
  }
}
