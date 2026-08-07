// Defines map theme color palettes (preset and custom) and color conversion/manipulation helpers.
// 지도 테마별 색상 팔레트(프리셋/커스텀)와 색상 변환·조정 유틸리티를 정의한다.
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

// Lightens or darkens an RGB color by a factor (positive lightens toward white, negative darkens toward black).
// RGB 색상을 비율만큼 밝게 또는 어둡게 만든다. 양수는 흰색 쪽으로, 음수는 검은색 쪽으로 이동한다.
export function shade(c: [number, number, number], factor: number): [number, number, number] {
  const mix = (v: number) => (factor >= 0 ? v + (255 - v) * factor : v * (1 + factor));
  return [Math.round(mix(c[0])), Math.round(mix(c[1])), Math.round(mix(c[2]))];
}

export interface CustomColors {
  ocean: [number, number, number];
  land: [number, number, number];
  label: [number, number, number];
}

// Builds a full map palette from user-chosen ocean, land, and label colors, deriving the border color from land.
// 사용자가 지정한 바다, 육지, 라벨 색상으로 전체 지도 팔레트를 만들고, 경계선 색상은 육지색에서 파생시킨다.
export function buildCustomPalette({ ocean, land, label }: CustomColors): MapPalette {
  return {
    ocean,
    land,
    border: [...shade(land, -0.3), 220],
    label,
    accent: [222, 90, 61],
  };
}

// Returns the map palette for a theme, using the custom palette when the theme is 'custom' and a preset otherwise.
// 테마에 맞는 지도 팔레트를 반환한다. 'custom' 테마면 사용자 지정 팔레트를, 아니면 프리셋을 사용한다.
export function getMapPalette(theme: MapTheme, custom: CustomColors): MapPalette {
  return theme === 'custom' ? buildCustomPalette(custom) : MAP_PALETTES[theme];
}

// Converts an RGB color to a hex string.
// RGB 색상을 16진수 문자열로 변환한다.
export function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

// Converts a hex color string to an RGB tuple.
// 16진수 색상 문자열을 RGB 튜플로 변환한다.
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
