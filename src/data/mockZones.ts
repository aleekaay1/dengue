import { ZoneData, CityConditions } from '../types';
import { ZONE_META } from '../../lib/zoneMeta';

/**
 * Reference / offline shape only — runtime uses live pipeline + ZONE_META.
 */

export const mockCityConditions: CityConditions = {
  cityName: 'Islamabad',
  province: 'ICT, Pakistan',
  temperature: 28.4,
  humidity: 72,
  rainfall: 28.0,
  averageNDVI: 0.4,
  date: '2026-07-31',
  lastUpdatedTime: '08:30 PKT',
  activeHighRiskZones: 3,
  totalZonesMonitored: ZONE_META.length,
  seasonalAlertStatus: 'Elevated Vector Activity — Targeted Surveillance',
};

export const mockZones: ZoneData[] = ZONE_META.map((meta, i) => {
  const riskScore = 40 + ((i * 7) % 45);
  const riskLevel =
    riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low';
  return {
    id: meta.id,
    name: meta.name,
    district: meta.district,
    tehsil: meta.tehsil,
    areaType: meta.areaType,
    coordinates: meta.coordinates,
    svgPolygonPath: meta.svgPolygonPath,
    svgLabelCoord: meta.svgLabelCoord,
    riskLevel,
    riskScore,
    temperature: 25 + (i % 5),
    humidity: 70 + (i % 20),
    rainfallRecent: 5 + (i % 10),
    vegetationIndex: meta.areaType === 'rural' ? 0.5 : 0.35,
    shadeCoverage: meta.areaType === 'rural' ? 50 : 35,
    lastUpdated: '2026-07-31 08:15 PKT',
    pastCases: [
      { week: 'W24', count: i % 5 },
      { week: 'W25', count: (i % 5) + 1 },
      { week: 'W26', count: (i % 5) + 2 },
      { week: 'W27', count: (i % 5) + 3 },
      { week: 'W28', count: (i % 5) + 4 },
    ],
    trend: [
      Math.max(10, riskScore - 12),
      Math.max(10, riskScore - 9),
      Math.max(10, riskScore - 7),
      Math.max(10, riskScore - 5),
      Math.max(10, riskScore - 3),
      Math.max(10, riskScore - 1),
      riskScore,
    ],
    contributingFactors: [
      {
        factor: 'Ambient humidity & rainfall',
        impact: riskLevel === 'high' ? 'high' : 'medium',
        description: 'Local microclimate supports adult Aedes activity.',
        scoreContribution: Math.round(riskScore * 0.3),
        maxContribution: 25,
      },
    ],
    precautions: [
      'Apply repellent during dawn and dusk peak biting hours.',
      'Eliminate standing water in pots, coolers, and rooftop tanks.',
    ],
    fieldOfficerNote: meta.fieldOfficerNote,
    activeLarvalSites: meta.activeLarvalSites,
  };
});
