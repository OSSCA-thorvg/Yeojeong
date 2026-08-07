// Defines the list of transport modes with their display icons and Korean labels.
// 이동 수단 목록과 각 수단의 표시 아이콘, 한글 라벨을 정의한다.
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
