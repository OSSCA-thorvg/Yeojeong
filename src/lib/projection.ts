// Converts lat/lng coordinates to screen x/y positions for the map.
// 위경도 좌표를 지도 화면상의 x/y 좌표로 변환한다.
export interface MapProjection {
  centerX: number;
  centerY: number;
  scale: number;
}

// Projects a lat/lng coordinate onto screen x/y using the given map projection.
// 위경도 좌표를 지도 투영 정보를 이용해 화면 x/y 좌표로 변환한다.
export function project(lat: number, lon: number, p: MapProjection): [number, number] {
  return [p.centerX + lon * p.scale, p.centerY - lat * p.scale];
}
