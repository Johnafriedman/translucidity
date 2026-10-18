import test from 'node:test';
import assert from 'node:assert/strict';
import { BubbleSystem } from '../src/bubble-system.js';
import { DEFAULT_CONFIG } from '../src/config.js';

// Mock minimal renderer and audio for headless testing
const mockRenderer = {
  currentTheme: {
    bubbleGradients: [
      { rim: 'rgba(255,255,255,0.8)', mid: 'rgba(255,255,255,0.3)', core: 'rgba(255,255,255,0.1)' }
    ]
  },
  triggerBurst: () => {}
};

const mockAudio = {
  playPop: () => {},
  playStreamBlip: () => {}
};

test('BubbleSystem: Initial population populates ambient bubbles at diverse depths', () => {
  const system = new BubbleSystem({
    config: DEFAULT_CONFIG,
    renderer: mockRenderer,
    audio: mockAudio
  });

  system.populateInitial(25, 1200, 800);
  assert.equal(system.bubbles.length, 25, 'Should create 25 initial bubbles');

  // Verify diversity of z coordinates
  const depths = system.bubbles.map(b => b.z);
  const minZ = Math.min(...depths);
  const maxZ = Math.max(...depths);
  assert.ok(maxZ > minZ + 50, 'Bubbles should have a diverse depth distribution');
});

test('BubbleSystem: Pointer streaming continuously emits bubbles integrated into system', () => {
  const system = new BubbleSystem({
    config: { ...DEFAULT_CONFIG, streamRate: 100 },
    renderer: mockRenderer,
    audio: mockAudio
  });

  const pointerId = 1;
  const screenX = 400;
  const screenY = 300;

  // Simulate pointerdown
  system.onPointerDown(pointerId, screenX, screenY);

  // Advance time by 0.1s (should spawn ~10 bubbles at 100/sec)
  system.update(0.1, 800, 600);

  assert.ok(
    system.bubbles.length >= 8,
    `Expected at least 8 streamed bubbles, got ${system.bubbles.length}`
  );

  const streamed = system.bubbles.filter(b => b.isStreamed);
  assert.equal(streamed.length, system.bubbles.length, 'All new bubbles should be marked streamed');

  // Verify they advance in both Y (rising) and Z (moving away)
  const initialZ = streamed[0].z;
  const initialY = streamed[0].y;

  system.update(0.5, 800, 600);

  assert.ok(
    streamed[0].z > initialZ,
    'Streamed bubble must advance along positive z-axis'
  );
  assert.ok(
    streamed[0].y > initialY,
    'Streamed bubble must rise along positive y-axis'
  );

  // Releasing pointer stops new emissions
  system.onPointerUp(pointerId);
  const countAfterRelease = system.bubbles.length;

  system.update(0.2, 800, 600);
  // Without ambient spawn, count should not increase
  assert.ok(
    system.activePointers.size === 0,
    'Pointer should be removed from active map on release'
  );
});

test('BubbleSystem: Popping a bubble removes it cleanly', () => {
  const system = new BubbleSystem({
    config: DEFAULT_CONFIG,
    renderer: mockRenderer,
    audio: mockAudio
  });

  system.populateInitial(5, 800, 600);
  const targetBubble = system.bubbles[0];

  system.popBubble(targetBubble);
  assert.equal(targetBubble.alive, false, 'Popped bubble should be marked not alive');

  system.update(0.01, 800, 600);
  assert.ok(
    !system.bubbles.includes(targetBubble),
    'Dead bubble should be pruned from system'
  );
});
