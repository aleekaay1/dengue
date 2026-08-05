/**
 * Extract real elevated-risk peaks from scored 50 m cells.
 * Thresholds adapt to the dataset — absolute cutoffs like 52 fail when the
 * pack’s max score is ~48 (common with shared weather + mid vegetation).
 */

import type { GridCellDto } from '../components/gridMapUtils';

function approxDistM(a: GridCellDto, b: GridCellDto): number {
  const dLat = (a.lat - b.lat) * 111_320;
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos(midLat);
  return Math.hypot(dLat, dLng);
}

function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const i = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.floor((sortedAsc.length - 1) * p))
  );
  return sortedAsc[i];
}

export interface PeakExtractionResult {
  peaks: GridCellDto[];
  /** Score floor actually used (adaptive) */
  minScore: number;
  maxScore: number;
  candidateCount: number;
}

/**
 * Keep local risk maxima from the actual pack (exact lat/lng).
 * Uses the top of the score distribution in the provided cell set.
 */
export function extractRiskPeaks(
  cells: GridCellDto[],
  options?: {
    /** Absolute floor — raised automatically if data max is lower */
    minScore?: number;
    minSettlement?: number;
    minSeparationM?: number;
    maxPeaks?: number;
    /** Keep cells at/above this percentile of scores (default 0.85) */
    scorePercentile?: number;
  }
): PeakExtractionResult {
  const minSeparationM = options?.minSeparationM ?? 200;
  const maxPeaks = options?.maxPeaks ?? 90;
  const scorePercentile = options?.scorePercentile ?? 0.85;
  const minSettlement = options?.minSettlement ?? 0.12;

  const finite = cells.filter(
    (c) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && c.riskScore > 0
  );
  if (!finite.length) {
    return { peaks: [], minScore: 0, maxScore: 0, candidateCount: 0 };
  }

  const scores = finite.map((c) => c.riskScore).sort((a, b) => a - b);
  const maxScore = scores[scores.length - 1];
  const pCut = percentile(scores, scorePercentile);
  // Prefer top of distribution; never ask for scores above what exists
  const requested = options?.minScore ?? 45;
  const minScore = Math.min(maxScore, Math.max(requested, pCut));

  const candidates = finite
    .filter((c) => {
      if (c.riskScore < minScore) return false;
      // Settled OR green/park OR terrain sink — parks were excluded before
      if (c.settlementDensity >= minSettlement) return true;
      if (c.ndvi >= 0.3) return true;
      if (c.depressionScore >= 20) return true;
      return false;
    })
    .sort(
      (a, b) => b.riskScore - a.riskScore || b.peopleAtRisk - a.peopleAtRisk
    );

  const kept: GridCellDto[] = [];
  for (const c of candidates) {
    const tooClose = kept.some((k) => approxDistM(k, c) < minSeparationM);
    if (tooClose) continue;
    kept.push(c);
    if (kept.length >= maxPeaks) break;
  }

  // Fallback: if filters left nothing, still show spatial peaks of top scores
  if (!kept.length && candidates.length) {
    for (const c of candidates) {
      const tooClose = kept.some((k) => approxDistM(k, c) < minSeparationM);
      if (tooClose) continue;
      kept.push(c);
      if (kept.length >= Math.min(40, maxPeaks)) break;
    }
  }

  if (!kept.length) {
    // Last resort: top scores with separation only (still real cells)
    const top = [...finite].sort((a, b) => b.riskScore - a.riskScore);
    for (const c of top) {
      if (c.riskScore < pCut) break;
      const tooClose = kept.some((k) => approxDistM(k, c) < minSeparationM);
      if (tooClose) continue;
      kept.push(c);
      if (kept.length >= Math.min(40, maxPeaks)) break;
    }
  }

  return {
    peaks: kept,
    minScore,
    maxScore,
    candidateCount: candidates.length,
  };
}

export function signatureColor(score: number, maxInSet = 100): string {
  // Relative colouring when the whole city sits in a narrow band (e.g. 35–48)
  const t =
    maxInSet > 0 ? Math.min(1, Math.max(0, score / Math.max(maxInSet, 1))) : 0;
  if (t >= 0.92 || score >= 70) return '#B5432A';
  if (t >= 0.8 || score >= 55) return '#D97706';
  return '#D9A441';
}
