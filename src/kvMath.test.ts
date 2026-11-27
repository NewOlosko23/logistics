import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clamp,
  computeUnits,
  computeHorizonState,
  lonLatToUnit,
  projectPoint,
  formatThinThousands,
  computeCardSweepPercent,
  cubicBezier,
  computeGlobeLayout,
  computeArcLift,
  computeCityVisibility,
  computeWheelRotation,
} from './kvMath';

test('computeUnits handles desktop, portrait, and short landscape accurately', () => {
  const desktop = computeUnits(1440, 900);
  assert.equal(desktop.isSticky, true);
  assert.equal(desktop.isPort, false);
  assert.equal(desktop.isLand, false);
  assert.equal(desktop.isHp, false);
  assert.equal(desktop.uc, 1);
  assert.equal(desktop.us, 1);
  assert.equal(desktop.u, 900 / 960);

  const phone = computeUnits(375, 812);
  assert.equal(phone.isPort, true);
  assert.equal(phone.isHp, true);
  assert.equal(phone.isSticky, false);
  assert.equal(phone.u, 375 / 430);

  const shortLand = computeUnits(568, 320);
  assert.equal(shortLand.isLand, true);
  assert.equal(shortLand.isHp, true);
  assert.equal(shortLand.isSticky, false);
  assert.equal(shortLand.uc, 568 / 1440);
  assert.equal(shortLand.u, 320 / 430);
});

test('computeHorizonState stops near top and fades smoothly', () => {
  const vh = 900;
  const wrapperH = 1.65 * vh;

  const atTop = computeHorizonState(wrapperH, 0, vh);
  assert.ok(atTop.e > 1.04);
  assert.equal(atTop.hidden, true);
  assert.equal(atTop.copyK, 0);

  const midRise = computeHorizonState(wrapperH, 0.9 * vh, vh);
  assert.ok(Math.abs(midRise.e - 0.28) < 1e-6);
  assert.equal(midRise.hidden, false);
  assert.ok(midRise.copyK > 0.99);

  const decelerated = computeHorizonState(wrapperH, 1.3 * vh, vh);
  assert.ok(decelerated.drawnEdge > -0.03 && decelerated.drawnEdge < 0.12);

  const faded = computeHorizonState(wrapperH, 1.75 * vh, vh);
  assert.equal(faded.opacity, 0);
  assert.equal(faded.hidden, true);
});

test('globe projection puts Rotterdam, Lagos, and Santos on front hemisphere at t=0', () => {
  const viewLon = (-10 * Math.PI) / 180;
  const tilt = (9 * Math.PI) / 180;

  const rotterdam = projectPoint(...lonLatToUnit(4.48, 51.92), viewLon, tilt);
  const lagos = projectPoint(...lonLatToUnit(3.39, 6.45), viewLon, tilt);
  const santos = projectPoint(...lonLatToUnit(-46.33, -23.96), viewLon, tilt);

  assert.ok(rotterdam.z > 0.5 && rotterdam.y > 0);
  assert.ok(lagos.z > 0.9);
  assert.ok(santos.z > 0.5 && santos.x < 0 && santos.y < 0);

  // Moving viewLon more negative shifts a fixed point right (+x)
  const lagosLater = projectPoint(...lonLatToUnit(3.39, 6.45), (-20 * Math.PI) / 180, tilt);
  assert.ok(lagosLater.x > lagos.x);
});

test('formatting, sweep math, and cubicBezier behave monotonically', () => {
  assert.equal(formatThinThousands(2500), '2\u2009500');
  assert.equal(formatThinThousands(8), '8');
  assert.equal(computeCardSweepPercent(1440, 1440), clamp((0.98 - 1) / 0.3, -0.4, 1.6) * 100);
  assert.equal(computeCardSweepPercent(0, 1440), 160);
  assert.equal(cubicBezier(0.4, 0.05, 0.55, 0.95, 0), 0);
  assert.equal(cubicBezier(0.4, 0.05, 0.55, 0.95, 1), 1);
  assert.ok(cubicBezier(0.4, 0.05, 0.55, 0.95, 0.5) > 0.4);
});

