/**
 * PASTE INTO: https://code.earthengine.google.com/
 *
 * Exports per-zone (and optional dense sample) NDVI + LST JSON for the
 * Dengue ICT block grid. After Run → Tasks complete (or print Console),
 * copy the printed JSON and paste back into chat / save as:
 *   data/ee_block_layers.json
 *
 * Then locally:  npm run grid:ingest-ee
 */

// —— ICT zones (same centers as lib/zoneMeta.ts) ——
var ZONES = [
  {id:'zone-f6', name:'F-6', lat:33.7295, lng:73.0745, urban:true},
  {id:'zone-f7', name:'F-7', lat:33.721, lng:73.057, urban:true},
  {id:'zone-bluearea', name:'Blue Area', lat:33.715, lng:73.065, urban:true},
  {id:'zone-f8', name:'F-8', lat:33.7095, lng:73.0425, urban:true},
  {id:'zone-g6', name:'G-6', lat:33.7085, lng:73.091, urban:true},
  {id:'zone-diplomatic', name:'Diplomatic', lat:33.725, lng:73.105, urban:true},
  {id:'zone-g9', name:'G-9', lat:33.6895, lng:73.034, urban:true},
  {id:'zone-f10', name:'F-10/F-11', lat:33.69, lng:73.005, urban:true},
  {id:'zone-g11', name:'G-11/G-13', lat:33.665, lng:72.995, urban:true},
  {id:'zone-i8', name:'I-8/I-9', lat:33.658, lng:73.06, urban:true},
  {id:'zone-bharakahu', name:'Bharakahu', lat:33.742, lng:73.185, urban:false},
  {id:'zone-banigala', name:'Banigala', lat:33.755, lng:73.165, urban:false},
  {id:'zone-nilore', name:'Nilore', lat:33.655, lng:73.155, urban:false},
  {id:'zone-chirah', name:'Chirah', lat:33.7, lng:73.2, urban:false},
  {id:'zone-tarnol', name:'Tarnol', lat:33.648, lng:72.915, urban:false},
  {id:'zone-golra', name:'Golra', lat:33.675, lng:72.965, urban:false},
  {id:'zone-sihala', name:'Sihala', lat:33.555, lng:73.205, urban:false},
  {id:'zone-rawat', name:'Rawat', lat:33.498, lng:73.195, urban:false},
  {id:'zone-koral', name:'Koral', lat:33.575, lng:73.125, urban:false}
];

var START = '2026-06-01';
var END = '2026-07-31';
var ICT = ee.Geometry.Rectangle([72.85, 33.45, 73.28, 33.80]);

// Sentinel-2 NDVI
function maskS2(img) {
  var qa = img.select('QA60');
  var mask = qa.bitwiseAnd(1 << 10).eq(0).and(qa.bitwiseAnd(1 << 11).eq(0));
  return img.updateMask(mask).divide(10000);
}
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(ICT)
  .filterDate(START, END)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
  .map(maskS2);
var ndvi = s2.median().normalizedDifference(['B8', 'B4']).rename('ndvi');

// Landsat 8/9 LST (°C) — ST_B10 is already in Kelvin * scale; Collection 2 L2
function prepL8(img) {
  var thermal = img.select('ST_B10').multiply(0.00341802).add(149.0).subtract(273.15);
  return thermal.rename('lst').copyProperties(img, ['system:time_start']);
}
var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(ICT).filterDate(START, END)
  .filter(ee.Filter.lt('CLOUD_COVER', 40))
  .map(prepL8);
var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
  .filterBounds(ICT).filterDate(START, END)
  .filter(ee.Filter.lt('CLOUD_COVER', 40))
  .map(prepL8);
var lst = l8.merge(l9).median().rename('lst');

var stack = ndvi.addBands(lst);

// Per-zone mean (800m urban / 1000m rural) — Console JSON
var zoneFeatures = ee.FeatureCollection(ZONES.map(function(z) {
  var r = z.urban ? 800 : 1000;
  var geom = ee.Geometry.Point([z.lng, z.lat]).buffer(r);
  return ee.Feature(geom, {zoneId: z.id, name: z.name});
}));

var zoneStats = stack.reduceRegions({
  collection: zoneFeatures,
  reducer: ee.Reducer.mean(),
  scale: 30,
  tileScale: 2
});

print('=== COPY zoneLayers BELOW ===');
zoneStats.evaluate(function(fc) {
  var zones = (fc.features || []).map(function(f) {
    return {
      zoneId: f.properties.zoneId,
      name: f.properties.name,
      ndvi: f.properties.ndvi,
      lst: f.properties.lst
    };
  });
  print(JSON.stringify({
    type: 'ee_ict_block_layers',
    start: START,
    end: END,
    computedAt: new Date().toISOString(),
    demNote: 'Use COPERNICUS/DEM/GLO30 separately for depressions if needed',
    zoneLayers: zones
  }, null, 2));
});

// Optional: dense 200m sample grid over ICT for block texture (Task → Drive)
var sample = stack.sample({
  region: ICT,
  scale: 200,
  geometries: true,
  numPixels: 5000,
  seed: 42,
  tileScale: 4
});
Export.table.toDrive({
  collection: sample.map(function(f) {
    var c = f.geometry().centroid(1).coordinates();
    return ee.Feature(null, {
      lng: c.get(0),
      lat: c.get(1),
      ndvi: f.get('ndvi'),
      lst: f.get('lst')
    });
  }),
  description: 'ict_block_ndvi_lst_200m',
  fileFormat: 'GeoJSON',
  folder: 'dengue_grid'
});

Map.centerObject(ICT, 10);
Map.addLayer(ndvi.clip(ICT), {min: 0, max: 0.6, palette: ['#ffffcc', '#41ab5d', '#005a32']}, 'NDVI');
Map.addLayer(lst.clip(ICT), {min: 20, max: 45, palette: ['blue', 'yellow', 'red']}, 'LST °C', false);

print('Also start Task: ict_block_ndvi_lst_200m → Drive folder dengue_grid (optional dense sample).');
print('Minimum needed: copy the printed zoneLayers JSON from Console.');
