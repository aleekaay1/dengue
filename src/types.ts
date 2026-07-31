export type RiskLevel = 'low' | 'medium' | 'high';

export interface CaseHistory {
  week: string; // e.g. "Week 26"
  count: number;
}

export interface ContributingFactor {
  factor: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
  scoreContribution: number;
}

export interface ZoneData {
  id: string;
  name: string;
  district: string;
  coordinates: { lat: number; lng: number };
  svgPolygonPath: string; // SVG path data for spatial rendering
  svgLabelCoord: { x: number; y: number }; // Relative coordinates for map label placement
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  temperature: number; // °C
  humidity: number; // %
  rainfallRecent: number; // mm in last 48 hours
  vegetationIndex: number; // 0.0 - 1.0 (NDVI score)
  shadeCoverage: number; // % estimated canopy/shade cover
  pastCases: CaseHistory[];
  trend: number[]; // Last 7 days risk score history
  lastUpdated: string;
  contributingFactors: ContributingFactor[];
  precautions: string[];
  fieldOfficerNote?: string;
  activeLarvalSites?: number;
}

export interface CityConditions {
  cityName: string;
  province: string;
  temperature: number; // °C
  humidity: number; // %
  rainfall: number; // mm
  averageNDVI: number; // 0.0 - 1.0
  date: string;
  lastUpdatedTime: string;
  activeHighRiskZones: number;
  totalZonesMonitored: number;
  seasonalAlertStatus: string;
}

/** Data-source freshness surfaced in the UI */
export interface DataFreshnessState {
  weatherAsOf: string | null;
  weatherLagged: boolean;
  vegetationAsOf: string | null;
  dengueAsOf: string | null;
  dengueStale: boolean;
  dengueScrapeOk: boolean;
  dengueScrapeError?: string;
}

export type ActiveTab = 'dashboard' | 'overview' | 'methodology' | 'admin';

export type MapOverlay = 'risk' | 'vegetation' | 'cases';

export interface FilterState {
  riskLevel: 'all' | RiskLevel;
  searchQuery: string;
  sortBy: 'riskScore' | 'name' | 'cases' | 'humidity';
  sortOrder: 'asc' | 'desc';
}
