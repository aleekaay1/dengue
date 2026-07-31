import { useCallback, useEffect, useState } from 'react';
import type { CityConditions, ZoneData } from '../types';
import type { InitialDashboardData } from '../types/ssr';
import { createClient } from '@supabase/supabase-js';
import { loadDashboardFromSupabase } from '../../lib/loadDashboard';

export interface FreshnessInfo {
  weatherAsOf: string | null;
  weatherLagged: boolean;
  vegetationAsOf: string | null;
  dengueAsOf: string | null;
  dengueStale: boolean;
  dengueScrapeOk: boolean;
  dengueScrapeError?: string;
  weatherErrors: Record<string, string>;
  vegetationErrors: Record<string, string>;
}

export interface DashboardState {
  zones: ZoneData[];
  cityConditions: CityConditions | null;
  freshness: FreshnessInfo | null;
  mode: 'supabase' | 'live-build' | null;
  loading: boolean;
  error: string | null;
  builtAt: string | null;
  reload: (opts?: { live?: boolean; refresh?: boolean }) => Promise<void>;
}

function supabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}

async function fetchViaApi(opts?: {
  live?: boolean;
  refresh?: boolean;
}): Promise<InitialDashboardData> {
  const params = new URLSearchParams();
  if (opts?.live) params.set('live', '1');
  if (opts?.refresh) params.set('refresh', '1');
  const qs = params.toString();
  const res = await fetch(`/api/dashboard${qs ? `?${qs}` : ''}`);
  const text = await res.text();
  let data: Partial<InitialDashboardData> & { error?: string };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(
      `Dashboard API returned non-JSON (${res.status}): ${text.slice(0, 120)}`
    );
  }
  if (!res.ok) {
    throw new Error(data.error || `Dashboard request failed (${res.status})`);
  }
  if (
    !data.zones ||
    !data.cityConditions ||
    !data.freshness ||
    !data.mode ||
    !data.builtAt
  ) {
    throw new Error('Dashboard API returned an incomplete payload');
  }
  return data as InitialDashboardData;
}

export function useDashboardData(
  initialData?: InitialDashboardData | null
): DashboardState {
  const hasInitial = Boolean(
    initialData?.zones?.length && initialData.cityConditions
  );

  const [zones, setZones] = useState<ZoneData[]>(initialData?.zones ?? []);
  const [cityConditions, setCityConditions] = useState<CityConditions | null>(
    initialData?.cityConditions ?? null
  );
  const [freshness, setFreshness] = useState<FreshnessInfo | null>(
    initialData?.freshness ?? null
  );
  const [mode, setMode] = useState<'supabase' | 'live-build' | null>(
    initialData?.mode ?? null
  );
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState<string | null>(null);
  const [builtAt, setBuiltAt] = useState<string | null>(
    initialData?.builtAt ?? null
  );

  const reload = useCallback(
    async (opts?: { live?: boolean; refresh?: boolean; soft?: boolean }) => {
      if (!opts?.soft) {
        setLoading(true);
      }
      setError(null);
      try {
        if (supabaseConfigured() && !opts?.live) {
          try {
            const supabase = createClient(
              import.meta.env.VITE_SUPABASE_URL,
              import.meta.env.VITE_SUPABASE_ANON_KEY
            );
            const payload = await loadDashboardFromSupabase(supabase);
            setZones(payload.zones);
            setCityConditions(payload.cityConditions);
            setFreshness(payload.freshness);
            setMode('supabase');
            setBuiltAt(payload.builtAt);
            return;
          } catch (sbErr) {
            console.warn(
              '[useDashboardData] Supabase load failed, falling back to /api/dashboard',
              sbErr
            );
          }
        }

        const payload = await fetchViaApi({
          live: opts?.live ?? !supabaseConfigured(),
          refresh: opts?.refresh,
        });
        setZones(payload.zones);
        setCityConditions(payload.cityConditions);
        setFreshness(payload.freshness);
        setMode(payload.mode);
        setBuiltAt(payload.builtAt);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load dashboard data'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (hasInitial) {
      // Soft revalidate after hydration — keep SSR content visible
      void reload({ soft: true });
      return;
    }
    void reload();
  }, [hasInitial, reload]);

  return {
    zones,
    cityConditions,
    freshness,
    mode,
    loading,
    error,
    builtAt,
    reload,
  };
}
