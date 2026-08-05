-- Block grid is written by /api/grid-refresh (service role) and offline scripts.
-- Public SELECT already exists from 006_grid_cells.sql.

COMMENT ON TABLE public.grid_cells IS
  'Block-level dengue activity risk. Loaded on page view; refreshed manually/chunked via /api/grid-refresh (Open-Meteo + EE NDVI/LST). Not household-level.';
