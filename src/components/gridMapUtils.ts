/** Shared helpers for block-level grid map rendering (not household-level). */

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
  if (overlay === 'vegetation') return Math.min(1, Math.max(0.05, cell.ndvi));
  if (overlay === 'terrain')
    return Math.min(1, Math.max(0.05, cell.depressionScore / 100));
  if (overlay === 'cases')
    return Math.min(1, Math.max(0.05, cell.peopleAtRisk / 2000));
  return Math.min(1, Math.max(0.05, cell.riskScore / 100));
}

/** True geographic color for a cell — used for zoomed-in rectangles */
export function cellFillColor(intensity: number, overlay: GridOverlay): string {
  const t = Math.min(1, Math.max(0, intensity));
  if (overlay === 'vegetation') {
    const g = Math.round(80 + t * 120);
    return `rgba(20, ${g}, 45, 0.55)`;
  }
  if (overlay === 'terrain') {
    return `rgba(3, ${Math.round(100 + t * 80)}, ${Math.round(160 + t * 60)}, 0.55)`;
  }
  if (overlay === 'cases') {
    return `rgba(${Math.round(180 + t * 60)}, ${Math.round(40 + (1 - t) * 80)}, 30, 0.55)`;
  }
  // risk: blue → yellow → red
  if (t < 0.4) {
    const u = t / 0.4;
    return `rgba(${Math.round(30 + u * 200)}, ${Math.round(100 + u * 100)}, ${Math.round(220 - u * 100)}, 0.55)`;
  }
  if (t < 0.7) {
    const u = (t - 0.4) / 0.3;
    return `rgba(${Math.round(230 + u * 20)}, ${Math.round(200 - u * 100)}, 40, 0.55)`;
  }
  const u = (t - 0.7) / 0.3;
  return `rgba(${Math.round(220 - u * 40)}, ${Math.round(40 - u * 20)}, 30, 0.6)`;
}

export function cellPopupHtml(cell: GridCellDto, cellSizeM: number): string {
  return `
    <div style="min-width:200px;font-family:system-ui,sans-serif;font-size:12px;line-height:1.35">
      <div style="font-weight:800;text-transform:uppercase;margin-bottom:4px">Block-level risk</div>
      <div style="opacity:.7;margin-bottom:6px">${cellSizeM}m grid cell · not household</div>
      <div><b>Score</b> ${cell.riskScore}/100 (${cell.riskLevel})</div>
      <div><b>NDVI</b> ${cell.ndvi.toFixed(2)} · <b>Temp</b> ${cell.temperature.toFixed(1)}°C</div>
      <div><b>Humidity</b> ${cell.humidity}% · <b>Rain ~48h</b> ${cell.rainfall} mm</div>
      <div><b>Terrain sink</b> ${cell.depressionScore}/100</div>
      <div><b>Settlement density</b> ${Math.round(cell.settlementDensity * 100)}%</div>
      <div><b>People-at-risk index</b> ${cell.peopleAtRisk}</div>
      <div style="margin-top:4px;opacity:.65">Zone rollup: ${cell.zoneId} · ${cell.tehsil}</div>
    </div>
  `;
}
