export interface MapProjection {
  centerX: number;
  centerY: number;
  scale: number;
}

export function project(lat: number, lon: number, p: MapProjection): [number, number] {
  return [p.centerX + lon * p.scale, p.centerY - lat * p.scale];
}
