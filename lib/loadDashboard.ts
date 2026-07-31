/**
 * Load ZoneData[] from Supabase for the frontend (public anon client).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateRisk, defaultPrecautions } from './riskModel';
import type { CityConditions, ZoneData } from '../src/types';
import type { DataFreshness, DashboardPayload } from './buildDashboard';
import { isDengueDataStale } from './api/dengueCases';

interface ZoneRow {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  svg_polygon_path: string;
  svg_label_x: number;
  svg_label_y: number;
  field_officer_note: string | null;
  active_larval_sites: number | null;
}

interface ReadingRow {
  date: string;
  zone_id: string;
  temperature: number;
  humidity: number;
  rainfall: number;
  ndvi: number;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  shade_coverage: number | null;
  weather_as_of: string | null;
  source_meta: {
    weatherAsOf?: string | null;
    weatherLagged?: boolean;
    vegetationAsOf?: string | null;
    dengueAsOf?: string | null;
    dengueScrapeOk?: boolean;
    dengueScrapeError?: string;
    builtAt?: string;
  } | null;
}

interface CaseRow {
  zone_id: string;
  case_count: number;
  week_label: string | null;
  week_index: number | null;
  date: string;
  scrape_ok: boolean | null;
  scrape_error: string | null;
}

export async function loadDashboardFromSupabase(
  supabase: SupabaseClient
): Promise<DashboardPayload> {
  const { data: zones, error: zErr } = await supabase
    .from('zones')
    .select('*')
    .order('name');
  if (zErr) throw new Error(`Failed to load zones: ${zErr.message}`);
  if (!zones?.length) throw new Error('No zones in database — run the refresh cron first');

  const { data: latestReading } = await supabase
    .from('daily_readings')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestReading?.date) {
    throw new Error('No daily_readings found — run the refresh cron first');
  }

  const { data: readings, error: rErr } = await supabase
    .from('daily_readings')
    .select('*')
    .eq('date', latestReading.date);
  if (rErr) throw new Error(`Failed to load readings: ${rErr.message}`);

  const { data: caseRows, error: cErr } = await supabase
    .from('dengue_cases')
    .select('*')
    .order('week_index', { ascending: true });
  if (cErr) throw new Error(`Failed to load dengue_cases: ${cErr.message}`);

  const readingByZone = new Map<string, ReadingRow>();
  for (const r of (readings ?? []) as ReadingRow[]) {
    readingByZone.set(r.zone_id, r);
  }

  const casesByZone = new Map<string, CaseRow[]>();
  for (const c of (caseRows ?? []) as CaseRow[]) {
    const list = casesByZone.get(c.zone_id) ?? [];
    list.push(c);
    casesByZone.set(c.zone_id, list);
  }

  // Historical risk scores for trend (last 7 days)
  const { data: history } = await supabase
    .from('daily_readings')
    .select('zone_id, date, risk_score')
    .gte(
      'date',
      new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10)
    )
    .order('date', { ascending: true });

  const trendByZone = new Map<string, number[]>();
  for (const h of history ?? []) {
    const list = trendByZone.get(h.zone_id) ?? [];
    list.push(h.risk_score);
    trendByZone.set(h.zone_id, list);
  }

  const metaSample = (readings?.[0] as ReadingRow | undefined)?.source_meta;
  const dengueAsOf =
    metaSample?.dengueAsOf ??
    (caseRows?.[0] as CaseRow | undefined)?.date ??
    latestReading.date;

  const builtZones: ZoneData[] = [];

  for (const z of zones as ZoneRow[]) {
    const reading = readingByZone.get(z.id);
    if (!reading) continue;

    const pastCases = (casesByZone.get(z.id) ?? []).map((c) => ({
      week: c.week_label ?? 'W?',
      count: c.case_count,
    }));

    // Recompute factors from stored inputs so "why this score" stays accurate
    const risk = calculateRisk({
      temperature: reading.temperature,
      humidity: reading.humidity,
      vegetationIndex: reading.ndvi,
      rainfallRecent: reading.rainfall,
      pastCases,
      zoneName: z.name,
    });

    const trend = trendByZone.get(z.id);
    const weatherLabel = reading.weather_as_of
      ? `${reading.date} (weather as of ${reading.weather_as_of})`
      : reading.date;

    builtZones.push({
      id: z.id,
      name: z.name,
      district: z.district,
      coordinates: { lat: z.lat, lng: z.lng },
      svgPolygonPath: z.svg_polygon_path,
      svgLabelCoord: { x: z.svg_label_x, y: z.svg_label_y },
      riskLevel: reading.risk_level,
      riskScore: reading.risk_score,
      temperature: reading.temperature,
      humidity: reading.humidity,
      rainfallRecent: reading.rainfall,
      vegetationIndex: reading.ndvi,
      shadeCoverage: reading.shade_coverage ?? Math.round(reading.ndvi * 100),
      pastCases,
      trend:
        trend && trend.length
          ? trend.slice(-7)
          : [
              Math.max(10, reading.risk_score - 6),
              Math.max(10, reading.risk_score - 4),
              Math.max(10, reading.risk_score - 2),
              reading.risk_score,
            ],
      lastUpdated: weatherLabel,
      contributingFactors: risk.contributingFactors,
      precautions: defaultPrecautions(reading.risk_level),
      fieldOfficerNote: z.field_officer_note ?? undefined,
      activeLarvalSites: z.active_larval_sites ?? undefined,
    });
  }

  const avg = (fn: (z: ZoneData) => number) =>
    builtZones.length
      ? builtZones.reduce((s, z) => s + fn(z), 0) / builtZones.length
      : 0;

  const highCount = builtZones.filter((z) => z.riskLevel === 'high').length;
  const weatherLagged = Boolean(metaSample?.weatherLagged);

  const cityConditions: CityConditions = {
    cityName: 'Islamabad',
    province: 'ICT, Pakistan',
    temperature: Math.round(avg((z) => z.temperature) * 10) / 10,
    humidity: Math.round(avg((z) => z.humidity)),
    rainfall: Math.round(avg((z) => z.rainfallRecent) * 10) / 10,
    averageNDVI: Math.round(avg((z) => z.vegetationIndex) * 100) / 100,
    date: latestReading.date,
    lastUpdatedTime: weatherLagged
      ? `as of ${metaSample?.weatherAsOf ?? latestReading.date} (Open-Meteo fallback)`
      : 'from Supabase',
    activeHighRiskZones: highCount,
    totalZonesMonitored: builtZones.length,
    seasonalAlertStatus:
      highCount >= 4
        ? 'Post-Monsoon Mosquito Biting Peak Warning'
        : highCount >= 1
          ? 'Elevated Vector Activity — Targeted Surveillance'
          : 'Routine Seasonal Monitoring',
  };

  const freshness: DataFreshness = {
    weatherAsOf: metaSample?.weatherAsOf ?? latestReading.date,
    weatherLagged,
    vegetationAsOf: metaSample?.vegetationAsOf ?? null,
    dengueAsOf,
    dengueStale: isDengueDataStale(dengueAsOf, 2),
    dengueScrapeOk: Boolean(metaSample?.dengueScrapeOk),
    dengueScrapeError: metaSample?.dengueScrapeError,
    weatherErrors: {},
    vegetationErrors: {},
  };

  return {
    zones: builtZones,
    cityConditions,
    freshness,
    builtAt: metaSample?.builtAt ?? new Date().toISOString(),
  };
}
