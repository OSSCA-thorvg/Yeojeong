export type PresetTheme = 'light' | 'sepia' | 'dark';
export type MapTheme = PresetTheme | 'custom';

export interface MapPalette {
  ocean: [number, number, number];
  land: [number, number, number];
  border: [number, number, number, number];
  label: [number, number, number];
  accent: [number, number, number];
}

export const MAP_PALETTES: Record<PresetTheme, MapPalette> = {
  light: {
    ocean: [209, 232, 249],
    land: [247, 247, 250],
    border: [200, 200, 206, 255],
    label: [90, 90, 95],
    accent: [222, 90, 61],
  },
  sepia: {
    ocean: [214, 196, 158],
    land: [237, 224, 196],
    border: [150, 111, 66, 255],
    label: [90, 62, 34],
    accent: [176, 92, 42],
  },
  dark: {
    ocean: [8, 12, 22],
    land: [24, 28, 40],
    border: [0, 255, 204, 120],
    label: [150, 220, 210],
    accent: [0, 255, 204],
  },
};

export function shade(c: [number, number, number], factor: number): [number, number, number] {
  const mix = (v: number) => (factor >= 0 ? v + (255 - v) * factor : v * (1 + factor));
  return [Math.round(mix(c[0])), Math.round(mix(c[1])), Math.round(mix(c[2]))];
}

export interface CustomColors {
  ocean: [number, number, number];
  land: [number, number, number];
  label: [number, number, number];
}

export function buildCustomPalette({ ocean, land, label }: CustomColors): MapPalette {
  return {
    ocean,
    land,
    border: [...shade(land, -0.3), 220],
    label,
    accent: [222, 90, 61],
  };
}

export function getMapPalette(theme: MapTheme, custom: CustomColors): MapPalette {
  return theme === 'custom' ? buildCustomPalette(custom) : MAP_PALETTES[theme];
}

export function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
