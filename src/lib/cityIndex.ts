import type { City } from './types';

const ENDPOINT = 'https://api.mapbox.com/search/geocode/v6/forward';
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// place=도시, locality=도시 내 지역, region=주/도(제주도·하와이·발리), district=군/현
const FEATURE_TYPES = 'place,locality,region,district';

export const MIN_QUERY_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 300;

const RESULT_LIMIT = 8;
const CACHE_LIMIT = 100;
const HANGUL = /[가-힣]/;

const cache = new Map<string, City[]>();

export const hasHangul = (text: string) => HANGUL.test(text);

interface MapboxFeature {
  properties?: {
    mapbox_id?: string;
    name?: string;
    name_preferred?: string;
    coordinates?: { longitude: number; latitude: number };
    context?: { country?: { name?: string } };
  };
}

export async function searchCities(query: string, signal?: AbortSignal): Promise<City[]> {
  const key = query.trim().toLowerCase();
  if (key.length < MIN_QUERY_LENGTH) return [];
  if (!TOKEN) throw new Error('Mapbox 토큰 확인 필요');

  const cached = cache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: key,
    language: 'ko',
    types: FEATURE_TYPES,
    limit: '10', 
    access_token: TOKEN,
  });

  const response = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? 'Mapbox 토큰이 올바르지 않아요' : `검색 서버가 응답하지 않아요 (${response.status})`,
    );
  }

  const body = await response.json();
  const cities = toCities(body.features ?? [], key);
  remember(key, cities);
  return cities;
}

function toCities(features: MapboxFeature[], query: string): City[] {
  const koreanOnly = hasHangul(query);
  const seen = new Set<string>();

  return features
    .map((feature) => {
      const props = feature.properties ?? {};
      return {
        id: props.mapbox_id ?? '',
        name: (props.name_preferred ?? props.name)?.trim() ?? '',
        country: props.context?.country?.name ?? '',
        lat: props.coordinates?.latitude ?? NaN,
        lng: props.coordinates?.longitude ?? NaN,
      };
    })
    .filter((city) => {
      if (!city.id || !city.name || !Number.isFinite(city.lat) || !Number.isFinite(city.lng)) return false;
      if (koreanOnly && !hasHangul(city.name)) return false;
      const label = `${city.name}|${city.country}`;
      const spot = `${city.lat.toFixed(2)},${city.lng.toFixed(2)}`;
      if (seen.has(label) || seen.has(spot)) return false;
      seen.add(label);
      seen.add(spot);
      return true;
    })
    .slice(0, RESULT_LIMIT);
}

function remember(key: string, cities: City[]) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, cities);
}
