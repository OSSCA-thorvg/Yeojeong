import { derived, writable } from 'svelte/store';
import type { JourneyStop } from './types';
import { getMapPalette, type MapTheme } from './mapTheme';

const JOURNEY_STORAGE_KEY = 'yeojeong.journey';

function loadJourney(): JourneyStop[] {
  try {
    const raw = localStorage.getItem(JOURNEY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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
export const playbackProgress = writable(0);
export const isPlaying = writable(false);
export const isExporting = writable(false);
export const isWrappedOpen = writable(false);
