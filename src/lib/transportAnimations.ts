import type { TransportMode } from './types';

import planeAnim from '../data/animations/TriPriend.json?raw';
import shipAnim from '../data/animations/Ship.json?raw';
import carAnim from '../data/animations/Red Car.json?raw';
import trainAnim from '../data/animations/train.json?raw';
import busAnim from '../data/animations/Bus Transport.json?raw';
import bikeAnim from '../data/animations/Cycling.json?raw';
import walkAnim from '../data/animations/girl travel walk cycle.json?raw';

export const TRANSPORT_ANIMATION: Record<TransportMode, string> = {
  plane: planeAnim,
  ship: shipAnim,
  car: carAnim,
  train: trainAnim,
  bus: busAnim,
  bike: bikeAnim,
  walk: walkAnim,
};

export const TRANSPORT_ANIMATION_BASE_FACING: Record<TransportMode, 1 | -1> = {
  plane: 1,
  ship: 1,
  car: -1,
  train: 1,
  bus: 1,
  bike: 1,
  walk: 1,
};

export const TRANSPORT_ANIMATION_SCALE: Record<TransportMode, number> = {
  plane: 1,
  ship: 0.85,
  car: 0.95,
  train: 0.5,
  bus: 1.2,
  bike: 0.55,
  walk: 0.85,
};

export const TRANSPORT_ANIMATION_SPEED: Record<TransportMode, number> = {
  plane: 3.5,
  ship: 3,
  car: 0.95,
  train: 1.2,
  bus: 0.4,
  bike: 1.35,
  walk: 1.05,
};

export const TRANSPORT_ANIMATION_ANCHOR: Record<TransportMode, 'center' | 'bottom'> = {
  plane: 'center',
  ship: 'center',
  car: 'center',
  train: 'bottom',
  bus: 'bottom',
  bike: 'center',
  walk: 'bottom',
};
