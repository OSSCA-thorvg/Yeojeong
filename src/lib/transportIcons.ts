import type { TransportMode } from './types';

export const TRANSPORT_MODES: TransportMode[] = ['plane', 'ship', 'car', 'train', 'bus', 'bike', 'walk'];

export const TRANSPORT_ICON: Record<TransportMode, string> = {
  plane: '✈️',
  ship: '🚢',
  car: '🚗',
  train: '🚆',
  bus: '🚌',
  bike: '🚲',
  walk: '🚶',
};

export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  plane: '비행기',
  ship: '배',
  car: '자동차',
  train: '기차',
  bus: '버스',
  bike: '자전거',
  walk: '걷기',
};
