import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../src/camera.js';
import { Bubble } from '../src/bubble.js';
import { BubbleSystem } from '../src/bubble-system.js';
import { DEFAULT_CONFIG } from '../src/config.js';

// Minimal mock renderer and audio for headless testing
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

test('Camera Rotation: Pointer moving from center to left rotates camera plane around Y-axis', () => {
  const camera = new Camera(DEFAULT_CONFIG);
  const width = 1200;
  const height = 800;

  // Center is at (600, 400). Move pointer to left at (300, 400)
  camera.setTargetFromPointer(300, 400, width, height);

  // Target yaw should be negative (rotating around Y-axis towards left)
  assert.ok(camera.targetYaw < 0, `Expected negative target yaw, got ${camera.targetYaw}`);

  camera.update(1.0);
  assert.ok(camera.yaw < 0, `Expected camera yaw to be negative, got ${camera.yaw}`);

  // Normal vector perpendicular to camera plane should have negative X component
  assert.ok(camera.forward.x < 0, `Expected camera forward.x < 0, got ${camera.forward.x}`);
  assert.ok(camera.forward.z > 0, `Expected camera forward.z > 0, got ${camera.forward.z}`);
});

test('Perpendicular Emission: Streamed bubbles are emitted perpendicular to the camera plane', () => {
  const camera = new Camera(DEFAULT_CONFIG);
  // Set camera tilted to the left (yaw = -0.35 rad)
  camera.setTarget(-0.35, 0);
  camera.update(1.0);

  const system = new BubbleSystem({
    config: { ...DEFAULT_CONFIG, streamRate: 100, streamScatterVelocity: 0 },
    renderer: mockRenderer,
    audio: mockAudio,
    camera
  });

  const screenW = 1000;
  const screenH = 800;

  // Start pointer streaming at screen center
  system.onPointerDown(1, 500, 400);
  system.update(0.05, screenW, screenH);

  assert.ok(system.bubbles.length > 0, 'Should have streamed at least one bubble');
  const bubble = system.bubbles[0];

  // The bubble's emission velocity into the scene must point along camera.forward:
  // bubble.vx should be negative (pointing along camera.forward.x)
  // bubble.vz should be positive (pointing along camera.forward.z)
  assert.ok(
    bubble.vx < 0,
    `Expected bubble.vx < 0 when camera is tilted left, got ${bubble.vx}`
  );
  assert.ok(
    bubble.vz > 0,
    `Expected bubble.vz > 0 into scene, got ${bubble.vz}`
  );

  // Velocity ratio vx / vz should closely match normal.x / normal.z
  const velRatio = bubble.vx / bubble.vz;
  const normalRatio = camera.forward.x / camera.forward.z;
  assert.ok(
    Math.abs(velRatio - normalRatio) < 0.25,
    `Expected velocity ratio (${velRatio}) to align with camera normal ratio (${normalRatio})`
  );
});

test('World Buoyancy: Bubbles continue to float up relative to world coordinates (+Y)', () => {
  const camera = new Camera(DEFAULT_CONFIG);
  // Set extreme camera tilt
  camera.setTarget(0.40, -0.25);
  camera.update(1.0);

  const bubble = new Bubble({
    x: 0,
    y: 100,
    z: 50,
    radius: 20,
    config: DEFAULT_CONFIG
  });

  const initialWorldY = bubble.y;
  assert.ok(bubble.vy > 0, 'Bubble should have positive upward buoyancy velocity');

  // Advance simulation by 1 second with tilted camera
  bubble.update(1.0, 1000, 800, camera);

  assert.ok(
    bubble.y > initialWorldY,
    `Expected bubble world Y (${bubble.y}) to rise above initial world Y (${initialWorldY})`
  );
  assert.ok(
    Math.abs((bubble.y - initialWorldY) - bubble.vy) < 1.0,
    'Bubble rise displacement should match world upward velocity defined at initialization'
  );
});

test('Decoupled Trajectory: Camera tilt after emission does not alter bubble world motion', () => {
  const camera = new Camera(DEFAULT_CONFIG);
  const bubble = new Bubble({
    x: 0,
    y: 0,
    z: 100,
    radius: 20,
    config: DEFAULT_CONFIG,
    vx: 10,
    vy: 50,
    vz: 100
  });

  // Camera is neutral initially
  bubble.update(0.5, 1000, 800, camera);
  const worldX_step1 = bubble.x;
  const worldY_step1 = bubble.y;
  const worldZ_step1 = bubble.z;

  // Now tilt camera dramatically
  camera.setTarget(-0.4, 0.25);
  camera.update(1.0);

  // Advance another 0.5s
  bubble.update(0.5, 1000, 800, camera);

  // World coordinates should have progressed steadily based on initialized velocities
  assert.ok(Math.abs(bubble.x - (worldX_step1 + 10 * 0.5)) < 1.0);
  assert.ok(Math.abs(bubble.y - (worldY_step1 + bubble.vy * 0.5)) < 1.0);
  assert.ok(Math.abs(bubble.z - (worldZ_step1 + 100 * 0.5)) < 1.0);

  // But camera space coordinates reflect the tilted camera view
  assert.notEqual(bubble.cameraX, bubble.x);
});

test('Touch Interaction: Two-finger centroid tilts camera without emitting bubbles', () => {
  const camera = new Camera(DEFAULT_CONFIG);
  const system = new BubbleSystem({
    config: DEFAULT_CONFIG,
    renderer: mockRenderer,
    audio: mockAudio,
    camera
  });

  const width = 1000;
  const height = 800;

  // Simulate two touch points to the left of center (centroid X = 250, Y = 400)
  const touch1 = { x: 200, y: 400 };
  const touch2 = { x: 300, y: 400 };
  const centroidX = (touch1.x + touch2.x) * 0.5;
  const centroidY = (touch1.y + touch2.y) * 0.5;

  system.setCameraTargetFromPointer(centroidX, centroidY, width, height);

  assert.ok(camera.targetYaw < 0, `Expected negative target yaw from centroid, got ${camera.targetYaw}`);
  assert.equal(system.bubbles.length, 0, 'Two-finger tilt should not emit bubbles');
});
