-- =============================================================================
-- Dengue ICT — FULL Supabase setup (paste once in SQL Editor → Run)
-- Project: pngvizuhohufggwawxpw
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS)
-- =============================================================================

-- 1) Core schema
CREATE TABLE IF NOT EXISTS public.zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  svg_polygon_path TEXT NOT NULL,
  svg_label_x DOUBLE PRECISION NOT NULL,
  svg_label_y DOUBLE PRECISION NOT NULL,
  field_officer_note TEXT,
  active_larval_sites INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_readings (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  zone_id TEXT NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  temperature DOUBLE PRECISION NOT NULL,
  humidity DOUBLE PRECISION NOT NULL,
  rainfall DOUBLE PRECISION NOT NULL,
  ndvi DOUBLE PRECISION NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  shade_coverage DOUBLE PRECISION,
  weather_as_of DATE,
  source_meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, zone_id)
);

CREATE INDEX IF NOT EXISTS daily_readings_zone_date_idx
  ON public.daily_readings (zone_id, date DESC);

CREATE TABLE IF NOT EXISTS public.dengue_cases (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  zone_id TEXT NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  case_count INTEGER NOT NULL CHECK (case_count >= 0),
  week_label TEXT,
  week_index INTEGER,
  source TEXT,
  scrape_ok BOOLEAN,
  scrape_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dengue_cases_zone_date_idx
  ON public.dengue_cases (zone_id, date DESC);

CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  id BIGSERIAL PRIMARY KEY,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  weather_as_of DATE,
  dengue_as_of DATE,
  dengue_scrape_ok BOOLEAN,
  dengue_scrape_error TEXT,
  zones_updated INTEGER,
  ok BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT
);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dengue_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read zones" ON public.zones;
CREATE POLICY "Public read zones"
  ON public.zones FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read daily_readings" ON public.daily_readings;
CREATE POLICY "Public read daily_readings"
  ON public.daily_readings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read dengue_cases" ON public.dengue_cases;
CREATE POLICY "Public read dengue_cases"
  ON public.dengue_cases FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read pipeline_runs" ON public.pipeline_runs;
CREATE POLICY "Public read pipeline_runs"
  ON public.pipeline_runs FOR SELECT TO anon, authenticated USING (true);

-- 2) ICT zones seed (19 urban + rural)
DELETE FROM public.zones
WHERE id LIKE 'zone-%'
  AND id NOT IN (
    'zone-f6', 'zone-f7', 'zone-bluearea', 'zone-f8', 'zone-g6',
    'zone-diplomatic', 'zone-g9', 'zone-f10', 'zone-g11', 'zone-i8',
    'zone-bharakahu', 'zone-banigala', 'zone-nilore', 'zone-chirah',
    'zone-tarnol', 'zone-golra', 'zone-sihala', 'zone-rawat', 'zone-koral'
  );

