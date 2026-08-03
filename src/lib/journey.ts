import { writable } from 'svelte/store';
import type { JourneyStop } from './types';

export const journey = writable<JourneyStop[]>([]);
export const currentTheme = writable<'light' | 'dark' | 'sepia'>('light');
export const playbackProgress = writable(0);
export const isPlaying = writable(false);
