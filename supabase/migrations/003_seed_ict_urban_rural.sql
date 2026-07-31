-- Expand ICT zones: urban sectors + rural tehsil circles (safe to re-run)
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
