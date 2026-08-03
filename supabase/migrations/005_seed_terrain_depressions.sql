-- Seed terrain_depressions from offline batch (NOT daily cron).
-- Source: data/terrain_depressions.json — regenerate via: npm run terrain && node scripts/export-terrain-seed.mjs

INSERT INTO public.terrain_depressions (
  zone_id, depression_depth_avg, depression_area_pct,
  depression_risk_score, dem_source, computed_at
)
VALUES
  ('zone-f6', 0.008, 0.8, 3, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:33:15.256Z'),
  ('zone-f7', 0.05, 3.3, 14, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:33:20.581Z'),
  ('zone-bluearea', 0.107, 6.6, 30, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:33:25.914Z'),
  ('zone-f8', 0.041, 2.5, 11, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:33:31.236Z'),
  ('zone-g6', 0.182, 6.6, 39, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:33:36.564Z'),
  ('zone-diplomatic', 0.074, 4.1, 19, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:34:28.086Z'),
  ('zone-g9', 0.24, 7.4, 48, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:34:33.416Z'),
  ('zone-f10', 0.231, 9.1, 51, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:34:38.752Z'),
  ('zone-g11', 0.05, 2.5, 12, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:34:44.070Z'),
  ('zone-i8', 0.207, 9.9, 50, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:34:49.384Z'),
  ('zone-bharakahu', 0.215, 7.4, 45, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:35:10.345Z'),
  ('zone-banigala', 0.165, 5.8, 35, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:35:15.675Z'),
  ('zone-nilore', 0.347, 15.7, 82, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:35:20.984Z'),
  ('zone-chirah', 0.182, 7.4, 41, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:35:26.305Z'),
  ('zone-tarnol', 0.083, 3.3, 18, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:35:31.895Z'),
  ('zone-golra', 0.091, 5, 24, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:36:23.434Z'),
  ('zone-sihala', 0.132, 7.4, 35, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:36:28.760Z'),
  ('zone-rawat', 0.041, 1.7, 9, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:36:34.065Z'),
  ('zone-koral', 0.43, 9.9, 77, 'Open-Meteo elevation DEM (~90m) + Priority-Flood fill', '2026-08-03T19:36:39.460Z')
ON CONFLICT (zone_id) DO UPDATE SET
  depression_depth_avg = EXCLUDED.depression_depth_avg,
  depression_area_pct = EXCLUDED.depression_area_pct,
  depression_risk_score = EXCLUDED.depression_risk_score,
  dem_source = EXCLUDED.dem_source,
  computed_at = EXCLUDED.computed_at;
