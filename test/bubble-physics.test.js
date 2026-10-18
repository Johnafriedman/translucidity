import test from 'node:test';
import assert from 'node:assert/strict';
import { Bubble } from '../src/bubble.js';
import { DEFAULT_CONFIG } from '../src/config.js';

test('Physics: Size-dependent buoyancy ensures larger bubbles rise faster', () => {
  const smallBubble = new Bubble({
    x: 0,
    y: 0,
    z: 50,
    radius: 10,
    config: DEFAULT_CONFIG
  });

  const largeBubble = new Bubble({
    x: 0,
    y: 0,
    z: 50,
    radius: 35,
    config: DEFAULT_CONFIG
  });

  assert.ok(
    largeBubble.baseVy > smallBubble.baseVy,
    `Expected large bubble (r=35, vy=${largeBubble.baseVy}) to have higher buoyancy than small bubble (r=10, vy=${smallBubble.baseVy})`
  );

  // Advance simulation by 1 second
  smallBubble.update(1.0, 1000, 1000);
  largeBubble.update(1.0, 1000, 1000);

  assert.ok(
    largeBubble.y > smallBubble.y,
    `Expected large bubble world y (${largeBubble.y}) to be greater than small bubble y (${smallBubble.y}) after rising`
  );
});

test('Depth & Perspective: Bubble moves away along z-axis and shrinks in screen space', () => {
  const bubble = new Bubble({
    x: 100,
    y: 0,
    z: 20,
    radius: 30,
    config: DEFAULT_CONFIG,
    vz: 100
  });

  const screenW = 1000;
  const screenH = 800;

  bubble.update(0.001, screenW, screenH);
  const initialZ = bubble.z;
  const initialProjectedRadius = bubble.projectedRadius;

  // Advance 2 seconds
  bubble.update(2.0, screenW, screenH);

  assert.ok(
    bubble.z > initialZ,
    `Expected bubble z (${bubble.z}) to have moved deeper than initial z (${initialZ})`
  );

  assert.ok(
    bubble.projectedRadius < initialProjectedRadius,
    `Expected screen radius (${bubble.projectedRadius}) to be smaller than initial screen radius (${initialProjectedRadius})`
  );
});

test('Lifecycle: Bubble expires when reaching maxDepth or passing viewport ceiling', () => {
  // Max depth expiration test
  const deepBubble = new Bubble({
    x: 0,
    y: 0,
    z: DEFAULT_CONFIG.maxDepth - 10,
    radius: 20,
    config: DEFAULT_CONFIG,
    vz: 100
  });

  assert.equal(deepBubble.alive, true);
  deepBubble.update(0.5, 1000, 800);
  assert.equal(
    deepBubble.alive,
    false,
    'Bubble should be marked dead after passing maxDepth'
  );

  // Ceiling expiration test
  const highBubble = new Bubble({
    x: 0,
    y: 2000, // Very high in world space
    z: 50,
    radius: 20,
    config: DEFAULT_CONFIG
  });

  highBubble.update(0.1, 1000, 800);
  assert.equal(
    highBubble.alive,
    false,
    'Bubble should be marked dead after floating past top ceiling'
  );
});

test('Interaction: Point hit detection identifies bubble taps accurately', () => {
  const bubble = new Bubble({
    x: 0,
    y: 0,
    z: 50,
    radius: 25,
    config: DEFAULT_CONFIG
  });

  bubble.alpha = 0.8;
  bubble.update(0.001, 800, 600);

  // Screen center should be hit
  const hitCenter = bubble.containsPoint(bubble.projectedX, bubble.projectedY);
  assert.equal(hitCenter, true, 'Clicking projected center should hit bubble');

  // Slight offset within radius
  const hitInside = bubble.containsPoint(
    bubble.projectedX + bubble.projectedRadius * 0.5,
    bubble.projectedY + bubble.projectedRadius * 0.5
  );
  assert.equal(hitInside, true, 'Clicking inside radius should hit bubble');

  // Point far away
  const hitOutside = bubble.containsPoint(
    bubble.projectedX + 300,
    bubble.projectedY + 300
  );
  assert.equal(hitOutside, false, 'Clicking far away should not hit bubble');
});
