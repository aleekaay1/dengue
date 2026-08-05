/** Block-level map helpers — ministry presentation (not household-level). */

import { calculateRisk } from '../../lib/riskModel';

export interface GridCellDto {
  cellId: string;
  lat: number;
  lng: number;
  west: number;
  south: number;
  east: number;
  north: number;
  zoneId: string;
  tehsil: string;
  ndvi: number;
  lst?: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  depressionScore: number;
  settlementDensity: number;
  population: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  peopleAtRisk: number;
}

export type GridOverlay = 'risk' | 'vegetation' | 'cases' | 'terrain';

export function cellIntensity(cell: GridCellDto, overlay: GridOverlay): number {
  if (overlay === 'vegetation') return Math.min(1, Math.max(0.08, cell.ndvi / 0.55));
  if (overlay === 'terrain')
    return Math.min(1, Math.max(0.08, cell.depressionScore / 100));
  if (overlay === 'cases')
    return Math.min(1, Math.max(0.08, cell.peopleAtRisk / 1200));
  // Stretch mid-band scores so medium risk reads clearly on the map
  return Math.min(1, Math.max(0.12, (cell.riskScore / 100) * 1.25));
}

/** Opaque choropleth fill for ministry-readable blocks */
export function cellFillColor(intensity: number, overlay: GridOverlay): string {
  const t = Math.min(1, Math.max(0, intensity));
  if (overlay === 'vegetation') {
    const g = Math.round(90 + t * 140);
    return `rgb(12, ${g}, 48)`;
  }
  if (overlay === 'terrain') {
    return `rgb(2, ${Math.round(90 + t * 100)}, ${Math.round(140 + t * 80)})`;
  }
  if (overlay === 'cases') {
    return `rgb(${Math.round(200 + t * 40)}, ${Math.round(50 + (1 - t) * 60)}, 20)`;
  }
  if (t < 0.35) {
    const u = t / 0.35;
    return `rgb(${Math.round(20 + u * 40)}, ${Math.round(90 + u * 100)}, ${Math.round(200 - u * 40)})`;
  }
  if (t < 0.55) {
    const u = (t - 0.35) / 0.2;
    return `rgb(${Math.round(60 + u * 170)}, ${Math.round(190 - u * 40)}, ${Math.round(160 - u * 120)})`;
  }
  if (t < 0.75) {
    const u = (t - 0.55) / 0.2;
    return `rgb(${Math.round(230)}, ${Math.round(150 - u * 90)}, ${Math.round(40 - u * 20)})`;
  }
  const u = (t - 0.75) / 0.25;
  return `rgb(${Math.round(210 - u * 30)}, ${Math.round(40 - u * 25)}, ${Math.round(25)})`;
}

/** Hover / click: why this block has this score — from real cell inputs */
export function cellPopupHtml(cell: GridCellDto, cellSizeM: number): string {
  const risk = calculateRisk({
    temperature: cell.temperature || 29,
    humidity: cell.humidity || 60,
    vegetationIndex: cell.ndvi,
    rainfallRecent: cell.rainfall ?? 0,
    pastCases: [],
    depressionRiskScore: cell.depressionScore,
    settlementDensity: cell.settlementDensity,
  });

  const factors = risk.contributingFactors
    .map(
      (f) =>
        `<li style="margin:0 0 6px;padding:0"><b>${f.factor}</b><br/><span style="opacity:.85">${f.description}</span></li>`
    )
    .join('');

  const lstLine =
    cell.lst != null && cell.lst > 0
      ? `<div><b>Land surface temp (Landsat)</b> ${cell.lst.toFixed(1)}°C</div>`
      : '';

  return `
    <div style="min-width:260px;max-width:320px;font-family:'Segoe UI',system-ui,sans-serif;font-size:12px;line-height:1.4;color:#1a1a1a">
      <div style="font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px;color:#1F3D2E">
        Block surveillance cell
      </div>
      <div style="font-size:11px;color:#5C5E54;margin-bottom:8px">
        ${cellSizeM}m × ${cellSizeM}m · ${cell.tehsil || cell.zoneId} · not household-level
      </div>
      <div style="background:#1F3D2E;color:#EDE6D6;padding:8px 10px;border-radius:2px;margin-bottom:8px">
        <div style="font-size:11px;opacity:.8;text-transform:uppercase">Activity score</div>
        <div style="font-size:22px;font-weight:800">${cell.riskScore}<span style="font-size:12px;opacity:.7"> / 100</span>
          <span style="font-size:12px;margin-left:8px;text-transform:uppercase">${cell.riskLevel}</span>
        </div>
      </div>
      <div style="font-weight:700;margin-bottom:4px;color:#1F3D2E">Why this block</div>
      <ul style="margin:0 0 8px 16px;padding:0">${factors || '<li>Environmental inputs below threshold for listed factors.</li>'}</ul>
      <div style="border-top:1px solid #DDD3C1;padding-top:6px;font-size:11px;color:#3a3a3a">
        <div><b>NDVI (Sentinel-2)</b> ${cell.ndvi.toFixed(2)}</div>
        ${lstLine}
        <div><b>Air temp used in model</b> ${cell.temperature.toFixed(1)}°C · <b>Humidity</b> ${cell.humidity}%</div>
        <div><b>Rain ~48h</b> ${cell.rainfall} mm · <b>Terrain sink</b> ${cell.depressionScore}/100</div>
        <div><b>Settlement / structure density</b> ${Math.round(cell.settlementDensity * 100)}%</div>
        <div><b>People-at-risk index</b> ${cell.peopleAtRisk} (score × pop proxy)</div>
      </div>
    </div>
  `;
}
