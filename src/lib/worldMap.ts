// Builds the ThorVG scenes for the base world map: ocean, shaded land masses, country borders, and country labels.
// 세계 지도의 ThorVG 장면(바다, 명암 처리된 육지, 국경선, 국가 라벨)을 만든다.
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

// Lightens or darkens an RGB color by a factor (positive lightens toward white, negative darkens toward black).
// RGB 색상을 비율만큼 밝게 또는 어둡게 만든다. 양수는 흰색 쪽으로, 음수는 검은색 쪽으로 이동한다.
function shade(c: [number, number, number], factor: number): [number, number, number] {
  const mix = (v: number) => (factor >= 0 ? v + (255 - v) * factor : v * (1 + factor));
  return [Math.round(mix(c[0])), Math.round(mix(c[1])), Math.round(mix(c[2]))];
}

// Shades an RGB color and appends an alpha value, for use as a gradient stop color.
// RGB 색상을 명암 처리하고 알파값을 추가한다. 그라디언트 스톱 색상으로 사용한다.
function shadeStop(c: [number, number, number], factor: number, a = 255): [number, number, number, number] {
  const [r, g, b] = shade(c, factor);
  return [r, g, b, a];
}

// Traces land polygon rings onto a shape, projecting each lon/lat vertex to screen coordinates.
// 육지 폴리곤의 각 경위도 좌표를 화면 좌표로 투영해 도형 윤곽선을 그린다.
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

// Calculates the relative luminance of an RGB color.
// RGB 색상의 상대 휘도를 계산한다.
function luminance([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Builds the base world map scene: ocean gradient, shaded land masses, and country border lines.
// 세계 지도 기본 장면을 만든다. 바다 그라디언트, 명암 처리된 육지, 국경선을 그린다.
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

// Loads the font used to render country labels.
// 국가 라벨 렌더링에 사용할 폰트를 불러온다.
export async function loadLabelFont(TVG: ThorVGNamespace): Promise<void> {
  await TVG.Font.load(LABEL_FONT);
}

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// Estimates the bounding box a text label would occupy at a given position.
// 특정 위치에 텍스트 라벨을 배치했을 때 차지할 경계 상자를 추정한다.
function estimateLabelBox(x: number, y: number, text: string): Box {
  const width = text.length * LABEL_FONT_SIZE * 0.6;
  const height = LABEL_FONT_SIZE * 1.3;
  return { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2, maxY: y + height / 2 };
}

// Checks whether two boxes overlap, given extra padding around each.
// 여백을 고려해 두 경계 상자가 겹치는지 확인한다.
function boxesOverlap(a: Box, b: Box, padding: number): boolean {
  return (
    a.minX - padding < b.maxX &&
    a.maxX + padding > b.minX &&
    a.minY - padding < b.maxY &&
    a.maxY + padding > b.minY
  );
}

// Builds country name label text for the largest countries first, skipping any that would overlap already-placed labels.
// 국가 이름 라벨을 면적이 큰 순서로 배치하고, 이미 배치된 라벨과 겹치는 경우는 건너뛴다.
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
