// Core shared types for the journey domain: transport modes, cities, and journey stops.
// 여정 도메인의 핵심 공용 타입(이동 수단, 도시, 여정 정거장)을 정의한다.
export type TransportMode = 'plane' | 'ship' | 'train' | 'bus' | 'car' | 'bike' | 'walk';

export interface City {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
}

export interface JourneyStop {
  city: City;
  arrivalMode: TransportMode | null;
}
