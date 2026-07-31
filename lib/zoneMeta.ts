/**
 * Static ICT zone identity for the map UI + live pipeline.
 * District = Urban / Rural. Tehsil = surveillance circle (ICT has no classic
 * Punjab-style tehsils; these match common rural circles + urban clusters).
 */

export type AreaType = 'urban' | 'rural';

export interface ZoneMeta {
  id: string;
  name: string;
  /** Islamabad Urban | Islamabad Rural */
  district: string;
  /** Surveillance tehsil / circle */
  tehsil: string;
  areaType: AreaType;
  coordinates: { lat: number; lng: number };
  svgPolygonPath: string;
  svgLabelCoord: { x: number; y: number };
  precautions?: string[];
  fieldOfficerNote?: string;
  activeLarvalSites?: number;
}

export const ISLAMABAD_CENTER = { lat: 33.6938, lng: 73.0652 };

export const TEHSILS = [
  'Urban Core',
  'Urban West',
  'Urban South',
  'Bharakahu',
  'Nilore',
  'Tarnol',
  'Sihala',
] as const;

export type TehsilName = (typeof TEHSILS)[number];

const stubPath = 'M 0,0 L 1,0 L 1,1 L 0,1 Z';

export const ZONE_META: ZoneMeta[] = [
  // —— Urban Core ——
  {
    id: 'zone-f6',
    name: 'F-6 & Super Market',
    district: 'Islamabad Urban',
    tehsil: 'Urban Core',
    areaType: 'urban',
    coordinates: { lat: 33.7295, lng: 73.0745 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Margalla foothill drains and residential gardens under peak adult surveillance.',
    activeLarvalSites: 5,
  },
  {
    id: 'zone-f7',
    name: 'F-7 Markaz & Jinnah Super',
    district: 'Islamabad Urban',
    tehsil: 'Urban Core',
    areaType: 'urban',
    coordinates: { lat: 33.721, lng: 73.057 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Commercial markaz planters and rooftop tanks inspected twice weekly.',
    activeLarvalSites: 4,
  },
  {
    id: 'zone-bluearea',
    name: 'Blue Area (Jinnah Avenue)',
    district: 'Islamabad Urban',
    tehsil: 'Urban Core',
    areaType: 'urban',
    coordinates: { lat: 33.715, lng: 73.065 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'High pedestrian density corridor — priority fogging near office blocks after rain.',
    activeLarvalSites: 7,
  },
  {
    id: 'zone-f8',
    name: 'F-8 & Nazim-ud-Din Road',
    district: 'Islamabad Urban',
    tehsil: 'Urban Core',
    areaType: 'urban',
    coordinates: { lat: 33.7095, lng: 73.0425 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Park roadside green belts checked for stagnant containers post-monsoon.',
    activeLarvalSites: 3,
  },
  {
    id: 'zone-g6',
    name: 'G-6 & Melody Market',
    district: 'Islamabad Urban',
    tehsil: 'Urban Core',
    areaType: 'urban',
    coordinates: { lat: 33.7085, lng: 73.091 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Dense housing blocks and market drains — elevated larval site count.',
    activeLarvalSites: 9,
  },
  {
    id: 'zone-diplomatic',
    name: 'Diplomatic Enclave & Red Zone',
    district: 'Islamabad Urban',
    tehsil: 'Urban Core',
    areaType: 'urban',
    coordinates: { lat: 33.725, lng: 73.105 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Restricted access zone — routine CDA vector team sweeps along green belts.',
    activeLarvalSites: 1,
  },

  // —— Urban West ——
  {
    id: 'zone-g9',
    name: 'G-9 Markaz',
    district: 'Islamabad Urban',
    tehsil: 'Urban West',
    areaType: 'urban',
    coordinates: { lat: 33.6895, lng: 73.034 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Karachi Company / G-9 commercial yards monitored for open water drums.',
    activeLarvalSites: 6,
  },
  {
    id: 'zone-f10',
    name: 'F-10 & F-11',
    district: 'Islamabad Urban',
    tehsil: 'Urban West',
    areaType: 'urban',
    coordinates: { lat: 33.69, lng: 73.005 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Residential sectors with mature tree canopy — shade resting sites prioritized.',
    activeLarvalSites: 4,
  },
  {
    id: 'zone-g11',
    name: 'G-11 & G-13',
    district: 'Islamabad Urban',
    tehsil: 'Urban West',
    areaType: 'urban',
    coordinates: { lat: 33.665, lng: 72.995 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Newer sectors with construction sites — open curing tanks flagged.',
    activeLarvalSites: 5,
  },

  // —— Urban South ——
  {
    id: 'zone-i8',
    name: 'I-8 & I-9 Industrial',
    district: 'Islamabad Urban',
    tehsil: 'Urban South',
    areaType: 'urban',
    coordinates: { lat: 33.658, lng: 73.06 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Industrial cooling drums and scrap yards inspected for breeding containers.',
    activeLarvalSites: 8,
  },

  // —— Rural Bharakahu ——
  {
    id: 'zone-bharakahu',
    name: 'Bharakahu Bazaar',
    district: 'Islamabad Rural',
    tehsil: 'Bharakahu',
    areaType: 'rural',
    coordinates: { lat: 33.742, lng: 73.185 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Peri-urban bazaar and hillside housing — check storage tanks and nullah edges.',
    activeLarvalSites: 6,
  },
  {
    id: 'zone-banigala',
    name: 'Banigala / Simly Road',
    district: 'Islamabad Rural',
    tehsil: 'Bharakahu',
    areaType: 'rural',
    coordinates: { lat: 33.755, lng: 73.165 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Village clusters along Simly Road — elevated vegetation and domestic water storage.',
    activeLarvalSites: 4,
  },

  // —— Rural Nilore ——
  {
    id: 'zone-nilore',
    name: 'Nilore',
    district: 'Islamabad Rural',
    tehsil: 'Nilore',
    areaType: 'rural',
    coordinates: { lat: 33.655, lng: 73.155 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Institutional + village mix east of the city — monsoon puddles in open plots.',
    activeLarvalSites: 5,
  },
  {
    id: 'zone-chirah',
    name: 'Chirah',
    district: 'Islamabad Rural',
    tehsil: 'Nilore',
    areaType: 'rural',
    coordinates: { lat: 33.7, lng: 73.2 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Eastern rural belt — prioritize overhead tanks and animal-trough containers.',
    activeLarvalSites: 3,
  },

  // —— Rural Tarnol ——
  {
    id: 'zone-tarnol',
    name: 'Tarnol',
    district: 'Islamabad Rural',
    tehsil: 'Tarnol',
    areaType: 'rural',
    coordinates: { lat: 33.648, lng: 72.915 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Western approach corridor — construction and village compounds after rain.',
    activeLarvalSites: 5,
  },
  {
    id: 'zone-golra',
    name: 'Golra Sharif',
    district: 'Islamabad Rural',
    tehsil: 'Tarnol',
    areaType: 'rural',
    coordinates: { lat: 33.675, lng: 72.965 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Pilgrimage / settlement area — dense human activity near shaded courtyards.',
    activeLarvalSites: 4,
  },

  // —— Rural Sihala ——
  {
    id: 'zone-sihala',
    name: 'Sihala',
    district: 'Islamabad Rural',
    tehsil: 'Sihala',
    areaType: 'rural',
    coordinates: { lat: 33.555, lng: 73.205 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'Southern rural node — agricultural edges and roadside settlements.',
    activeLarvalSites: 4,
  },
  {
    id: 'zone-rawat',
    name: 'Rawat',
    district: 'Islamabad Rural',
    tehsil: 'Sihala',
    areaType: 'rural',
    coordinates: { lat: 33.498, lng: 73.195 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'GT Road fringe — warehouses and residential pockets with open drums.',
    activeLarvalSites: 3,
  },
  {
    id: 'zone-koral',
    name: 'Koral',
    district: 'Islamabad Rural',
    tehsil: 'Sihala',
    areaType: 'rural',
    coordinates: { lat: 33.575, lng: 73.125 },
    svgPolygonPath: stubPath,
    svgLabelCoord: { x: 0, y: 0 },
    fieldOfficerNote:
      'South-east rural belt — seasonal water collection in yards and fields.',
    activeLarvalSites: 3,
  },
];
