import type { CityConditions, ZoneData } from '../types';
import type { FreshnessInfo } from '../hooks/useDashboardData';

export interface InitialDashboardData {
  zones: ZoneData[];
  cityConditions: CityConditions;
  freshness: FreshnessInfo;
  mode: 'supabase' | 'live-build';
  builtAt: string;
}

declare global {
  interface Window {
    __INITIAL_DATA__?: InitialDashboardData | null;
  }
}

export {};
