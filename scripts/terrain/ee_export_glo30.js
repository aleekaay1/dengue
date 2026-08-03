/**
 * Earth Engine (Code Editor) — export Copernicus GLO-30 DEM for ICT bbox.
 *
 * Reuse the same Earth Engine project / service account already used for NDVI.
 * Run once in https://code.earthengine.google.com , then download the GeoTIFF
 * and pass it to scripts/terrain/compute_depressions.py
 *
 * Fallback dataset if GLO30 is unavailable: USGS/SRTMGL1_003
 */

// ICT bounding box covering urban sectors + rural tehsils
var ict = ee.Geometry.Rectangle([72.82, 33.42, 73.35, 33.85]);

var dem = ee.Image('COPERNICUS/DEM/GLO30').select('DEM').clip(ict);
// Fallback:
// var dem = ee.Image('USGS/SRTMGL1_003').select('elevation').clip(ict);

Map.centerObject(ict, 10);
Map.addLayer(dem, {min: 400, max: 1200, palette: ['#08306b', '#6baed6', '#ffffb2', '#fd8d3c', '#b30000']}, 'DEM');

Export.image.toDrive({
  image: dem.toFloat(),
  description: 'ict_copernicus_glo30_dem',
  folder: 'dengue_terrain',
  fileNamePrefix: 'ict_glo30',
  region: ict,
  scale: 30,
  maxPixels: 1e13,
  crs: 'EPSG:4326',
});
