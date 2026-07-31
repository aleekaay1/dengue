/**
 * Current / recent weather via Open-Meteo (free, no API key).
 * Docs: https://open-meteo.com/en/docs
 *
 * Uses near-real-time model conditions (much fresher than NASA POWER daily lag)
 * and ~9–11 km grid — still city-scale, but each lat/lng is queried separately.
 */

import { CACHE_TTL, getCached, setCache } from './cache.ts';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export interface WeatherReading {
  temperature: number; // °C
  humidity: number; // %
  rainfallRecent: number; // mm over last ~48h
  /** YYYY-MM-DD of the observation (Asia/Karachi calendar day) */
  asOfDate: string;
  /** True only if current block was missing and we fell back to last hourly */
  isLagged: boolean;
  source: 'open-meteo';
  fetchedAt: string; // ISO
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function karachiDate(isoLocal: string): string {
  // Open-Meteo returns "2026-07-31T18:00" in the requested timezone (no Z)
  return isoLocal.slice(0, 10);
}

function sumPrecipLast48h(
  times: string[],
  precip: number[],
  nowIsoLocal: string
): number {
  const nowMs = Date.parse(nowIsoLocal);
  if (!Number.isFinite(nowMs)) return 0;
  const cutoff = nowMs - 48 * 60 * 60 * 1000;
  let sum = 0;
  for (let i = 0; i < times.length; i++) {
    const t = Date.parse(times[i]);
    if (!Number.isFinite(t)) continue;
    if (t > nowMs || t < cutoff) continue;
    const v = precip[i];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) sum += v;
  }
  return round1(sum);
}

/**
 * Fetch current temp/humidity + ~48h precip for a coordinate.
 */
export async function fetchWeatherForPoint(
  lat: number,
  lng: number,
  options?: { zoneId?: string; bypassCache?: boolean }
): Promise<WeatherReading> {
  const cacheKey = `weather:om:${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (!options?.bypassCache) {
    const hit = getCached<WeatherReading>(cacheKey);
    if (hit) return hit.value;
  }

  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,precipitation'
  );
  url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,precipitation');
  url.searchParams.set('past_days', '2');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'Asia/Karachi');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(
      `Open-Meteo request failed (${res.status}) for ${lat},${lng}${
        options?.zoneId ? ` [${options.zoneId}]` : ''
      }`
    );
  }

  const json = (await res.json()) as {
    current?: {
      time?: string;
      temperature_2m?: number;
      relative_humidity_2m?: number;
      precipitation?: number;
    };
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      relative_humidity_2m?: number[];
      precipitation?: number[];
    };
  };

  const current = json.current;
  const hourly = json.hourly;
  const times = hourly?.time ?? [];
  const precip = hourly?.precipitation ?? [];

  let temperature: number | undefined = current?.temperature_2m;
  let humidity: number | undefined = current?.relative_humidity_2m;
  let asOfLocal = current?.time;
  let isLagged = false;

  // Fallback: newest hourly row with valid temp + humidity
  if (
    typeof temperature !== 'number' ||
    !Number.isFinite(temperature) ||
    typeof humidity !== 'number' ||
    !Number.isFinite(humidity) ||
    !asOfLocal
  ) {
    isLagged = true;
    for (let i = times.length - 1; i >= 0; i--) {
      const t = hourly?.temperature_2m?.[i];
      const h = hourly?.relative_humidity_2m?.[i];
      if (
        typeof t === 'number' &&
        Number.isFinite(t) &&
        typeof h === 'number' &&
        Number.isFinite(h)
      ) {
        temperature = t;
        humidity = h;
        asOfLocal = times[i];
        break;
      }
    }
  }

  if (
    typeof temperature !== 'number' ||
    typeof humidity !== 'number' ||
    !asOfLocal
  ) {
    throw new Error(
      `Open-Meteo returned no usable weather for ${lat},${lng}${
        options?.zoneId ? ` [${options.zoneId}]` : ''
      }`
    );
  }

  const rainfallRecent = sumPrecipLast48h(times, precip, asOfLocal);

  const reading: WeatherReading = {
    temperature: round1(temperature),
    humidity: Math.round(humidity),
    rainfallRecent,
    asOfDate: karachiDate(asOfLocal),
    isLagged,
    source: 'open-meteo',
    fetchedAt: new Date().toISOString(),
  };

  // Fresher source → shorter cache (was 4h for NASA daily)
  setCache(cacheKey, reading, Math.min(CACHE_TTL.WEATHER_HOURS, 30 * 60 * 1000));
  return reading;
}

export async function fetchWeatherForZones(
  zones: Array<{ id: string; lat: number; lng: number }>,
  options?: { bypassCache?: boolean }
): Promise<{
  readings: Record<string, WeatherReading>;
  errors: Record<string, string>;
}> {
  const readings: Record<string, WeatherReading> = {};
  const errors: Record<string, string> = {};

  // Gentle on free-tier rate limits
  for (const zone of zones) {
    try {
      readings[zone.id] = await fetchWeatherForPoint(zone.lat, zone.lng, {
        zoneId: zone.id,
        bypassCache: options?.bypassCache,
      });
    } catch (err) {
      errors[zone.id] = err instanceof Error ? err.message : String(err);
    }
  }

  return { readings, errors };
}
