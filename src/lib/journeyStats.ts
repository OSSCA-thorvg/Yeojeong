// Computes summary statistics for a journey: total distance, country/city counts, and per-transport-mode distance share.
// 여정의 총 거리, 국가/도시 수, 이동 수단별 거리 비중 등 요약 통계를 계산한다.
import { haversineKm } from './journeyPath';
import { TRANSPORT_MODES } from './transportIcons';
import type { JourneyStop, TransportMode } from './types';

export interface ModeShare {
  mode: TransportMode;
  km: number;
  pct: number;
}

export interface JourneyStats {
  totalKm: number;
  countryCount: number;
  cityCount: number;
  legCount: number;
  modeShares: ModeShare[];
}

// Computes summary statistics for a journey: total distance, country/city counts, and distance share per transport mode.
// 여정의 요약 통계를 계산한다. 총 이동 거리, 국가/도시 수, 이동 수단별 거리 비중을 구한다.
export function computeJourneyStats(stops: JourneyStop[]): JourneyStats {
  const modeKm: Record<TransportMode, number> = {
    plane: 0,
    ship: 0,
    train: 0,
    bus: 0,
    car: 0,
    bike: 0,
    walk: 0,
  };

  let totalKm = 0;
  for (let i = 1; i < stops.length; i++) {
    const km = haversineKm(stops[i - 1].city, stops[i].city);
    const mode = stops[i].arrivalMode as TransportMode;
    modeKm[mode] += km;
    totalKm += km;
  }

  const modeShares = TRANSPORT_MODES.map((mode) => ({
    mode,
    km: modeKm[mode],
    pct: totalKm > 0 ? modeKm[mode] / totalKm : 0,
  })).filter((share) => share.km > 0);

  return {
    totalKm,
    countryCount: new Set(stops.map((s) => s.city.country)).size,
    cityCount: stops.length,
    legCount: Math.max(0, stops.length - 1),
    modeShares,
  };
}
