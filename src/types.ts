export type RiskLevel = 'low' | 'medium' | 'high';

export interface CaseHistory {
  week: string; // e.g. "Week 26"
  count: number;
}

export interface ContributingFactor {
  factor: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
  /** Points this factor currently adds to the 0–100 score */
  scoreContribution: number;
  /** Maximum points this factor can contribute at full weight */
  maxContribution?: number;
}

export type AreaType = 'urban' | 'rural';

export interface ZoneData {
  id: string;
  name: string;
  /** Islamabad Urban | Islamabad Rural */
  district: string;
  /** Surveillance tehsil / circle */
  tehsil: string;
  areaType: AreaType;
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
  /** Structural DEM depression metrics (rare refresh — not daily weather) */
  depressionDepthAvg?: number;
  depressionAreaPct?: number;
  /** 0–100 standing-water / terrain sink risk */
  depressionRiskScore?: number;
  /** Block-grid rollup insights (from 50 m cells) */
  gridCellCount?: number;
  meanSettlementDensity?: number;
  peopleAtRisk?: number;
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

export type MapOverlay = 'risk' | 'vegetation' | 'cases' | 'terrain';

export interface FilterState {
  riskLevel: 'all' | RiskLevel;
  searchQuery: string;
  sortBy: 'riskScore' | 'name' | 'cases' | 'humidity';
  sortOrder: 'asc' | 'desc';
}
