/**
 * Static Islamabad zone geometry + identity (does not change with live feeds).
 * Preserves the mockZones shape fields required by the map UI.
 * Leaflet heatmap uses coordinates; svg paths kept for schema compatibility.
 */

export interface ZoneMeta {
  id: string;
  name: string;
  district: string;
  coordinates: { lat: number; lng: number };
  svgPolygonPath: string;
  svgLabelCoord: { x: number; y: number };
  precautions?: string[];
  fieldOfficerNote?: string;
  activeLarvalSites?: number;
}

/** Approximate city center for map init */
export const ISLAMABAD_CENTER = { lat: 33.6938, lng: 73.0652 };

export const ZONE_META: ZoneMeta[] = [
  {
    id: 'zone-f6',
    name: 'F-6 & Super Market',
    district: 'Islamabad Central',
    coordinates: { lat: 33.7295, lng: 73.0745 },
    svgPolygonPath: 'M 350,120 L 470,110 L 490,200 L 370,210 Z',
    svgLabelCoord: { x: 420, y: 155 },
    fieldOfficerNote:
      'Margalla foothill drains and residential gardens under peak adult surveillance.',
    activeLarvalSites: 5,
  },
  {
    id: 'zone-f7',
    name: 'F-7 Markaz & Jinnah Super',
    district: 'Islamabad Central',
    coordinates: { lat: 33.721, lng: 73.057 },
    svgPolygonPath: 'M 300,160 L 420,150 L 430,250 L 310,260 Z',
    svgLabelCoord: { x: 365, y: 205 },
    fieldOfficerNote:
      'Commercial markaz planters and rooftop tanks inspected twice weekly.',
    activeLarvalSites: 4,
  },
  {
    id: 'zone-bluearea',
    name: 'Blue Area (Jinnah Avenue)',
    district: 'Islamabad Central',
    coordinates: { lat: 33.715, lng: 73.065 },
    svgPolygonPath: 'M 340,200 L 480,190 L 490,280 L 350,290 Z',
    svgLabelCoord: { x: 415, y: 240 },
    fieldOfficerNote:
      'High pedestrian density corridor — priority fogging near office blocks after rain.',
    activeLarvalSites: 7,
  },
  {
    id: 'zone-f8',
    name: 'F-8 & Nazim-ud-Din Road',
    district: 'Islamabad West-Central',
    coordinates: { lat: 33.7095, lng: 73.0425 },
    svgPolygonPath: 'M 220,180 L 340,170 L 350,270 L 230,280 Z',
    svgLabelCoord: { x: 285, y: 225 },
    fieldOfficerNote:
      'Park roadside green belts checked for stagnant containers post-monsoon.',
    activeLarvalSites: 3,
  },
  {
    id: 'zone-g6',
    name: 'G-6 & Melody Market',
    district: 'Islamabad Central-East',
    coordinates: { lat: 33.7085, lng: 73.091 },
    svgPolygonPath: 'M 480,180 L 600,170 L 610,270 L 490,280 Z',
    svgLabelCoord: { x: 545, y: 225 },
    fieldOfficerNote:
      'Dense housing blocks and market drains — elevated larval site count.',
    activeLarvalSites: 9,
  },
  {
    id: 'zone-g9',
    name: 'G-9 Markaz',
    district: 'Islamabad West',
    coordinates: { lat: 33.6895, lng: 73.034 },
    svgPolygonPath: 'M 200,280 L 330,270 L 340,370 L 210,380 Z',
    svgLabelCoord: { x: 270, y: 325 },
    fieldOfficerNote:
      'Karachi Company / G-9 commercial yards monitored for open water drums.',
    activeLarvalSites: 6,
  },
  {
    id: 'zone-f10',
    name: 'F-10 & F-11',
    district: 'Islamabad West',
    coordinates: { lat: 33.69, lng: 73.005 },
    svgPolygonPath: 'M 120,260 L 250,250 L 260,360 L 130,370 Z',
    svgLabelCoord: { x: 190, y: 310 },
    fieldOfficerNote:
      'Residential sectors with mature tree canopy — shade resting sites prioritized.',
    activeLarvalSites: 4,
  },
  {
    id: 'zone-g11',
    name: 'G-11 & G-13',
    district: 'Islamabad South-West',
    coordinates: { lat: 33.665, lng: 72.995 },
    svgPolygonPath: 'M 100,380 L 240,370 L 250,480 L 110,490 Z',
    svgLabelCoord: { x: 175, y: 430 },
    fieldOfficerNote:
      'Newer sectors with construction sites — open curing tanks flagged.',
    activeLarvalSites: 5,
  },
  {
    id: 'zone-i8',
    name: 'I-8 & I-9 Industrial',
    district: 'Islamabad South',
    coordinates: { lat: 33.658, lng: 73.06 },
    svgPolygonPath: 'M 320,400 L 470,390 L 480,500 L 330,510 Z',
    svgLabelCoord: { x: 400, y: 450 },
    fieldOfficerNote:
      'Industrial cooling drums and scrap yards inspected for breeding containers.',
    activeLarvalSites: 8,
  },
  {
    id: 'zone-diplomatic',
    name: 'Diplomatic Enclave & Red Zone',
    district: 'Islamabad East',
    coordinates: { lat: 33.725, lng: 73.105 },
    svgPolygonPath: 'M 560,140 L 720,130 L 730,240 L 570,250 Z',
    svgLabelCoord: { x: 645, y: 185 },
    fieldOfficerNote:
      'Restricted access zone — routine CDA vector team sweeps along green belts.',
    activeLarvalSites: 1,
  },
];
