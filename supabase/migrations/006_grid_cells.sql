-- Block-level ICT risk grid (50 m cells).
-- Written by offline batch scripts/compute-grid.ts — NOT by page load.
-- Cadence: weather/rain daily; NDVI ~weekly; DEM/OSM settlement quarterly.
-- Framing: block / grid cell — never household or home-level.

CREATE TABLE IF NOT EXISTS public.grid_cells (
  cell_id TEXT PRIMARY KEY,
  zone_id TEXT REFERENCES public.zones(id) ON DELETE SET NULL,
  tehsil TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  west DOUBLE PRECISION NOT NULL,
  south DOUBLE PRECISION NOT NULL,
  east DOUBLE PRECISION NOT NULL,
  north DOUBLE PRECISION NOT NULL,
  ndvi DOUBLE PRECISION,
  lst DOUBLE PRECISION,
  temperature DOUBLE PRECISION,
  humidity DOUBLE PRECISION,
  rainfall DOUBLE PRECISION,
  depression_score INTEGER,
  building_density DOUBLE PRECISION, -- settlement/structure density 0–1
  population DOUBLE PRECISION,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  people_at_risk DOUBLE PRECISION,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  layer_meta JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS grid_cells_zone_idx ON public.grid_cells (zone_id);
CREATE INDEX IF NOT EXISTS grid_cells_risk_idx ON public.grid_cells (risk_score DESC);
CREATE INDEX IF NOT EXISTS grid_cells_bbox_idx ON public.grid_cells (west, south, east, north);

ALTER TABLE public.grid_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read grid_cells"
  ON public.grid_cells FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.grid_cells IS
  'Block-level dengue activity risk. Offline batch only — not daily EE on Vercel.';
COMMENT ON COLUMN public.grid_cells.building_density IS
  'Settlement/structure density from OSM footprints — not identifiable addresses.';
