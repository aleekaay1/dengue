/**
 * Persist a built dashboard payload into Supabase tables.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DashboardPayload } from './buildDashboard.ts';
import { ZONE_META } from './zoneMeta.ts';

export async function ensureZonesSeeded(supabase: SupabaseClient): Promise<void> {
  const rows = ZONE_META.map((z) => ({
    id: z.id,
    name: z.name,
    district: z.district,
    lat: z.coordinates.lat,
    lng: z.coordinates.lng,
    svg_polygon_path: z.svgPolygonPath,
    svg_label_x: z.svgLabelCoord.x,
    svg_label_y: z.svgLabelCoord.y,
    field_officer_note: z.fieldOfficerNote ?? null,
    active_larval_sites: z.activeLarvalSites ?? null,
  }));

  const { error } = await supabase.from('zones').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`zones upsert failed: ${error.message}`);

  // Drop legacy cities (e.g. Lahore) so the dashboard stays Islamabad-only
  const keepIds = new Set(ZONE_META.map((z) => z.id));
  const { data: existing, error: listErr } = await supabase.from('zones').select('id');
  if (listErr) {
    console.warn('[ensureZonesSeeded] could not list zones for cleanup:', listErr.message);
    return;
  }
  const staleIds = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !keepIds.has(id));
  if (staleIds.length) {
    const { error: delErr } = await supabase.from('zones').delete().in('id', staleIds);
    if (delErr) {
      console.warn('[ensureZonesSeeded] legacy zone cleanup skipped:', delErr.message);
    }
  }
}

export async function persistDashboard(
  supabase: SupabaseClient,
  payload: DashboardPayload
): Promise<void> {
  await ensureZonesSeeded(supabase);

  const readingDate = payload.freshness.weatherAsOf ?? payload.cityConditions.date;

  const dailyRows = payload.zones.map((z) => ({
    date: readingDate,
    zone_id: z.id,
    temperature: z.temperature,
    humidity: z.humidity,
    rainfall: z.rainfallRecent,
    ndvi: z.vegetationIndex,
    risk_score: z.riskScore,
    risk_level: z.riskLevel,
    shade_coverage: z.shadeCoverage,
    weather_as_of: payload.freshness.weatherAsOf,
    source_meta: {
      weatherLagged: payload.freshness.weatherLagged,
      vegetationAsOf: payload.freshness.vegetationAsOf,
      dengueAsOf: payload.freshness.dengueAsOf,
      dengueScrapeOk: payload.freshness.dengueScrapeOk,
      builtAt: payload.builtAt,
    },
  }));

  const { error: dailyErr } = await supabase
    .from('daily_readings')
    .upsert(dailyRows, { onConflict: 'date,zone_id' });
  if (dailyErr) throw new Error(`daily_readings upsert failed: ${dailyErr.message}`);

  // Flatten weekly cases into dated rows (week label kept in meta)
  const caseRows = payload.zones.flatMap((z) =>
    z.pastCases.map((w, idx) => ({
      date: payload.freshness.dengueAsOf ?? readingDate,
      zone_id: z.id,
      case_count: w.count,
      week_label: w.week,
      week_index: idx,
      source: payload.freshness.dengueScrapeOk ? 'live' : 'seed-snapshot',
      scrape_ok: payload.freshness.dengueScrapeOk,
      scrape_error: payload.freshness.dengueScrapeError ?? null,
    }))
  );

  // Replace case rows for this as-of date
  const asOf = payload.freshness.dengueAsOf ?? readingDate;
  await supabase.from('dengue_cases').delete().eq('date', asOf);
  const { error: caseErr } = await supabase.from('dengue_cases').insert(caseRows);
  if (caseErr) throw new Error(`dengue_cases insert failed: ${caseErr.message}`);

  const { error: metaErr } = await supabase.from('pipeline_runs').insert({
    ran_at: payload.builtAt,
    weather_as_of: payload.freshness.weatherAsOf,
    dengue_as_of: payload.freshness.dengueAsOf,
    dengue_scrape_ok: payload.freshness.dengueScrapeOk,
    dengue_scrape_error: payload.freshness.dengueScrapeError ?? null,
    zones_updated: payload.zones.length,
    ok: true,
  });
  if (metaErr) {
    // Non-fatal — readings already stored
    console.warn('[persistDashboard] pipeline_runs insert failed:', metaErr.message);
  }
}