test('index.html exists and has required sections, embedded landdots, and global globe cities', () => {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('<title>KV Freight</title>'));
  assert.ok(html.includes('id="landdots"'));
  assert.ok(html.includes('id="globe"'));
  assert.ok(html.includes('id="about"'));
  assert.ok(html.includes('id="services"'));

  const expectedCities = [
    'ROTTERDAM', 'LONDON', 'FRANKFURT', 'MADRID', 'ISTANBUL',
    'CAIRO', 'LAGOS', 'ADDIS ABABA', 'MOMBASA', 'JOHANNESBURG', 'DURBAN',
    'RIYADH', 'DUBAI',
    'KARACHI', 'MUMBAI', 'BANGKOK', 'SINGAPORE', 'HONG KONG', 'SHANGHAI', 'SEOUL', 'TOKYO', 'SYDNEY',
    'NEW YORK', 'CHARLOTTE', 'MIAMI', 'CHICAGO', 'HOUSTON', 'MEXICO CITY', 'SAN DIEGO', 'VANCOUVER',
    'BOGOTA', 'LIMA', 'SANTOS', 'BUENOS AIRES', 'SANTIAGO',
  ];
  for (const city of expectedCities) {
    assert.ok(html.includes(`name: '${city}'`), `Missing globe city: ${city}`);
  }

  // Verify Middle East, Europe, Africa, Asia/Pacific, and North/South America hubs rotate onto front hemisphere
  const tilt = (9 * Math.PI) / 180;
  const frontOverSpin = [
    { name: 'LONDON', lon: -0.13, lat: 51.51, viewDeg: 0 },
    { name: 'FRANKFURT', lon: 8.68, lat: 50.11, viewDeg: 10 },
    { name: 'MADRID', lon: -3.70, lat: 40.42, viewDeg: 0 },
    { name: 'ISTANBUL', lon: 28.98, lat: 41.01, viewDeg: 25 },
    { name: 'CAIRO', lon: 31.24, lat: 30.04, viewDeg: 25 },
    { name: 'ADDIS ABABA', lon: 38.74, lat: 9.03, viewDeg: 35 },
    { name: 'MOMBASA', lon: 39.67, lat: -4.04, viewDeg: 35 },
    { name: 'JOHANNESBURG', lon: 28.05, lat: -26.20, viewDeg: 25 },
    { name: 'DURBAN', lon: 31.02, lat: -29.86, viewDeg: 25 },
    { name: 'RIYADH', lon: 46.68, lat: 24.71, viewDeg: 45 },
    { name: 'DUBAI', lon: 55.27, lat: 25.20, viewDeg: 55 },
    { name: 'KARACHI', lon: 67.01, lat: 24.86, viewDeg: 65 },
    { name: 'MUMBAI', lon: 72.88, lat: 19.08, viewDeg: 70 },
    { name: 'BANGKOK', lon: 100.50, lat: 13.76, viewDeg: 100 },
    { name: 'SINGAPORE', lon: 103.82, lat: 1.35, viewDeg: 105 },
    { name: 'HONG KONG', lon: 114.17, lat: 22.32, viewDeg: 115 },
    { name: 'SHANGHAI', lon: 121.47, lat: 31.23, viewDeg: 120 },
    { name: 'SEOUL', lon: 126.98, lat: 37.57, viewDeg: 125 },
    { name: 'TOKYO', lon: 139.69, lat: 35.68, viewDeg: 140 },
    { name: 'SYDNEY', lon: 151.21, lat: -33.87, viewDeg: 150 },
    { name: 'NEW YORK', lon: -74.01, lat: 40.71, viewDeg: -75 },
    { name: 'CHARLOTTE', lon: -80.84, lat: 35.23, viewDeg: -80 },
    { name: 'MIAMI', lon: -80.19, lat: 25.76, viewDeg: -80 },
    { name: 'CHICAGO', lon: -87.63, lat: 41.88, viewDeg: -90 },
    { name: 'HOUSTON', lon: -95.37, lat: 29.76, viewDeg: -95 },
    { name: 'MEXICO CITY', lon: -99.13, lat: 19.43, viewDeg: -100 },
    { name: 'SAN DIEGO', lon: -117.16, lat: 32.72, viewDeg: -115 },
    { name: 'VANCOUVER', lon: -123.12, lat: 49.28, viewDeg: -120 },
    { name: 'BOGOTA', lon: -74.07, lat: 4.71, viewDeg: -75 },
    { name: 'LIMA', lon: -77.04, lat: -12.05, viewDeg: -75 },
    { name: 'BUENOS AIRES', lon: -58.38, lat: -34.60, viewDeg: -60 },
    { name: 'SANTIAGO', lon: -70.67, lat: -33.45, viewDeg: -70 },
  ];
  for (const c of frontOverSpin) {
    const p = projectPoint(...lonLatToUnit(c.lon, c.lat), (c.viewDeg * Math.PI) / 180, tilt);
    assert.ok(p.z > 0.5, `${c.name} should face viewer at viewDeg=${c.viewDeg}`);
  }
});

