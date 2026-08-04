import type { Scene, Shape, ThorVGNamespace } from '@thorvg/webcanvas';
import worldLand from '../data/world-land.json';
import countryBorders from '../data/country-borders.json';
import countryLabels from '../data/country-labels.json';
import { project, type MapProjection } from './projection';

type LandPolygon = number[][][]; // rings -> points -> [lon, lat]
type CountryBorder = { name: string; polygons: LandPolygon[] };
type CountryLabel = { name: string; lon: number; lat: number; area: number };

const OCEAN_COLOR: [number, number, number] = [209, 232, 249];
const LAND_COLOR: [number, number, number] = [247, 247, 250];
const BORDER_COLOR: [number, number, number, number] = [200, 200, 206, 255];
const LABEL_COLOR: [number, number, number] = [90, 90, 95];
const LABEL_FONT = 'inter';
const LABEL_FONT_SIZE = 8;
const LABEL_PADDING = 4;

function tracePolygons(shape: Shape, polygons: LandPolygon[], projection: MapProjection): void {
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const [startLon, startLat] = ring[0];
      const [startX, startY] = project(startLat, startLon, projection);
      shape.moveTo(startX, startY);
      for (let i = 1; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        const [x, y] = project(lat, lon, projection);
        shape.lineTo(x, y);
      }
      shape.close();
    }
  }
}

export function buildWorldMap(TVG: ThorVGNamespace, projection: MapProjection): Scene {
  const scene = new TVG.Scene();

  const [left, top] = project(90, -180, projection);
  const [right, bottom] = project(-90, 180, projection);
  const ocean = new TVG.Shape();
  ocean.appendRect(left, top, right - left, bottom - top);
  ocean.fill(...OCEAN_COLOR);
  scene.add(ocean);

  for (const polygon of worldLand as LandPolygon[]) {
    const shape = new TVG.Shape();
    tracePolygons(shape, [polygon], projection);
    shape.fillRule(TVG.FillRule.EvenOdd);
    shape.fill(...LAND_COLOR);
    scene.add(shape);
  }

  for (const country of countryBorders as CountryBorder[]) {
    const shape = new TVG.Shape();
    tracePolygons(shape, country.polygons, projection);
    shape.fillRule(TVG.FillRule.EvenOdd);
    shape.fill(0, 0, 0, 0);
    shape.stroke({ width: 0.6, color: BORDER_COLOR });
    scene.add(shape);
  }

  return scene;
}

export async function loadLabelFont(TVG: ThorVGNamespace): Promise<void> {
  await TVG.Font.load(LABEL_FONT);
}

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function estimateLabelBox(x: number, y: number, text: string): Box {
  const width = text.length * LABEL_FONT_SIZE * 0.6;
  const height = LABEL_FONT_SIZE * 1.3;
  return { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2, maxY: y + height / 2 };
}

function boxesOverlap(a: Box, b: Box, padding: number): boolean {
  return (
    a.minX - padding < b.maxX &&
    a.maxX + padding > b.minX &&
    a.minY - padding < b.maxY &&
    a.maxY + padding > b.minY
  );
}

export function buildCountryLabels(TVG: ThorVGNamespace, projection: MapProjection): Scene {
  const scene = new TVG.Scene();
  const byArea = [...(countryLabels as CountryLabel[])].sort((a, b) => b.area - a.area);
  const placedBoxes: Box[] = [];

  for (const label of byArea) {
    const [x, y] = project(label.lat, label.lon, projection);
    const box = estimateLabelBox(x, y, label.name);
    if (placedBoxes.some((placed) => boxesOverlap(box, placed, LABEL_PADDING))) continue;
    placedBoxes.push(box);

    const text = new TVG.Text();
    text.font(LABEL_FONT);
    text.fontSize(LABEL_FONT_SIZE);
    text.text(label.name);
    text.align(0.5, 0.5);
    text.fill(...LABEL_COLOR);
    text.translate(x, y);
    scene.add(text);
  }

  return scene;
}
