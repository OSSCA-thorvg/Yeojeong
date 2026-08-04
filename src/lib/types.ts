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