test('computeGlobeLayout keeps globe centered on portrait and separated from copy on landscape', () => {
  // Desktop 1440x900
  const deskU = computeUnits(1440, 900);
  const desk = computeGlobeLayout(1440, 900, 900, deskU.uc, 1, deskU.isPort, deskU.isLand);
  assert.equal(desk.scale, 1);
  assert.equal(desk.cx, 1166);
  assert.equal(desk.cy, 530);
  assert.equal(desk.R, 400);

  // Small portrait phone 320x568 and standard phone 375x812
  for (const [vw, vh, canvasH] of [[320, 568, 310], [375, 812, 352.5], [768, 1024, 560]] as const) {
    const u = computeUnits(vw, vh);
    const uv = Math.max(vw / 1440, vh / 900);
    const g = computeGlobeLayout(vw, vh, canvasH, u.uc, uv, u.isPort, u.isLand);
    assert.equal(g.cx, vw * 0.5);
    assert.ok(g.cx - g.R > 0, `left edge clipped at ${vw}x${vh}`);
    assert.ok(g.cx + g.R < vw, `right edge clipped at ${vw}x${vh}`);
    assert.ok(g.cy - g.R > 0, `top edge clipped at ${vw}x${vh}`);
  }

  // Tablet landscape 1024x768 & mobile landscape 667x375, 844x390
  for (const [vw, vh] of [[1024, 768], [667, 375], [844, 390]] as const) {
    const u = computeUnits(vw, vh);
    const heroH = Math.max(vh, 900 * u.uc);
    const uv = Math.max(vw / 1440, heroH / 900);
    const g = computeGlobeLayout(vw, heroH, heroH, u.uc, uv, u.isPort, u.isLand);
    const copyRight = 218 * u.uc + Math.max(418 * u.uc, 250);
    assert.ok(g.cx - g.R >= copyRight, `globe overlaps copy at ${vw}x${vh}: ${g.cx - g.R} < ${copyRight}`);
  }
});

test('computeArcLift differentiates air vs sea and computeCityVisibility hides passed cities', () => {
  assert.equal(computeArcLift(Math.PI, 0, 'air'), 1);
  assert.equal(computeArcLift(Math.PI, 1, 'air'), 1);
  assert.ok(Math.abs(computeArcLift(Math.PI, 0.5, 'air') - 1.117) < 1e-6);
  assert.ok(Math.abs(computeArcLift(Math.PI, 0.5, 'sea') - 1.018) < 1e-6);
  assert.ok(computeArcLift(Math.PI, 0.5, 'air') > computeArcLift(Math.PI, 0.5, 'sea'));

  // Passed off right edge of desktop canvas (e.g. San Diego px > 1440 while z2 > 0.2)
  const passedRight = computeCityVisibility(1452, 460, 0.35, 4.5, 1440, 900);
  assert.equal(passedRight.visible, false);
  assert.equal(passedRight.labelAlpha, 0);

  // Near limb (z2 <= 0.16): pin may faintly show, label does not hang
  const nearLimb = computeCityVisibility(800, 400, 0.15, 4.5, 1440, 900);
  assert.equal(nearLimb.visible, true);
  assert.equal(nearLimb.labelAlpha, 0);

  // Front center: both pin and label fully visible
  const frontCenter = computeCityVisibility(1100, 450, 0.9, 4.5, 1440, 900);
  assert.equal(frontCenter.visible, true);
  assert.equal(frontCenter.labelAlpha, 1);

  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  assert.ok(html.includes("mode: 'air'"));
  assert.ok(html.includes("mode: 'sea'"));
  assert.ok(html.includes('id="swheels"'));
  assert.ok(html.includes('drawTruckWheels'));
  assert.ok(html.includes('const ARC_SEGS = 120;'));
  assert.ok(html.includes('tSec * 8.5'));
  assert.ok(html.includes('findHorizonCross'));
  assert.ok(html.includes('ResizeObserver'));
});

test('computeWheelRotation activates after container load & video settle and rotates clockwise with scroll', () => {
  const beforeLoad = computeWheelRotation(2826 + 0.5 * 2.4 * 900, 2826, 2.4, 900, 900, false, 0.5);
  assert.equal(beforeLoad.alpha, 0);
  assert.equal(beforeLoad.angle, 0);

  // Even if scroll jumps to q=1.0, wheels remain hidden while video is still seeking before 0.94
  const laggingVideo = computeWheelRotation(2826 + 2.4 * 900 + 200, 2826, 2.4, 900, 900, false, 0.7);
  assert.equal(laggingVideo.alpha, 0);

  const driving1 = computeWheelRotation(2826 + 2.4 * 900 + 200, 2826, 2.4, 900, 900, false, 1);
  const driving2 = computeWheelRotation(2826 + 2.4 * 900 + 800, 2826, 2.4, 900, 900, false, 1);
  assert.equal(driving1.alpha, 1);
  assert.ok(driving2.angle > driving1.angle);

  const reduced = computeWheelRotation(2826 + 2.4 * 900 + 800, 2826, 2.4, 900, 900, true, 1);
  assert.equal(reduced.alpha, 0);
});

