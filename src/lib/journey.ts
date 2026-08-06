import { derived, writable } from 'svelte/store';
import type { City, JourneyStop, TransportMode } from './types';
import { getMapPalette, type MapTheme } from './mapTheme';
import { playbackDurationMs } from './journeyPath';

const JOURNEY_STORAGE_KEY = 'yeojeong.journey';

const TRANSPORT_MODE_SET = new Set<TransportMode>(['plane', 'ship', 'train', 'bus', 'car', 'bike', 'walk']);

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
    // 저장 건너뛰기
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
