// Builds the ThorVG scenes for the journey route: path curves, stop markers, arrival pin, and pulse animation.
// 여정 경로의 ThorVG 장면(경로 곡선, 정거장 마커, 도착 핀, 펄스 애니메이션)을 만든다.
import type { Scene, ThorVGNamespace } from '@thorvg/webcanvas';
import type { JourneyStop, TransportMode } from './types';
import { project, type MapProjection } from './projection';

const UPCOMING_ALPHA = 90;
const STOP_RADIUS = 3.5;
const MARKER_RADIUS = 5.5;

export const TRANSPORT_COLOR: Record<Exclude<TransportMode, 'plane'>, [number, number, number]> = {
  ship: [60, 110, 190],
  train: [70, 130, 140],
  bus: [180, 140, 60],
  car: [90, 130, 90],
  bike: [140, 110, 170],
  walk: [120, 120, 120],
};

const TRANSPORT_STYLE: Record<TransportMode, { width: number; dash?: number[] }> = {
  plane: { width: 2.6 },
  ship: { width: 2.4, dash: [7, 3, 1, 3] },
  car: { width: 2.2 },
  train: { width: 2.4, dash: [9, 4] },
  bus: { width: 2.2, dash: [4, 3] },
  bike: { width: 1.8, dash: [2, 3] },
  walk: { width: 1.6, dash: [1, 3] },
};

// Returns the color for a transport mode, using the accent color for plane and a fixed color for others.
// 이동 수단의 색상을 반환한다. 비행기는 강조색을, 나머지는 고정 색상을 사용한다.
export function transportColor(mode: TransportMode, accent: [number, number, number]): [number, number, number] {
  return mode === 'plane' ? accent : TRANSPORT_COLOR[mode];
}

const TRANSPORT_SPEED: Record<TransportMode, number> = {
  plane: 800,
  train: 150,
  car: 90,
  bus: 70,
  ship: 35,
  bike: 15,
  walk: 5,
};

// Calculates total travel time in hours across all stops, based on distance and transport speed per segment.
// 각 구간의 거리와 이동 수단 속도를 기반으로 전체 여정의 소요 시간(시간 단위)을 계산한다.
export function journeyTravelHours(stops: JourneyStop[]): number {
  let hours = 0;
  for (let i = 1; i < stops.length; i++) {
    const mode = stops[i].arrivalMode as TransportMode;
    hours += haversineKm(stops[i - 1].city, stops[i].city) / TRANSPORT_SPEED[mode];
  }
  return hours;
}

const MIN_PLAYBACK_MS = 6000;
const MAX_PLAYBACK_MS = 24000;
const PLAYBACK_MS_PER_SQRT_HOUR = 5200;

// Converts a journey's total travel hours into a playback duration in milliseconds, clamped to a min/max range.
// 여정의 총 소요 시간을 재생 시간(밀리초)으로 변환하고, 최소/최대 범위로 제한한다.
export function playbackDurationMs(stops: JourneyStop[]): number {
  const hours = journeyTravelHours(stops);
  if (hours <= 0) return MIN_PLAYBACK_MS;
  const raw = PLAYBACK_MS_PER_SQRT_HOUR * Math.sqrt(hours);
  return Math.min(MAX_PLAYBACK_MS, Math.max(MIN_PLAYBACK_MS, raw));
}

// Calculates the great-circle distance in kilometers between two lat/lng coordinates.
// 두 위경도 좌표 사이의 대권 거리를 킬로미터 단위로 계산한다.
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Appends an alpha value to an RGB color.
// RGB 색상에 알파값을 추가한다.
function withAlpha(color: [number, number, number], alpha: number): [number, number, number, number] {
  return [color[0], color[1], color[2], alpha];
}

// Clamps a number to the 0-1 range.
// 숫자를 0~1 범위로 제한한다.
function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

const ARC_BULGE_RATIO = 0.16;

export interface Point {
  x: number;
  y: number;
}

interface CubicCurve {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

// Projects journey stops to screen points and finds how far along the route the current progress reaches, weighted by segment travel time.
// 여정의 정거장들을 화면 좌표로 투영하고, 각 구간의 이동 시간에 따라 현재 진행률이 경로상 어디까지 도달했는지 계산한다.
function segmentPosition(stops: JourneyStop[], progress: number, projection: MapProjection) {
  const points: Point[] = stops.map((stop) => {
    const [x, y] = project(stop.city.lat, stop.city.lng, projection);
    return { x, y };
  });
  const segmentCount = points.length - 1;
  const rawWeights = stops.slice(1).map((stop, i) => {
    const mode = stop.arrivalMode as TransportMode;
    return haversineKm(stops[i].city, stop.city) / TRANSPORT_SPEED[mode];
  });
  const rawTotal = rawWeights.reduce((sum, w) => sum + w, 0);
  const MIN_SHARE = 0.12;
  const floor = rawTotal * MIN_SHARE;
  const weights = rawWeights.map((w) => Math.max(w, floor));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const target = clamp01(progress) * totalWeight;
  let traveled = segmentCount;
  let acc = 0;
  for (let i = 0; i < segmentCount; i++) {
    const w = weights[i];
    if (target < acc + w) {
      traveled = i + (w > 0 ? (target - acc) / w : 0);
      break;
    }
    acc += w;
  }

  return { points, segmentCount, traveled };
}

// Builds a cubic curve between two points: a straight line for ground transport, or a bulging arc for planes.
// 두 지점 사이의 3차 곡선을 만든다. 육상 이동은 직선, 비행기는 볼록하게 휘는 호를 사용한다.
function segmentCurve(from: Point, to: Point, mode: TransportMode | null): CubicCurve {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (mode !== 'plane') {
    return {
      p0: from,
      p1: { x: from.x + dx / 3, y: from.y + dy / 3 },
      p2: { x: from.x + (dx * 2) / 3, y: from.y + (dy * 2) / 3 },
      p3: to,
    };
  }

  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }

