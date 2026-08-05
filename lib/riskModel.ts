/**
 * Transparent, explainable adult mosquito activity risk model (MVP).
 *
 * Literature-informed heuristic for thesis / operations demo — weights are
 * design choices grounded in Aedes ecology literature, NOT a statistically
 * fitted or epidemiologically validated model. Swap later for RF/XGBoost
 * without changing consumers.
 *
 * Depression / standing-water is a STRUCTURAL factor (terrain sinks), not a
 * daily weather reading — same transparent weighted sum as the other inputs.
 */

import type { CaseHistory, ContributingFactor, RiskLevel } from '../src/types.js';

/** Configurable thresholds — do not bury magic numbers in call sites */
export const RISK_THRESHOLDS = {
  HIGH: 70,
  MEDIUM: 40,
} as const;

/**
 * Weights must sum to 1.0 for a 0–100 composite after normalization.
 * Existing weather/NDVI/case factors keep the same relative balance; room was
 * made for a ~10% structural terrain term (standing-water / depression risk).
 */
export const RISK_WEIGHTS = {
  temperature: 0.2,
  humidity: 0.2,
  vegetation: 0.16,
  rainfall: 0.08,
  recentCases: 0.15,
  /** Structural — natural depressions that trap rainwater after rain */
  depression: 0.11,
  /** Settlement / structure density (OSM footprints) — not household IDs */
  settlement: 0.1,
} as const;

export interface RiskModelInput {
  temperature: number; // °C
  humidity: number; // %
  vegetationIndex: number; // NDVI 0–1
  rainfallRecent: number; // mm ~48h
  pastCases: CaseHistory[];
  /** 0–100 structural depression score (optional; defaults to 0) */
  depressionRiskScore?: number;
  /** 0–1 settlement/structure density (optional) */
  settlementDensity?: number;
  zoneName?: string;
}

