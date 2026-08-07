// Central Svelte stores for app state: the journey itself, map theme/colors, and playback status. Persists the journey to localStorage.
// 여정, 지도 테마/색상, 재생 상태 등 앱 전역 상태를 담는 Svelte 스토어 모음. 여정 데이터는 localStorage에 저장된다.
import { derived, writable } from 'svelte/store';
import type { City, JourneyStop, TransportMode } from './types';
import { getMapPalette, type MapTheme } from './mapTheme';
import { playbackDurationMs } from './journeyPath';

const JOURNEY_STORAGE_KEY = 'yeojeong.journey';

const TRANSPORT_MODE_SET = new Set<TransportMode>(['plane', 'ship', 'train', 'bus', 'car', 'bike', 'walk']);

// Checks whether a value is a valid City object with a name and finite coordinates.
// 값이 이름과 유효한 좌표를 가진 City 객체인지 확인한다.
function isCity(value: unknown): value is City {
  const city = value as City | undefined;
  return (
    !!city &&
    typeof city.name === 'string' &&
    city.name.length > 0 &&
    Number.isFinite(city.lat) &&
    Number.isFinite(city.lng)
  );
}

// Normalizes raw data into a valid array of JourneyStops, filling in defaults for missing or invalid fields.
// 원본 데이터를 유효한 JourneyStop 배열로 정규화하고, 빠지거나 잘못된 값은 기본값으로 채운다.
function sanitizeJourney(value: unknown): JourneyStop[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((stop) => isCity((stop as JourneyStop | undefined)?.city))
    .map((stop: JourneyStop, i) => ({
      city: {
        id: typeof stop.city.id === 'string' ? stop.city.id : '',
        name: stop.city.name,
        country: typeof stop.city.country === 'string' ? stop.city.country : '',
        lat: stop.city.lat,
        lng: stop.city.lng,
      },
      arrivalMode:
        i === 0 ? null : TRANSPORT_MODE_SET.has(stop.arrivalMode as TransportMode) ? stop.arrivalMode : 'plane',
    }));
}

// Loads the saved journey from localStorage, returning an empty array if none exists or parsing fails.
// localStorage에서 저장된 여정을 불러오고, 없거나 파싱에 실패하면 빈 배열을 반환한다.
function loadJourney(): JourneyStop[] {
  try {
    const raw = localStorage.getItem(JOURNEY_STORAGE_KEY);
    return raw ? sanitizeJourney(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export const journey = writable<JourneyStop[]>(loadJourney());
journey.subscribe((stops) => {
  try {
    localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(stops));
  } catch {
    // skip localStorage errors (e.g. quota exceeded, private mode, etc.)
  }
});
export const currentTheme = writable<MapTheme>('light');
export const customOcean = writable<[number, number, number]>([180, 210, 235]);
export const customLand = writable<[number, number, number]>([236, 232, 224]);
export const customLabel = writable<[number, number, number]>([95, 90, 84]);
export const mapPalette = derived(
  [currentTheme, customOcean, customLand, customLabel],
  ([theme, ocean, land, label]) => getMapPalette(theme, { ocean, land, label }),
);
export const playbackDuration = derived(journey, (stops) => playbackDurationMs(stops));
export const playbackProgress = writable(0);
export const playbackSpeed = writable(1);
export const isPlaying = writable(false);
export const isExporting = writable(false);
export const isWrappedOpen = writable(false);
