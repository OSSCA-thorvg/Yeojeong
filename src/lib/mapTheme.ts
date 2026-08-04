export type MapTheme = 'light' | 'sepia' | 'dark';

export interface MapPalette {
  ocean: [number, number, number];
  land: [number, number, number];
  border: [number, number, number, number];
  label: [number, number, number];
  accent: [number, number, number];
}

export const MAP_PALETTES: Record<MapTheme, MapPalette> = {
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

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export const MAP_BACKGROUND_HEX: Record<MapTheme, string> = Object.fromEntries(
  (Object.entries(MAP_PALETTES) as [MapTheme, MapPalette][]).map(([theme, palette]) => [theme, toHex(palette.ocean)]),
) as Record<MapTheme, string>;
