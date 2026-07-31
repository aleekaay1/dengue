-- Dengue Surveillance Dashboard — initial schema
-- Public read-only dashboard: anon SELECT allowed; writes via service role only.

-- Zones: static identity + map geometry
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

-- One environmental + risk reading per zone per day
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

-- Dengue case counts (weekly series flattened per refresh)
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

-- Pipeline run log (freshness / scrape failures)
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

-- Row Level Security: public read, no anon writes
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dengue_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read zones"
  ON public.zones FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read daily_readings"
  ON public.daily_readings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read dengue_cases"
  ON public.dengue_cases FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read pipeline_runs"
  ON public.pipeline_runs FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role bypasses RLS by default; no INSERT/UPDATE/DELETE policies for anon.