  const offsetX = nx * len * ARC_BULGE_RATIO;
  const offsetY = ny * len * ARC_BULGE_RATIO;
  return {
    p0: from,
    p1: { x: from.x + dx / 3 + offsetX, y: from.y + dy / 3 + offsetY },
    p2: { x: from.x + (dx * 2) / 3 + offsetX, y: from.y + (dy * 2) / 3 + offsetY },
    p3: to,
  };
}

// Linearly interpolates between two points.
// 두 점 사이를 선형 보간한다.
function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Calculates the point at parameter t along a cubic Bezier curve.
// 3차 베지어 곡선에서 매개변수 t에 해당하는 점을 계산한다.
function curvePoint(curve: CubicCurve, t: number): Point {
  const { p0, p1, p2, p3 } = curve;
  const a = lerpPoint(p0, p1, t);
  const b = lerpPoint(p1, p2, t);
  const c = lerpPoint(p2, p3, t);
  return lerpPoint(lerpPoint(a, b, t), lerpPoint(b, c, t), t);
}

// Splits a cubic Bezier curve into two curves at parameter t.
// 3차 베지어 곡선을 매개변수 t 지점에서 두 개의 곡선으로 나눈다.
function splitCurve(curve: CubicCurve, t: number): [CubicCurve, CubicCurve] {
  const { p0, p1, p2, p3 } = curve;
  const a = lerpPoint(p0, p1, t);
  const b = lerpPoint(p1, p2, t);
  const c = lerpPoint(p2, p3, t);
  const d = lerpPoint(a, b, t);
  const e = lerpPoint(b, c, t);
  const point = lerpPoint(d, e, t);
  return [
    { p0, p1: a, p2: d, p3: point },
    { p0: point, p1: e, p2: c, p3 },
  ];
}

// Draws a cubic curve as a stroked shape and adds it to the scene.
// 3차 곡선을 선으로 그려 장면에 추가한다.
function drawCurve(
  TVG: ThorVGNamespace,
  scene: Scene,
  curve: CubicCurve,
  color: [number, number, number, number],
  style: { width: number; dash?: number[] },
) {
  const line = new TVG.Shape();
  line
    .moveTo(curve.p0.x, curve.p0.y)
    .cubicTo(curve.p1.x, curve.p1.y, curve.p2.x, curve.p2.y, curve.p3.x, curve.p3.y);
  line.stroke({ width: style.width, color, dash: style.dash, cap: TVG.StrokeCap.Round });
  scene.add(line);
}

