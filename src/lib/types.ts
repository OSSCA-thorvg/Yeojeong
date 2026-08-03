export type TransportMode = 'plane' | 'train' | 'bus' | 'car' | 'bike' | 'walk';

export interface City {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface JourneyStop {
  city: City;
  /** Transport used to arrive at this stop from the previous one; null for the first stop. */
  arrivalMode: TransportMode | null;
}