export interface RiskModelOutput {
  riskScore: number; // 0–100
  riskLevel: RiskLevel;
  contributingFactors: ContributingFactor[];
  components: {
    temperature: number;
    humidity: number;
    vegetation: number;
    rainfall: number;
    recentCases: number;
    depression: number;
    settlement: number;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Aedes aegypti viral replication / adult activity peaks near 26–30°C.
 * Score peaks at 28.5°C and falls off outside the window.
 */
function normalizeTemperature(tempC: number): number {
  const peak = 28.5;
  const delta = Math.abs(tempC - peak);
  return clamp(1 - delta / 12, 0, 1);
}

function normalizeHumidity(humidity: number): number {
  // Adult survival rises sharply above ~60% RH
  return clamp((humidity - 40) / 50, 0, 1);
}

function normalizeVegetation(ndvi: number): number {
  return clamp(ndvi, 0, 1);
}

function normalizeRainfall(mm: number): number {
  // Diminishing returns after ~40mm in 48h
  return clamp(mm / 40, 0, 1);
}

function normalizeRecentCases(pastCases: CaseHistory[]): number {
  if (!pastCases.length) return 0;
  const recent = pastCases.slice(-2).reduce((sum, w) => sum + w.count, 0);
  // Cap influence around 40 cases in last 2 weeks
  return clamp(recent / 40, 0, 1);
}

function normalizeDepression(score: number | undefined): number {
  if (score == null || Number.isNaN(score)) return 0;
  return clamp(score / 100, 0, 1);
}

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.HIGH) return 'high';
  if (score >= RISK_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

function impactFromContribution(contribution: number): ContributingFactor['impact'] {
  if (contribution >= 18) return 'high';
  if (contribution >= 10) return 'medium';
  return 'low';
}

function maxPts(weight: number): number {
  return Math.round(weight * 100);
}

/**
 * Calculate mosquito activity risk score from environmental + case + terrain inputs.
 */
function normalizeSettlement(density: number | undefined): number {
  if (density == null || Number.isNaN(density)) return 0;
  return clamp(density, 0, 1);
}

export function calculateRisk(input: RiskModelInput): RiskModelOutput {
  const t = normalizeTemperature(input.temperature);
  const h = normalizeHumidity(input.humidity);
  const v = normalizeVegetation(input.vegetationIndex);
  const r = normalizeRainfall(input.rainfallRecent);
  const c = normalizeRecentCases(input.pastCases);
  const d = normalizeDepression(input.depressionRiskScore);
  const s = normalizeSettlement(input.settlementDensity);

  const components = {
    temperature: t,
    humidity: h,
    vegetation: v,
    rainfall: r,
    recentCases: c,
    depression: d,
    settlement: s,
  };

  const raw =
    t * RISK_WEIGHTS.temperature +
    h * RISK_WEIGHTS.humidity +
    v * RISK_WEIGHTS.vegetation +
    r * RISK_WEIGHTS.rainfall +
    c * RISK_WEIGHTS.recentCases +
    d * RISK_WEIGHTS.depression +
    s * RISK_WEIGHTS.settlement;

  const riskScore = Math.round(clamp(raw * 100, 0, 100));
  const riskLevel = scoreToRiskLevel(riskScore);

  const contrib = {
    temperature: Math.round(t * RISK_WEIGHTS.temperature * 100),
    humidity: Math.round(h * RISK_WEIGHTS.humidity * 100),
    vegetation: Math.round(v * RISK_WEIGHTS.vegetation * 100),
    rainfall: Math.round(r * RISK_WEIGHTS.rainfall * 100),
    recentCases: Math.round(c * RISK_WEIGHTS.recentCases * 100),
    depression: Math.round(d * RISK_WEIGHTS.depression * 100),
    settlement: Math.round(s * RISK_WEIGHTS.settlement * 100),
  };

  const max = {
    temperature: maxPts(RISK_WEIGHTS.temperature),
    humidity: maxPts(RISK_WEIGHTS.humidity),
    vegetation: maxPts(RISK_WEIGHTS.vegetation),
    rainfall: maxPts(RISK_WEIGHTS.rainfall),
    recentCases: maxPts(RISK_WEIGHTS.recentCases),
    depression: maxPts(RISK_WEIGHTS.depression),
    settlement: maxPts(RISK_WEIGHTS.settlement),
  };

  const lastWeekCases = input.pastCases.at(-1)?.count ?? 0;
  const inTempPeak = input.temperature >= 26 && input.temperature <= 32;
  const depScore = Math.round(clamp(input.depressionRiskScore ?? 0, 0, 100));
  const settlePct = Math.round(clamp(input.settlementDensity ?? 0, 0, 1) * 100);

  const contributingFactors: ContributingFactor[] = [
    {
      factor: `Ambient Temperature (${input.temperature.toFixed(1)}°C)`,
      impact: impactFromContribution(contrib.temperature),
      description: inTempPeak
        ? `Inside the 26–32°C Aedes activity window — contributing ${contrib.temperature} of ${max.temperature} possible points (peak near 28.5°C).`
        : `Outside the peak 26–32°C band — still adds ${contrib.temperature} of ${max.temperature} possible points (below full weight; not a negative penalty).`,
      scoreContribution: contrib.temperature,
      maxContribution: max.temperature,
    },
    {
      factor: `Relative Humidity (${input.humidity}%)`,
      impact: impactFromContribution(contrib.humidity),
      description:
        input.humidity >= 70
          ? `Humidity at ${input.humidity}% strongly supports adult survival — ${contrib.humidity} of ${max.humidity} possible points.`
          : `Humidity at ${input.humidity}% provides moderate support — ${contrib.humidity} of ${max.humidity} possible points.`,
      scoreContribution: contrib.humidity,
      maxContribution: max.humidity,
    },
    {
      factor: `Vegetation / Shade (NDVI ${input.vegetationIndex.toFixed(2)})`,
      impact: impactFromContribution(contrib.vegetation),
      description:
        input.vegetationIndex >= 0.6
          ? `Dense canopy shade supports daytime resting sites — ${contrib.vegetation} of ${max.vegetation} possible points.`
          : `Moderate/sparse vegetation — ${contrib.vegetation} of ${max.vegetation} possible points.`,
      scoreContribution: contrib.vegetation,
      maxContribution: max.vegetation,
    },
    {
      factor: `Recent Rainfall (${input.rainfallRecent.toFixed(1)} mm / ~48h)`,
      impact: impactFromContribution(contrib.rainfall),
      description:
        input.rainfallRecent >= 20
          ? `Recent rain raises breeding-container opportunity — ${contrib.rainfall} of ${max.rainfall} possible points.`
          : `Limited recent rainfall — ${contrib.rainfall} of ${max.rainfall} possible points.`,
      scoreContribution: contrib.rainfall,
      maxContribution: max.rainfall,
    },
    {
      factor: `Recent Case History (${lastWeekCases} last week)`,
      impact: impactFromContribution(contrib.recentCases),
      description:
        lastWeekCases >= 15
          ? `Elevated recent cases suggest local transmission — ${contrib.recentCases} of ${max.recentCases} possible points.`
          : `Recent case counts are relatively contained — ${contrib.recentCases} of ${max.recentCases} possible points.`,
      scoreContribution: contrib.recentCases,
      maxContribution: max.recentCases,
    },
    {
      factor: `Terrain / Standing Water Risk (${depScore}/100)`,
      impact: impactFromContribution(contrib.depression),
      description:
        depScore >= 40
          ? `This area has natural low-lying terrain that traps rainwater (depression score: ${depScore}/100) — a structural risk factor independent of today's weather. Adds ${contrib.depression} of ${max.depression} possible points.`
          : `Limited natural depression / sink area (depression score: ${depScore}/100) — structural terrain factor, not today's weather. Adds ${contrib.depression} of ${max.depression} possible points.`,
      scoreContribution: contrib.depression,
      maxContribution: max.depression,
    },
    {
      factor: `Settlement / Structure Density (${settlePct}%)`,
      impact: impactFromContribution(contrib.settlement),
      description:
        settlePct >= 40
          ? `Higher structure density increases water-storage and human-host opportunity at block scale (not household IDs) — ${contrib.settlement} of ${max.settlement} possible points.`
          : `Lower structure density at this block — ${contrib.settlement} of ${max.settlement} possible points.`,
      scoreContribution: contrib.settlement,
      maxContribution: max.settlement,
    },
  ]
    .filter((f) => f.scoreContribution > 0)
    .sort((a, b) => b.scoreContribution - a.scoreContribution)
    .slice(0, 4);

  return {
    riskScore,
    riskLevel,
    contributingFactors,
    components,
  };
}

/** Default precautions by risk level (UI still allows zone-specific overrides). */
export function defaultPrecautions(level: RiskLevel): string[] {
  if (level === 'high') {
    return [
      'Apply DEET/Icaridin repellent between 06:00–09:00 and 17:00–19:00 (peak biting hours).',
      'Wear light-colored, full-sleeved clothing outdoors near parks and shaded markets.',
      'Eliminate standing water in planters, coolers, and roof gutters within 48 hours of rain.',
      'Seek medical screening promptly for sudden fever with severe backache or eye pain.',
    ];
  }
  if (level === 'medium') {
    return [
      'Keep doors/windows screened during dawn and dusk biting windows.',
      'Inspect potted-plant saucers and air-cooler trays every 3 days.',
      'Use repellent during morning/evening outdoor activity near green belts.',
    ];
  }
  return [
    'Maintain standard seasonal vigilance and household container checks.',
    'Confirm window screens and water-tank lids remain sealed.',
  ];
}
