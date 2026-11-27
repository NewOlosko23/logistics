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

test('index.html exists and has required sections and embedded landdots', () => {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('<title>KV Freight</title>'));
  assert.ok(html.includes('id="landdots"'));
  assert.ok(html.includes('id="globe"'));
  assert.ok(html.includes('id="about"'));
  assert.ok(html.includes('id="services"'));
});
