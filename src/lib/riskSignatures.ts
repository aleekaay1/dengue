/**
 * Extract real elevated-risk peaks from scored 50 m cells.
 * No synthetic heat lattice — only cell centers that win local non-max suppression.
 */

import type { GridCellDto } from '../components/gridMapUtils';

function approxDistM(a: GridCellDto, b: GridCellDto): number {
  const dLat = (a.lat - b.lat) * 111_320;
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos(midLat);
  return Math.hypot(dLat, dLng);
}

/**
 * Keep local risk maxima from the actual pack (exact lat/lng).
 * - Must clear a score floor
 * - Must look settled enough (skip empty / river fringe)
 * - Must be the strongest within minSeparationM (so we don't paint a grid)
 */
export function extractRiskPeaks(
  cells: GridCellDto[],
  options?: {
    minScore?: number;
    minSettlement?: number;
    minSeparationM?: number;
    maxPeaks?: number;
  }
): GridCellDto[] {
  const minScore = options?.minScore ?? 52;
  const minSettlement = options?.minSettlement ?? 0.2;
  const minSeparationM = options?.minSeparationM ?? 220;
  const maxPeaks = options?.maxPeaks ?? 100;

  const candidates = cells
    .filter(
      (c) =>
        c.riskScore >= minScore &&
        c.settlementDensity >= minSettlement &&
        Number.isFinite(c.lat) &&
        Number.isFinite(c.lng)
    )
    .sort((a, b) => b.riskScore - a.riskScore || b.peopleAtRisk - a.peopleAtRisk);

  if (!candidates.length) return [];

  // Require peaks to also beat the local median of the candidate set slightly
  const mid = candidates[Math.floor(candidates.length / 2)]?.riskScore ?? minScore;
  const floor = Math.max(minScore, mid - 2);

  const kept: GridCellDto[] = [];
  for (const c of candidates) {
    if (c.riskScore < floor) continue;
    const tooClose = kept.some((k) => approxDistM(k, c) < minSeparationM);
    if (tooClose) continue;
    kept.push(c);
    if (kept.length >= maxPeaks) break;
  }
  return kept;
}

export function signatureColor(score: number): string {
  if (score >= 70) return '#B5432A';
  if (score >= 55) return '#D97706';
  return '#D9A441';
}
