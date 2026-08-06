import type { Scene, Shape, ThorVGNamespace } from '@thorvg/webcanvas';
import worldLand from '../data/world-land.json';
import countryBorders from '../data/country-borders.json';
import countryLabels from '../data/country-labels.json';
import { project, type MapProjection } from './projection';
import type { MapPalette } from './mapTheme';

type LandPolygon = number[][][]; 
type CountryBorder = { name: string; polygons: LandPolygon[] };
type CountryLabel = { name: string; lon: number; lat: number; area: number };

const LABEL_FONT = 'inter';
const LABEL_FONT_SIZE = 8;
const LABEL_PADDING = 4;

function shade(c: [number, number, number], factor: number): [number, number, number] {
  const mix = (v: number) => (factor >= 0 ? v + (255 - v) * factor : v * (1 + factor));
  return [Math.round(mix(c[0])), Math.round(mix(c[1])), Math.round(mix(c[2]))];
}

function shadeStop(c: [number, number, number], factor: number, a = 255): [number, number, number, number] {
  const [r, g, b] = shade(c, factor);
  return [r, g, b, a];
}

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

function luminance([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function buildWorldMap(TVG: ThorVGNamespace, projection: MapProjection, palette: MapPalette): Scene {
  const scene = new TVG.Scene();

  const [left, top] = project(90, -180, projection);
  const [right, bottom] = project(-90, 180, projection);
  const [centerX, centerY] = project(0, 0, projection);

  const oceanRadius = Math.hypot(right - centerX, bottom - centerY);
  const oceanGradient = new TVG.RadialGradient(centerX, centerY, oceanRadius);
  oceanGradient
    .addStop(0, shadeStop(palette.ocean, 0.12))
    .addStop(1, shadeStop(palette.ocean, -0.4))
    .build();
  const ocean = new TVG.Shape();
  const worldW = right - left;
  const worldH = bottom - top;
  const OCEAN_PAD = 1.5;
  ocean.appendRect(
    left - worldW * OCEAN_PAD,
    top - worldH * OCEAN_PAD,
    worldW * (1 + OCEAN_PAD * 2),
    worldH * (1 + OCEAN_PAD * 2),
  );
  ocean.fill(oceanGradient);
  scene.add(ocean);

  const landScene = new TVG.Scene();
  for (const polygon of worldLand as LandPolygon[]) {
    const shape = new TVG.Shape();
    tracePolygons(shape, [polygon], projection);
    shape.fillRule(TVG.FillRule.EvenOdd);

    const bounds = shape.bounds();
    const gradient = new TVG.LinearGradient(0, bounds.y, 0, bounds.y + bounds.height);
    gradient
      .addStop(0, shadeStop(palette.land, 0.16))
      .addStop(1, shadeStop(palette.land, -0.14))
      .build();
    shape.fill(gradient);
    landScene.add(shape);
  }

  if (luminance(palette.ocean) < 0.3) {
    landScene.dropShadow(...palette.accent, 130, 0, 0, 3.5, 65);
  } else {
    const shadowColor = shade(palette.land, -0.7);
    landScene.dropShadow(...shadowColor, 90, 115, 1.4, 1.8, 60);
  }
  scene.add(landScene);

  for (const country of countryBorders as CountryBorder[]) {
    const shape = new TVG.Shape();
    tracePolygons(shape, country.polygons, projection);
    shape.fillRule(TVG.FillRule.EvenOdd);
    shape.fill(0, 0, 0, 0);
    shape.stroke({ width: 0.6, color: palette.border });
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

export function buildCountryLabels(TVG: ThorVGNamespace, projection: MapProjection, palette: MapPalette): Scene {
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
    text.fill(...palette.label);
    text.translate(x, y);
    scene.add(text);
  }

  return scene;
}
