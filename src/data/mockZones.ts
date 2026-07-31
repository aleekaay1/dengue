import { ZoneData, CityConditions } from '../types';

/**
 * MOCK / REFERENCE DATA — Islamabad Capital Territory
 * --------------------------------------------------
 * Runtime dashboard builds from lib/zoneMeta + live APIs (Open-Meteo, etc.).
 * This file documents the ZoneData shape for offline UI work.
 *
 * Production pipelines:
 * 1. Open-Meteo -> Temperature, Humidity, Rainfall
 * 2. Sentinel-2 / Earth Engine -> Vegetation Index (NDVI)
 * 3. ICT / provincial health portals -> dengue cases  [still seed snapshot]
 */

export const mockCityConditions: CityConditions = {
  cityName: 'Islamabad',
  province: 'ICT, Pakistan',
  temperature: 28.4,
  humidity: 72,
  rainfall: 28.0,
  averageNDVI: 0.34,
  date: '2026-07-31',
  lastUpdatedTime: '08:30 PKT',
  activeHighRiskZones: 3,
  totalZonesMonitored: 10,
  seasonalAlertStatus: 'Elevated Vector Activity — Targeted Surveillance',
};

function baseZone(
  partial: Pick<
    ZoneData,
    | 'id'
    | 'name'
    | 'district'
    | 'coordinates'
    | 'riskLevel'
    | 'riskScore'
    | 'temperature'
    | 'humidity'
    | 'rainfallRecent'
    | 'vegetationIndex'
    | 'shadeCoverage'
    | 'pastCases'
    | 'fieldOfficerNote'
    | 'activeLarvalSites'
  >
): ZoneData {
  const score = partial.riskScore;
  return {
    ...partial,
    svgPolygonPath: 'M 0,0 L 1,0 L 1,1 L 0,1 Z',
    svgLabelCoord: { x: 0, y: 0 },
    lastUpdated: '2026-07-31 08:15 PKT',
    trend: [
      Math.max(10, score - 12),
      Math.max(10, score - 9),
      Math.max(10, score - 7),
      Math.max(10, score - 5),
      Math.max(10, score - 3),
      Math.max(10, score - 1),
      score,
    ],
    contributingFactors: [
      {
        factor: 'Ambient humidity & rainfall',
        impact: partial.riskLevel === 'high' ? 'high' : 'medium',
        description: 'Local microclimate supports adult Aedes activity.',
        scoreContribution: Math.round(score * 0.35),
      },
    ],
    precautions: [
      'Apply repellent during dawn and dusk peak biting hours.',
      'Eliminate standing water in pots, coolers, and rooftop tanks.',
    ],
  };
}