// Builds the full journey path scene: route curves colored by traveled/upcoming progress, plus stop markers.
// 이동 경로 전체 장면을 만든다. 지난/남은 구간을 다른 색으로 표시하고, 정거장 마커를 그린다.
export function buildJourneyPath(
  TVG: ThorVGNamespace,
  stops: JourneyStop[],
  progress: number,
  projection: MapProjection,
  accent: [number, number, number],
  visualScale: number = 1,
): Scene {
  const scene = new TVG.Scene();
  if (stops.length === 0) return scene;

  if (stops.length === 1) {
    const [x, y] = project(stops[0].city.lat, stops[0].city.lng, projection);
    const dot = new TVG.Shape();
    dot.appendCircle(x, y, MARKER_RADIUS * visualScale);
    dot.fill(255, 255, 255);
    dot.stroke({ width: 2 * visualScale, color: withAlpha(accent, 255) });
    scene.add(dot);
    return scene;
  }

  const { points, segmentCount, traveled } = segmentPosition(stops, progress, projection);

  const lineScene = new TVG.Scene();

  for (let i = 0; i < segmentCount; i++) {
    const from = points[i];
    const to = points[i + 1];
    const mode = stops[i + 1].arrivalMode as TransportMode;
    const baseStyle = TRANSPORT_STYLE[mode];
    const style = { width: baseStyle.width * visualScale, dash: baseStyle.dash?.map((d) => d * visualScale) };
    const traveledColor = withAlpha(transportColor(mode, accent), 255);
    const upcomingColor = withAlpha(accent, UPCOMING_ALPHA);
    const curve = segmentCurve(from, to, mode);
    const segProgress = clamp01(traveled - i);

    if (segProgress <= 0) {
      drawCurve(TVG, lineScene, curve, upcomingColor, style);
      continue;
    }
    if (segProgress >= 1) {
      drawCurve(TVG, lineScene, curve, traveledColor, style);
      continue;
    }
    const [traveledCurve, upcomingCurve] = splitCurve(curve, segProgress);
    drawCurve(TVG, lineScene, traveledCurve, traveledColor, style);
    drawCurve(TVG, lineScene, upcomingCurve, upcomingColor, style);
  }

  points.forEach((pt, i) => {
    const visited = i <= traveled;
    const dot = new TVG.Shape();
    dot.appendCircle(pt.x, pt.y, STOP_RADIUS * visualScale);
    dot.fill(...withAlpha(accent, visited ? 255 : UPCOMING_ALPHA));
    lineScene.add(dot);
  });

  lineScene.dropShadow(0, 0, 0, 70, 115, 1 * visualScale, 1.4 * visualScale, 55);
  scene.add(lineScene);

  return scene;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MarkerState {
  at: Point;
  mode: TransportMode;
  dirX: 1 | -1;
  /** 구간 곡선의 컨트롤 포인트를 감싸는 경계. 양 끝점뿐 아니라 호의 볼록한 부분까지 포함 */
  bounds: Bounds;
}

// Calculates the bounding box of a cubic curve's control points.
// 3차 곡선의 컨트롤 포인트를 감싸는 경계 상자를 계산한다.
function curveBounds(curve: CubicCurve): Bounds {
  const xs = [curve.p0.x, curve.p1.x, curve.p2.x, curve.p3.x];
  const ys = [curve.p0.y, curve.p1.y, curve.p2.y, curve.p3.y];
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

// Calculates the current position, transport mode, and facing direction of the traveling marker along the journey.
// 여정 진행에 따라 이동 중인 마커의 현재 위치, 이동 수단, 방향을 계산한다.
export function currentMarkerState(
  stops: JourneyStop[],
  progress: number,
  projection: MapProjection,
): MarkerState | undefined {
  if (stops.length < 2) return undefined;
  const { points, segmentCount, traveled } = segmentPosition(stops, progress, projection);
  const markerIndex = Math.min(segmentCount - 1, Math.floor(traveled));
  const segProgress = clamp01(traveled - markerIndex);
  const from = points[markerIndex];
  const to = points[markerIndex + 1];
  const mode = stops[markerIndex + 1].arrivalMode as TransportMode;
  const curve = segmentCurve(from, to, mode);
  const dirX: 1 | -1 = to.x >= from.x ? 1 : -1;
  return { at: curvePoint(curve, segProgress), mode, dirX, bounds: curveBounds(curve) };
}

const ARRIVAL_PIN_COLOR: [number, number, number] = [217, 48, 37];

// Builds a map pin shape (teardrop with a hole) marking the arrival point.
// 도착 지점을 표시하는 물방울 모양 핀(가운데 구멍 포함)을 만든다.
export function buildArrivalPin(TVG: ThorVGNamespace, at: Point, visualScale: number): Scene {
  const scene = new TVG.Scene();
  const headRadius = MARKER_RADIUS * 1.4 * visualScale;
  const headCenterY = at.y - headRadius * 1.8;

  const tail = new TVG.Shape();
  tail.moveTo(at.x, at.y);
  tail.lineTo(at.x - headRadius * 0.55, headCenterY + headRadius * 0.4);
  tail.lineTo(at.x + headRadius * 0.55, headCenterY + headRadius * 0.4);
  tail.close();
  tail.fill(...ARRIVAL_PIN_COLOR);
  scene.add(tail);

  const head = new TVG.Shape();
  head.appendCircle(at.x, headCenterY, headRadius);
  head.fill(...ARRIVAL_PIN_COLOR);
  head.stroke({ width: 1.4 * visualScale, color: [255, 255, 255, 255] });
  scene.add(head);

  const hole = new TVG.Shape();
  hole.appendCircle(at.x, headCenterY, headRadius * 0.38);
  hole.fill(255, 255, 255);
  scene.add(hole);

  scene.dropShadow(0, 0, 0, 110, 115, 1.6 * visualScale, 2 * visualScale, 55);

  return scene;
}

// Builds an expanding, fading ring shape used as a pulse animation around a point.
// 지점 주변에 퍼지면서 옅어지는 고리 모양의 펄스 애니메이션을 만든다.
export function buildPulse(
  TVG: ThorVGNamespace,
  at: Point,
  phase: number,
  accent: [number, number, number],
  visualScale: number = 1,
): Scene {
  const scene = new TVG.Scene();
  const radius = (MARKER_RADIUS + phase * 16) * visualScale;
  const alpha = Math.round(160 * (1 - phase));
  const ring = new TVG.Shape();
  ring.appendCircle(at.x, at.y, radius);
  ring.stroke({ width: 1.6 * visualScale, color: withAlpha(accent, alpha) });
  scene.add(ring);
  scene.gaussianBlur(1.1 * visualScale, 0, 0, 55);
  return scene;
}
