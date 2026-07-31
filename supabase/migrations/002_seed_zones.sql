-- Seed static Islamabad zone geometry (safe to re-run)
-- Removes legacy Lahore zone IDs if present (cascades readings/cases).
DELETE FROM public.zones
WHERE id LIKE 'zone-%'
  AND id NOT IN (
    'zone-f6', 'zone-f7', 'zone-bluearea', 'zone-f8', 'zone-g6',
    'zone-g9', 'zone-f10', 'zone-g11', 'zone-i8', 'zone-diplomatic'
  );

INSERT INTO public.zones (
  id, name, district, lat, lng,
  svg_polygon_path, svg_label_x, svg_label_y,
  field_officer_note, active_larval_sites
) VALUES
  ('zone-f6', 'F-6 & Super Market', 'Islamabad Central', 33.7295, 73.0745,
   'M 350,120 L 470,110 L 490,200 L 370,210 Z', 420, 155,
   'Margalla foothill drains and residential gardens under peak adult surveillance.', 5),
  ('zone-f7', 'F-7 Markaz & Jinnah Super', 'Islamabad Central', 33.721, 73.057,
   'M 300,160 L 420,150 L 430,250 L 310,260 Z', 365, 205,
   'Commercial markaz planters and rooftop tanks inspected twice weekly.', 4),
  ('zone-bluearea', 'Blue Area (Jinnah Avenue)', 'Islamabad Central', 33.715, 73.065,
   'M 340,200 L 480,190 L 490,280 L 350,290 Z', 415, 240,
   'High pedestrian density corridor — priority fogging near office blocks after rain.', 7),
  ('zone-f8', 'F-8 & Nazim-ud-Din Road', 'Islamabad West-Central', 33.7095, 73.0425,
   'M 220,180 L 340,170 L 350,270 L 230,280 Z', 285, 225,
   'Park roadside green belts checked for stagnant containers post-monsoon.', 3),
  ('zone-g6', 'G-6 & Melody Market', 'Islamabad Central-East', 33.7085, 73.091,
   'M 480,180 L 600,170 L 610,270 L 490,280 Z', 545, 225,
   'Dense housing blocks and market drains — elevated larval site count.', 9),
  ('zone-g9', 'G-9 Markaz', 'Islamabad West', 33.6895, 73.034,
   'M 200,280 L 330,270 L 340,370 L 210,380 Z', 270, 325,
   'Karachi Company / G-9 commercial yards monitored for open water drums.', 6),
  ('zone-f10', 'F-10 & F-11', 'Islamabad West', 33.69, 73.005,
   'M 120,260 L 250,250 L 260,360 L 130,370 Z', 190, 310,
   'Residential sectors with mature tree canopy — shade resting sites prioritized.', 4),
  ('zone-g11', 'G-11 & G-13', 'Islamabad South-West', 33.665, 72.995,
   'M 100,380 L 240,370 L 250,480 L 110,490 Z', 175, 430,
   'Newer sectors with construction sites — open curing tanks flagged.', 5),
  ('zone-i8', 'I-8 & I-9 Industrial', 'Islamabad South', 33.658, 73.06,
   'M 320,400 L 470,390 L 480,500 L 330,510 Z', 400, 450,
   'Industrial cooling drums and scrap yards inspected for breeding containers.', 8),
  ('zone-diplomatic', 'Diplomatic Enclave & Red Zone', 'Islamabad East', 33.725, 73.105,
   'M 560,140 L 720,130 L 730,240 L 570,250 Z', 645, 185,
   'Restricted access zone — routine CDA vector team sweeps along green belts.', 1)
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
