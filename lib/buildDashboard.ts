/**
 * Assembles ZoneData[] + CityConditions from live data sources.
 * Server-side / cron only — frontend should read persisted Supabase rows.
 */

import { fetchWeatherForZones, type WeatherReading } from './api/weather.js';
import { fetchVegetationForZones } from './api/vegetation.js';
import { fetchDengueCases, isDengueDataStale } from './api/dengueCases.js';
import { loadTerrainDepressions } from './api/terrain.js';
import { calculateRisk, defaultPrecautions } from './riskModel.js';
import { ZONE_META } from './zoneMeta.js';
import type { CityConditions, ZoneData } from '../src/types.js';

export interface DataFreshness {
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

export interface DashboardPayload {
  zones: ZoneData[];
  cityConditions: CityConditions;
  freshness: DataFreshness;
  builtAt: string;
}

function formatPkt(isoOrDate: string): string {
  const d = new Date(isoOrDate.includes('T') ? isoOrDate : `${isoOrDate}T08:00:00+05:00`);
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} ${time} PKT`;
}

function seasonalStatus(highCount: number): string {
  if (highCount >= 4) return 'Post-Monsoon Mosquito Biting Peak Warning';
  if (highCount >= 1) return 'Elevated Vector Activity — Targeted Surveillance';
  return 'Routine Seasonal Monitoring';
}

export async function buildDashboard(options?: {
  bypassCache?: boolean;
}): Promise<DashboardPayload> {
  const zoneCoords = ZONE_META.map((z) => ({
    id: z.id,
    lat: z.coordinates.lat,
    lng: z.coordinates.lng,
  }));

  const [weather, vegetation, dengue] = await Promise.all([
    fetchWeatherForZones(zoneCoords, { bypassCache: options?.bypassCache }),
    fetchVegetationForZones(ZONE_META.map((z) => z.id)),
    fetchDengueCases({ bypassCache: options?.bypassCache }),
  ]);

  // Structural DEM depressions — rare batch seed, NOT fetched with daily weather/NDVI
  const terrain = loadTerrainDepressions();

  const zones: ZoneData[] = [];
  const weatherDates: string[] = [];
  let anyWeatherLagged = false;

  for (const meta of ZONE_META) {
    const w: WeatherReading | undefined = weather.readings[meta.id];
    const v = vegetation.readings[meta.id];
    const cases = dengue.byZone[meta.id];
    const terr = terrain.byZone[meta.id];

    if (!w || !v || !cases) {
      // Skip incomplete zones rather than crash — surfaced via freshness.errors
      continue;
    }

    weatherDates.push(w.asOfDate);
    if (w.isLagged) anyWeatherLagged = true;

    const depressionRiskScore = terr?.depressionRiskScore ?? 0;

    const risk = calculateRisk({
      temperature: w.temperature,
      humidity: w.humidity,
      vegetationIndex: v.vegetationIndex,
      rainfallRecent: w.rainfallRecent,
      pastCases: cases.pastCases,
      depressionRiskScore,
      zoneName: meta.name,
    });

    const lastUpdated = w.isLagged
      ? `${formatPkt(w.asOfDate)} (Open-Meteo hourly fallback)`
      : formatPkt(w.fetchedAt);

    zones.push({
      id: meta.id,
      name: meta.name,
      district: meta.district,
      tehsil: meta.tehsil,
      areaType: meta.areaType,
      coordinates: meta.coordinates,
      svgPolygonPath: meta.svgPolygonPath,
      svgLabelCoord: meta.svgLabelCoord,
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
      temperature: w.temperature,
      humidity: w.humidity,
      rainfallRecent: w.rainfallRecent,
      vegetationIndex: v.vegetationIndex,
      shadeCoverage: v.shadeCoverage,
      depressionDepthAvg: terr?.depressionDepthAvg,
      depressionAreaPct: terr?.depressionAreaPct,
      depressionRiskScore,
      pastCases: cases.pastCases,
      // Placeholder trend until we accumulate daily_readings history
      trend: [
        Math.max(10, risk.riskScore - 12),
        Math.max(10, risk.riskScore - 9),
        Math.max(10, risk.riskScore - 7),
        Math.max(10, risk.riskScore - 5),
        Math.max(10, risk.riskScore - 3),
        Math.max(10, risk.riskScore - 1),
        risk.riskScore,
      ],
      lastUpdated,
      contributingFactors: risk.contributingFactors,
      precautions: meta.precautions ?? defaultPrecautions(risk.riskLevel),
      fieldOfficerNote: meta.fieldOfficerNote,
      activeLarvalSites: meta.activeLarvalSites,
    });
  }

  const avg = (fn: (z: ZoneData) => number) =>
    zones.length ? zones.reduce((s, z) => s + fn(z), 0) / zones.length : 0;

  const highCount = zones.filter((z) => z.riskLevel === 'high').length;
  const weatherAsOf =
    weatherDates.sort().at(-1) ?? new Date().toISOString().slice(0, 10);

  const cityConditions: CityConditions = {
    cityName: 'Islamabad',
    province: 'ICT, Pakistan',
    temperature: Math.round(avg((z) => z.temperature) * 10) / 10,
    humidity: Math.round(avg((z) => z.humidity)),
    rainfall: Math.round(avg((z) => z.rainfallRecent) * 10) / 10,
    averageNDVI: Math.round(avg((z) => z.vegetationIndex) * 100) / 100,
    date: weatherAsOf,
    lastUpdatedTime: anyWeatherLagged
      ? `as of ${weatherAsOf} (Open-Meteo fallback)`
      : new Date().toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Karachi',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }) + ' PKT',
    activeHighRiskZones: highCount,
    totalZonesMonitored: zones.length,
    seasonalAlertStatus: seasonalStatus(highCount),
  };

  const vegDates = Object.values(vegetation.readings).map((r) => r.asOfDate);

  return {
    zones,
    cityConditions,
    freshness: {
      weatherAsOf,
      weatherLagged: anyWeatherLagged,
      vegetationAsOf: vegDates.sort().at(-1) ?? null,
      dengueAsOf: dengue.asOfDate,
      dengueStale: isDengueDataStale(dengue.asOfDate, 2),
      dengueScrapeOk: dengue.scrapeOk,
      dengueScrapeError: dengue.scrapeError,
      weatherErrors: weather.errors,
      vegetationErrors: vegetation.errors,
    },
    builtAt: new Date().toISOString(),
  };
}
