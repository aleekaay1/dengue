/**
 * Transparent, explainable adult mosquito activity risk model (MVP).
 *
 * Pure function — inputs in, score/level/factors out. Can later be swapped
 * for a trained Random Forest / XGBoost model without changing consumers.
 */

import type { CaseHistory, ContributingFactor, RiskLevel } from '../src/types.js';

/** Configurable thresholds — do not bury magic numbers in call sites */
export const RISK_THRESHOLDS = {
  HIGH: 70,
  MEDIUM: 40,
} as const;

/** Weights must sum to 1.0 for a 0–100 composite after normalization */
export const RISK_WEIGHTS = {
  temperature: 0.25,
  humidity: 0.25,
  vegetation: 0.2,
  rainfall: 0.1,
  recentCases: 0.2,
} as const;

export interface RiskModelInput {
  temperature: number; // °C
  humidity: number; // %
  vegetationIndex: number; // NDVI 0–1
  rainfallRecent: number; // mm ~48h
  pastCases: CaseHistory[];
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

/**
 * Calculate mosquito activity risk score from environmental + case inputs.
 */
export function calculateRisk(input: RiskModelInput): RiskModelOutput {
  const t = normalizeTemperature(input.temperature);
  const h = normalizeHumidity(input.humidity);
  const v = normalizeVegetation(input.vegetationIndex);
  const r = normalizeRainfall(input.rainfallRecent);
  const c = normalizeRecentCases(input.pastCases);

  const components = {
    temperature: t,
    humidity: h,
    vegetation: v,
    rainfall: r,
    recentCases: c,
  };

  const raw =
    t * RISK_WEIGHTS.temperature +
    h * RISK_WEIGHTS.humidity +
    v * RISK_WEIGHTS.vegetation +
    r * RISK_WEIGHTS.rainfall +
    c * RISK_WEIGHTS.recentCases;

  const riskScore = Math.round(clamp(raw * 100, 0, 100));
  const riskLevel = scoreToRiskLevel(riskScore);

  const contrib = {
    temperature: Math.round(t * RISK_WEIGHTS.temperature * 100),
    humidity: Math.round(h * RISK_WEIGHTS.humidity * 100),
    vegetation: Math.round(v * RISK_WEIGHTS.vegetation * 100),
    rainfall: Math.round(r * RISK_WEIGHTS.rainfall * 100),
    recentCases: Math.round(c * RISK_WEIGHTS.recentCases * 100),
  };

  const lastWeekCases = input.pastCases.at(-1)?.count ?? 0;

  const contributingFactors: ContributingFactor[] = [
    {
      factor: `Ambient Temperature (${input.temperature.toFixed(1)}°C)`,
      impact: impactFromContribution(contrib.temperature),
      description:
        input.temperature >= 26 && input.temperature <= 32
          ? 'Temperature is inside the 26–32°C window favoring Aedes activity and viral replication.'
          : 'Temperature is outside the peak Aedes activity band, lowering this component.',
      scoreContribution: contrib.temperature,
    },
    {
      factor: `Relative Humidity (${input.humidity}%)`,
      impact: impactFromContribution(contrib.humidity),
      description:
        input.humidity >= 70
          ? `Humidity at ${input.humidity}% extends adult Aedes survival and biting activity.`
          : `Humidity at ${input.humidity}% provides moderate support for adult mosquito survival.`,
      scoreContribution: contrib.humidity,
    },
    {
      factor: `Vegetation / Shade (NDVI ${input.vegetationIndex.toFixed(2)})`,
      impact: impactFromContribution(contrib.vegetation),
      description:
        input.vegetationIndex >= 0.6
          ? 'Dense canopy shade creates cool, humid daytime resting sites for adult mosquitoes.'
          : 'Moderate or sparse vegetation provides limited daytime resting habitat.',
      scoreContribution: contrib.vegetation,
    },
    {
      factor: `Recent Rainfall (${input.rainfallRecent.toFixed(1)} mm / ~48h)`,
      impact: impactFromContribution(contrib.rainfall),
      description:
        input.rainfallRecent >= 20
          ? 'Recent rain increases container breeding opportunity in the following days.'
          : 'Limited recent rainfall reduces fresh breeding-container recharge.',
      scoreContribution: contrib.rainfall,
    },
    {
      factor: `Recent Case History (${lastWeekCases} last week)`,
      impact: impactFromContribution(contrib.recentCases),
      description:
        lastWeekCases >= 15
          ? 'Elevated recent confirmed/probable cases indicate an active local transmission reservoir.'
          : 'Recent case counts are relatively contained in this zone.',
      scoreContribution: contrib.recentCases,
    },
  ]
    .filter((f) => f.scoreContribution > 0)
    .sort((a, b) => b.scoreContribution - a.scoreContribution)
    .slice(0, 3);

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