export const mockZones: ZoneData[] = [
  baseZone({
    id: 'zone-f6',
    name: 'F-6 & Super Market',
    district: 'Islamabad Central',
    coordinates: { lat: 33.7295, lng: 73.0745 },
    riskLevel: 'high',
    riskScore: 78,
    temperature: 27.8,
    humidity: 76,
    rainfallRecent: 36,
    vegetationIndex: 0.36,
    shadeCoverage: 36,
    pastCases: [
      { week: 'W24', count: 3 },
      { week: 'W25', count: 5 },
      { week: 'W26', count: 8 },
      { week: 'W27', count: 12 },
      { week: 'W28', count: 16 },
    ],
    fieldOfficerNote:
      'Margalla foothill drains and residential gardens under peak adult surveillance.',
    activeLarvalSites: 5,
  }),
  baseZone({
    id: 'zone-f7',
    name: 'F-7 Markaz & Jinnah Super',
    district: 'Islamabad Central',
    coordinates: { lat: 33.721, lng: 73.057 },
    riskLevel: 'high',
    riskScore: 74,
    temperature: 28.1,
    humidity: 74,
    rainfallRecent: 32,
    vegetationIndex: 0.36,
    shadeCoverage: 36,
    pastCases: [
      { week: 'W24', count: 2 },
      { week: 'W25', count: 4 },
      { week: 'W26', count: 7 },
      { week: 'W27', count: 10 },
      { week: 'W28', count: 14 },
    ],
    fieldOfficerNote:
      'Commercial markaz planters and rooftop tanks inspected twice weekly.',
    activeLarvalSites: 4,
  }),
  baseZone({
    id: 'zone-bluearea',
    name: 'Blue Area (Jinnah Avenue)',
    district: 'Islamabad Central',
    coordinates: { lat: 33.715, lng: 73.065 },
    riskLevel: 'high',
    riskScore: 80,
    temperature: 29.2,
    humidity: 73,
    rainfallRecent: 30,
    vegetationIndex: 0.34,
    shadeCoverage: 34,
    pastCases: [
      { week: 'W24', count: 5 },
      { week: 'W25', count: 8 },
      { week: 'W26', count: 11 },
      { week: 'W27', count: 15 },
      { week: 'W28', count: 19 },
    ],
    fieldOfficerNote:
      'High pedestrian density corridor — priority fogging near office blocks after rain.',
    activeLarvalSites: 7,
  }),
  baseZone({
    id: 'zone-f8',
    name: 'F-8 & Nazim-ud-Din Road',
    district: 'Islamabad West-Central',
    coordinates: { lat: 33.7095, lng: 73.0425 },
    riskLevel: 'medium',
    riskScore: 58,
    temperature: 28.4,
    humidity: 70,
    rainfallRecent: 26,
    vegetationIndex: 0.33,
    shadeCoverage: 33,
    pastCases: [
      { week: 'W24', count: 2 },
      { week: 'W25', count: 3 },
      { week: 'W26', count: 5 },
      { week: 'W27', count: 7 },
      { week: 'W28', count: 9 },
    ],
    fieldOfficerNote:
      'Park roadside green belts checked for stagnant containers post-monsoon.',
    activeLarvalSites: 3,
  }),
  baseZone({
    id: 'zone-g6',
    name: 'G-6 & Melody Market',
    district: 'Islamabad Central-East',
    coordinates: { lat: 33.7085, lng: 73.091 },
    riskLevel: 'high',
    riskScore: 82,
    temperature: 29.5,
    humidity: 75,
    rainfallRecent: 34,
    vegetationIndex: 0.4,
    shadeCoverage: 40,
    pastCases: [
      { week: 'W24', count: 7 },
      { week: 'W25', count: 10 },
      { week: 'W26', count: 14 },
      { week: 'W27', count: 18 },
      { week: 'W28', count: 24 },
    ],
    fieldOfficerNote:
      'Dense housing blocks and market drains — elevated larval site count.',
    activeLarvalSites: 9,
  }),
  baseZone({
    id: 'zone-g9',
    name: 'G-9 Markaz',
    district: 'Islamabad West',
    coordinates: { lat: 33.6895, lng: 73.034 },
    riskLevel: 'medium',
    riskScore: 64,
    temperature: 29.0,
    humidity: 71,
    rainfallRecent: 28,
    vegetationIndex: 0.3,
    shadeCoverage: 30,
    pastCases: [
      { week: 'W24', count: 4 },
      { week: 'W25', count: 6 },
      { week: 'W26', count: 9 },
      { week: 'W27', count: 12 },
      { week: 'W28', count: 15 },
    ],
    fieldOfficerNote:
      'Karachi Company / G-9 commercial yards monitored for open water drums.',
    activeLarvalSites: 6,
  }),
  baseZone({
    id: 'zone-f10',
    name: 'F-10 & F-11',
    district: 'Islamabad West',
    coordinates: { lat: 33.69, lng: 73.005 },
    riskLevel: 'medium',
    riskScore: 52,
    temperature: 27.9,
    humidity: 68,
    rainfallRecent: 22,
    vegetationIndex: 0.36,
    shadeCoverage: 36,
    pastCases: [
      { week: 'W24', count: 1 },
      { week: 'W25', count: 2 },
      { week: 'W26', count: 3 },
      { week: 'W27', count: 5 },
      { week: 'W28', count: 7 },
    ],
    fieldOfficerNote:
      'Residential sectors with mature tree canopy — shade resting sites prioritized.',
    activeLarvalSites: 4,
  }),
  baseZone({
    id: 'zone-g11',
    name: 'G-11 & G-13',
    district: 'Islamabad South-West',
    coordinates: { lat: 33.665, lng: 72.995 },
    riskLevel: 'medium',
    riskScore: 55,
    temperature: 28.8,
    humidity: 69,
    rainfallRecent: 24,
    vegetationIndex: 0.23,
    shadeCoverage: 23,
    pastCases: [
      { week: 'W24', count: 2 },
      { week: 'W25', count: 3 },
      { week: 'W26', count: 4 },
      { week: 'W27', count: 6 },
      { week: 'W28', count: 8 },
    ],
    fieldOfficerNote:
      'Newer sectors with construction sites — open curing tanks flagged.',
    activeLarvalSites: 5,
  }),
  baseZone({
    id: 'zone-i8',
    name: 'I-8 & I-9 Industrial',
    district: 'Islamabad South',
    coordinates: { lat: 33.658, lng: 73.06 },
    riskLevel: 'medium',
    riskScore: 48,
    temperature: 30.1,
    humidity: 64,
    rainfallRecent: 18,
    vegetationIndex: 0.28,
    shadeCoverage: 28,
    pastCases: [
      { week: 'W24', count: 3 },
      { week: 'W25', count: 5 },
      { week: 'W26', count: 6 },
      { week: 'W27', count: 8 },
      { week: 'W28', count: 10 },
    ],
    fieldOfficerNote:
      'Industrial cooling drums and scrap yards inspected for breeding containers.',
    activeLarvalSites: 8,
  }),
  baseZone({
    id: 'zone-diplomatic',
    name: 'Diplomatic Enclave & Red Zone',
    district: 'Islamabad East',
    coordinates: { lat: 33.725, lng: 73.105 },
    riskLevel: 'low',
    riskScore: 26,
    temperature: 27.5,
    humidity: 62,
    rainfallRecent: 14,
    vegetationIndex: 0.41,
    shadeCoverage: 41,
    pastCases: [
      { week: 'W24', count: 0 },
      { week: 'W25', count: 0 },
      { week: 'W26', count: 1 },
      { week: 'W27', count: 1 },
      { week: 'W28', count: 2 },
    ],
    fieldOfficerNote:
      'Restricted access zone — routine CDA vector team sweeps along green belts.',
    activeLarvalSites: 1,
  }),
];
