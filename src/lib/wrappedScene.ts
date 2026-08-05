import type { Scene, ThorVGNamespace } from '@thorvg/webcanvas';
import { transportColor } from './journeyPath';
import type { JourneyStats } from './journeyStats';

const FONT = 'inter';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

export function buildWrappedScene(
  TVG: ThorVGNamespace,
  stats: JourneyStats,
  progress: number,
  accent: [number, number, number],
  width: number,
  height: number,
): Scene {
  const scene = new TVG.Scene();
  const eased = easeOutCubic(progress);

  const bg = new TVG.Shape();
  bg.appendRect(0, 0, width, height);
  const bgGradient = new TVG.RadialGradient(width / 2, height * 0.32, height * 0.8);
  bgGradient.addStop(0, [accent[0], accent[1], accent[2], 70]);
  bgGradient.addStop(1, [14, 14, 20, 255]);
  bg.fill(bgGradient);
  scene.add(bg);

  const cx = width / 2;
  const cy = height * 0.34;
  const outerR = Math.min(width, height) * 0.24;
  const strokeW = outerR * 0.26;

  const addText = (content: string, size: number, x: number, y: number, color: [number, number, number]) => {
    const text = new TVG.Text();
    text.font(FONT).fontSize(size).align(0.5, 0.5).fill(...color);
    text.text(content);
    text.translate(x, y);
    scene.add(text);
  };

  let cursor = 0;
  for (const share of stats.modeShares) {
    const start = cursor;
    const end = cursor + share.pct;
    cursor = end;
    const visibleEnd = Math.min(end, eased);
    if (visibleEnd <= start) continue;

    const arc = new TVG.Shape();
    arc.appendCircle(cx, cy, outerR);
    arc.trimPath(start, visibleEnd);
    const [r, g, b] = transportColor(share.mode, accent);
    arc.stroke({ width: strokeW, color: [r, g, b, 255], cap: TVG.StrokeCap.Round });
    scene.add(arc);
  }

  const km = Math.round(stats.totalKm * eased);
  addText(km.toLocaleString('en-US'), outerR * 0.44, cx, cy - outerR * 0.1, [255, 255, 255]);
  const softAccent: [number, number, number] = [
    Math.round((accent[0] + 255) / 2),
    Math.round((accent[1] + 255) / 2),
    Math.round((accent[2] + 255) / 2),
  ];
  addText('KM TRAVELED', outerR * 0.15, cx, cy + outerR * 0.32, softAccent);

  const statRow: Array<{ value: number; label: string }> = [
    { value: stats.countryCount, label: 'COUNTRIES' },
    { value: stats.cityCount, label: 'CITIES' },
    { value: stats.legCount, label: 'LEGS' },
  ];
  const statY = cy + outerR + strokeW + 40;
  const colW = width / statRow.length;
  statRow.forEach((s, i) => {
    const x = colW * i + colW / 2;
    const value = Math.round(s.value * eased);
    addText(String(value), outerR * 0.36, x, statY, [255, 255, 255]);
    addText(s.label, outerR * 0.12, x, statY + outerR * 0.34, [190, 190, 200]);
  });

  return scene;
}
