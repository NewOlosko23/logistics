export interface UnitsResult {
  isPort: boolean;
  isLand: boolean;
  isHp: boolean;
  isSticky: boolean;
  uc: number;
  us: number;
  u: number;
}

export function clamp(v: number, min = 0, max = 1): number {
  return v < min ? min : v > max ? max : v;
}

export function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const mt = 1 - t;
    const bx = 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t;
    const dbx = 3 * mt * mt * p1x + 6 * mt * t * (p2x - p1x) + 3 * t * t * (1 - p2x);
    if (Math.abs(dbx) < 1e-6) break;
    t = clamp(t - (bx - x) / dbx, 0, 1);
  }
  const mt = 1 - t;
  return 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t;
}

export function computeUnits(vw: number, vh: number): UnitsResult {
  const isPort = vw <= vh;
  const isLand = !isPort && vh < 500;
  const isHp = isPort || isLand || vw < 768;
  const isSticky = !isPort && !isLand;

  const uc = vh < 520
    ? Math.min(vw / 1440, Math.max(vh / 900, 0.6))
    : Math.min(vw / 1440, vh / 900);

  const us = vw / 1440;

  let u: number;
  if (isLand) {
    u = vh / 430;
  } else if (isHp) {
    u = Math.min(vw / 430, 1.4);
  } else {
    u = Math.min(vw / 1440, vh / 960);
  }

  return { isPort, isLand, isHp, isSticky, uc, us, u };
}

export function computeHorizonState(wrapperHeight: number, scrollY: number, vh: number) {
  const e = (wrapperHeight - scrollY) / vh - 0.47;
  const drawnEdge = e > 0.12 ? e : -0.03 + 0.15 * Math.exp((e - 0.12) / 0.15);
  const opacity = 1 - easeInOutQuad(clamp((-0.12 - e) / 0.4, 0, 1));
  const hidden = opacity < 0.002 || e > 1.04;
  const copyK = clamp((0.95 - e) / 0.42, 0, 1);
  const navAlpha = 1 - clamp((0.85 - e) / 0.4, 0, 1);
  const globeOpacity = 0.45 + 0.55 * clamp(e / 0.7, 0, 1);
  return { e, drawnEdge, opacity, hidden, copyK, navAlpha, globeOpacity };
}

export function lonLatToUnit(lonDeg: number, latDeg: number): [number, number, number] {
  const lon = (lonDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  return [
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.cos(lon),
  ];
}

export function projectPoint(
  vx: number,
  vy: number,
  vz: number,
  viewLonRad: number,
  tiltRad: number
): { x: number; y: number; z: number } {
  const cl = Math.cos(viewLonRad);
  const sl = Math.sin(viewLonRad);
  const x1 = vx * cl - vz * sl;
  const z1 = vz * cl + vx * sl;
  const ct = Math.cos(tiltRad);
  const st = Math.sin(tiltRad);
  const y2 = vy * ct - z1 * st;
  const z2 = vy * st + z1 * ct;
  return { x: x1, y: y2, z: z2 };
}

export function formatThinThousands(n: number): string {
  const s = String(Math.round(n));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
}

export function computeCardSweepPercent(cardLeft: number, vw: number): number {
  return clamp((0.98 - cardLeft / vw) / 0.3, -0.4, 1.6) * 100;
}