INSERT INTO public.zones (
  id, name, district, lat, lng,
  svg_polygon_path, svg_label_x, svg_label_y,
  field_officer_note, active_larval_sites
) VALUES
  ('zone-f6', 'F-6 & Super Market', 'Islamabad Urban', 33.7295, 73.0745, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Margalla foothill drains and residential gardens under peak adult surveillance.', 5),
  ('zone-f7', 'F-7 Markaz & Jinnah Super', 'Islamabad Urban', 33.721, 73.057, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Commercial markaz planters and rooftop tanks inspected twice weekly.', 4),
  ('zone-bluearea', 'Blue Area (Jinnah Avenue)', 'Islamabad Urban', 33.715, 73.065, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'High pedestrian density corridor — priority fogging near office blocks after rain.', 7),
  ('zone-f8', 'F-8 & Nazim-ud-Din Road', 'Islamabad Urban', 33.7095, 73.0425, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Park roadside green belts checked for stagnant containers post-monsoon.', 3),
  ('zone-g6', 'G-6 & Melody Market', 'Islamabad Urban', 33.7085, 73.091, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Dense housing blocks and market drains — elevated larval site count.', 9),
  ('zone-diplomatic', 'Diplomatic Enclave & Red Zone', 'Islamabad Urban', 33.725, 73.105, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Restricted access zone — routine CDA vector team sweeps along green belts.', 1),
  ('zone-g9', 'G-9 Markaz', 'Islamabad Urban', 33.6895, 73.034, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Karachi Company / G-9 commercial yards monitored for open water drums.', 6),
  ('zone-f10', 'F-10 & F-11', 'Islamabad Urban', 33.69, 73.005, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Residential sectors with mature tree canopy — shade resting sites prioritized.', 4),
  ('zone-g11', 'G-11 & G-13', 'Islamabad Urban', 33.665, 72.995, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Newer sectors with construction sites — open curing tanks flagged.', 5),
  ('zone-i8', 'I-8 & I-9 Industrial', 'Islamabad Urban', 33.658, 73.06, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Industrial cooling drums and scrap yards inspected for breeding containers.', 8),
  ('zone-bharakahu', 'Bharakahu Bazaar', 'Islamabad Rural', 33.742, 73.185, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Peri-urban bazaar and hillside housing — check storage tanks and nullah edges.', 6),
  ('zone-banigala', 'Banigala / Simly Road', 'Islamabad Rural', 33.755, 73.165, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Village clusters along Simly Road — elevated vegetation and domestic water storage.', 4),
  ('zone-nilore', 'Nilore', 'Islamabad Rural', 33.655, 73.155, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Institutional + village mix east of the city — monsoon puddles in open plots.', 5),
  ('zone-chirah', 'Chirah', 'Islamabad Rural', 33.7, 73.2, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Eastern rural belt — prioritize overhead tanks and animal-trough containers.', 3),
  ('zone-tarnol', 'Tarnol', 'Islamabad Rural', 33.648, 72.915, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Western approach corridor — construction and village compounds after rain.', 5),
  ('zone-golra', 'Golra Sharif', 'Islamabad Rural', 33.675, 72.965, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Pilgrimage / settlement area — dense human activity near shaded courtyards.', 4),
  ('zone-sihala', 'Sihala', 'Islamabad Rural', 33.555, 73.205, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'Southern rural node — agricultural edges and roadside settlements.', 4),
  ('zone-rawat', 'Rawat', 'Islamabad Rural', 33.498, 73.195, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'GT Road fringe — warehouses and residential pockets with open drums.', 3),
  ('zone-koral', 'Koral', 'Islamabad Rural', 33.575, 73.125, 'M 0,0 L 1,0 L 1,1 L 0,1 Z', 0, 0, 'South-east rural belt — seasonal water collection in yards and fields.', 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  district = EXCLUDED.district,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  svg_polygon_path = EXCLUDED.svg_polygon_path,
  svg_label_x = EXCLUDED.svg_label_x,
  svg_label_y = EXCLUDED.svg_label_y,
  field_officer_note = EXCLUDED.field_officer_note,
  active_larval_sites = EXCLUDED.active_larval_sites,
  updated_at = now();

-- 3) Terrain depressions (structural DEM seed)
CREATE TABLE IF NOT EXISTS public.terrain_depressions (
  zone_id TEXT PRIMARY KEY REFERENCES public.zones(id) ON DELETE CASCADE,
  depression_depth_avg DOUBLE PRECISION NOT NULL,
  depression_area_pct DOUBLE PRECISION NOT NULL,
  depression_risk_score INTEGER NOT NULL CHECK (
    depression_risk_score >= 0 AND depression_risk_score <= 100
  ),
  dem_source TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.terrain_depressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read terrain_depressions" ON public.terrain_depressions;
CREATE POLICY "Public read terrain_depressions"
  ON public.terrain_depressions FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.terrain_depressions (
  zone_id, depression_depth_avg, depression_area_pct,
  depression_risk_score, dem_source, computed_at
)
VALUES
  ('zone-f6', 0.008, 0.8, 3, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:48:53.822Z'),
  ('zone-f7', 0.05, 3.3, 14, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:48:59.127Z'),
  ('zone-bluearea', 0.107, 6.6, 30, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:49:04.440Z'),
  ('zone-f8', 0.041, 2.5, 11, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:49:09.759Z'),
  ('zone-g6', 0.182, 6.6, 39, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:49:15.069Z'),
  ('zone-diplomatic', 0.074, 4.1, 19, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:49:20.403Z'),
  ('zone-g9', 0.24, 7.4, 48, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:49:25.714Z'),
  ('zone-f10', 0.231, 9.1, 51, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:49:31.027Z'),
  ('zone-g11', 0.05, 2.5, 12, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:50:22.515Z'),
  ('zone-i8', 0.207, 9.9, 50, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:50:28.029Z'),
  ('zone-bharakahu', 0.215, 7.4, 45, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:50:33.349Z'),
  ('zone-banigala', 0.165, 5.8, 35, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:50:38.686Z'),
  ('zone-nilore', 0.347, 15.7, 82, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:50:44.033Z'),
  ('zone-chirah', 0.182, 7.4, 41, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:51:36.091Z'),
  ('zone-tarnol', 0.083, 3.3, 18, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:51:41.401Z'),
  ('zone-golra', 0.091, 5, 24, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:51:46.711Z'),
  ('zone-sihala', 0.132, 7.4, 35, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:51:52.025Z'),
  ('zone-rawat', 0.041, 1.7, 9, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T20:00:17.115Z'),
  ('zone-koral', 0.43, 9.9, 77, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T20:00:22.429Z')
ON CONFLICT (zone_id) DO UPDATE SET
  depression_depth_avg = EXCLUDED.depression_depth_avg,
  depression_area_pct = EXCLUDED.depression_area_pct,
  depression_risk_score = EXCLUDED.depression_risk_score,
  dem_source = EXCLUDED.dem_source,
  computed_at = EXCLUDED.computed_at;

-- 4) Block grid cache (50m cells — written by Refresh / Analyzing)
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
  building_density DOUBLE PRECISION,
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
CREATE INDEX IF NOT EXISTS grid_cells_latlng_idx ON public.grid_cells (lat, lng);

ALTER TABLE public.grid_cells ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read grid_cells" ON public.grid_cells;
CREATE POLICY "Public read grid_cells"
  ON public.grid_cells FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE public.grid_cells IS
  'Block-level dengue activity risk. Cached for page load; refreshed via /api/grid-refresh (Open-Meteo + EE NDVI/LST). Not household-level.';
COMMENT ON COLUMN public.grid_cells.building_density IS
  'Settlement/structure density proxy — not identifiable addresses.';
