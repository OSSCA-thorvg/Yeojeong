import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { geoArea, geoCentroid } from 'd3-geo';

const round = (n) => Math.round(n * 100) / 100;

const ANTARCTIC_CUTOFF_LAT = -60;

function unrollRing(ring) {
  let offset = 0;
  let prevLon = ring[0][0];
  return ring.map(([lon, lat], i) => {
    if (i > 0) {
      const delta = lon - prevLon;
      if (delta > 180) offset -= 360;
      else if (delta < -180) offset += 360;
      prevLon = lon;
    }
    return [lon + offset, lat];
  });
}

function shiftPolygon(polygon, dx) {
  return polygon.map((ring) => ring.map(([lon, lat]) => [lon + dx, lat]));
}

function normalizePolygons(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const result = [];
  for (const polygon of polygons) {
    const unrolled = polygon.map(unrollRing);
    const [outerRing] = unrolled;
    const minLat = Math.min(...outerRing.map(([, lat]) => lat));
    if (minLat < ANTARCTIC_CUTOFF_LAT) continue;

    const lons = unrolled.flat().map(([lon]) => lon);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const variants = [unrolled];
    if (maxLon > 180) variants.push(shiftPolygon(unrolled, -360));
    if (minLon < -180) variants.push(shiftPolygon(unrolled, 360));

    for (const variant of variants) {
      result.push(variant.map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)])));
    }
  }
  return result;
}

const landTopology = JSON.parse(
  readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url)),
);
const landGeo = feature(landTopology, landTopology.objects.land);

const landPolygons = landGeo.features.flatMap((f) => normalizePolygons(f.geometry));
writeFileSync(
  fileURLToPath(new URL('../src/data/world-land.json', import.meta.url)),
  JSON.stringify(landPolygons),
);
console.log(`Wrote ${landPolygons.length} land polygons`);

const countriesTopology = JSON.parse(
  readFileSync(new URL('../node_modules/world-atlas/countries-110m.json', import.meta.url)),
);
const countriesGeo = feature(countriesTopology, countriesTopology.objects.countries);

const borders = [];
const labels = [];
for (const f of countriesGeo.features) {
  const name = f.properties?.name;
  if (!name) continue;

  const polygons = normalizePolygons(f.geometry);
  if (polygons.length === 0) continue;
  borders.push({ name, polygons });

  const parts = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let largestPart = parts[0];
  let largestArea = -Infinity;
  for (const part of parts) {
    const area = Math.abs(geoArea({ type: 'Polygon', coordinates: part }));
    if (area > largestArea) {
      largestArea = area;
      largestPart = part;
    }
  }
  const [lon, lat] = geoCentroid({ type: 'Polygon', coordinates: largestPart });
  if (lat < ANTARCTIC_CUTOFF_LAT) continue;
  labels.push({ name, lon: round(lon), lat: round(lat), area: Math.round(largestArea * 1e6) });
}

writeFileSync(
  fileURLToPath(new URL('../src/data/country-borders.json', import.meta.url)),
  JSON.stringify(borders),
);
console.log(`Wrote ${borders.length} country borders`);

writeFileSync(
  fileURLToPath(new URL('../src/data/country-labels.json', import.meta.url)),
  JSON.stringify(labels),
);
console.log(`Wrote ${labels.length} country labels`);
