-- Structural standing-water / terrain depression risk per zone.
--
-- IMPORTANT (maintenance): This table is written by the ONSITE / offline batch
-- scripts only (scripts/compute-terrain.ts or scripts/terrain/compute_depressions.py).
-- Do NOT refresh this from the daily weather/NDVI cron — DEM sinks change only when
-- the landform changes (re-run quarterly or after major earthworks).

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

CREATE POLICY "Public read terrain_depressions"
  ON public.terrain_depressions FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.terrain_depressions IS
  'Rarely updated structural DEM depression metrics — not part of daily cron.';
