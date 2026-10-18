import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../src/camera.js';

test('Camera: Neutral initialization produces identity and forward vector (0, 0, 1)', () => {
  const camera = new Camera();
  assert.equal(camera.yaw, 0);
  assert.equal(camera.pitch, 0);

  assert.equal(camera.forward.x, 0);
  assert.equal(camera.forward.y, 0);
  assert.equal(camera.forward.z, 1);

  const pt = { x: 10, y: 20, z: 30 };
  const camPt = camera.worldToCamera(pt);
  assert.equal(camPt.x, pt.x);
  assert.equal(camPt.y, pt.y);
  assert.equal(camPt.z, pt.z);
});

test('Camera: Moving pointer from center to left rotates camera plane around Y-axis (negative yaw)', () => {
  const camera = new Camera({ cameraMaxYaw: 0.5 });
  const screenW = 1000;
  const screenH = 800;

  // Move pointer to the left: X = 200 (center is 500)
  camera.setTargetFromPointer(200, 400, screenW, screenH);

  // Normalized nx = (200 - 500) / 500 = -0.6
  // targetYaw = -0.6 * 0.5 = -0.3
  assert.ok(camera.targetYaw < 0, `Expected negative target yaw, got ${camera.targetYaw}`);
  assert.ok(Math.abs(camera.targetYaw - (-0.3)) < 0.001);

  // Advance simulation to damp towards target
  camera.update(1.0);
  assert.ok(camera.yaw < 0, `Expected camera.yaw to be negative, got ${camera.yaw}`);

  // Forward vector should point towards negative X (to the left)
  assert.ok(camera.forward.x < 0, `Expected forward.x to be negative, got ${camera.forward.x}`);
  assert.ok(camera.forward.z > 0, `Expected forward.z to remain positive, got ${camera.forward.z}`);
});

test('Camera: World to camera and camera to world are exact inverses', () => {
  const camera = new Camera();
  camera.setTarget(0.25, -0.15);
  camera.update(1.0);

  const original = { x: 45.2, y: -78.1, z: 320.5 };
  const inCam = camera.worldToCamera(original);
  const backInWorld = camera.cameraToWorld(inCam);

  assert.ok(Math.abs(backInWorld.x - original.x) < 0.001);
  assert.ok(Math.abs(backInWorld.y - original.y) < 0.001);
  assert.ok(Math.abs(backInWorld.z - original.z) < 0.001);
});

test('Camera: Normal vector is perpendicular to camera plane and unit length', () => {
  const camera = new Camera();
  camera.setTarget(-0.35, 0.22);
  camera.update(1.0);

  const len = Math.hypot(camera.forward.x, camera.forward.y, camera.forward.z);
  assert.ok(Math.abs(len - 1.0) < 0.001, `Normal vector must be unit length, got ${len}`);

  // Forward vector must be orthogonal to right and up vectors
  const dotForwardRight = camera.forward.x * camera.right.x + camera.forward.y * camera.right.y + camera.forward.z * camera.right.z;
  const dotForwardUp = camera.forward.x * camera.up.x + camera.forward.y * camera.up.y + camera.forward.z * camera.up.z;

  assert.ok(Math.abs(dotForwardRight) < 0.001, 'Forward must be orthogonal to Right');
  assert.ok(Math.abs(dotForwardUp) < 0.001, 'Forward must be orthogonal to Up');
});

test('Camera: Unprojecting a screen point at depth z and projecting back yields original screen point', () => {
  const camera = new Camera();
  camera.setTarget(0.3, 0.18);
  camera.update(1.0);

  const screenW = 1200;
  const screenH = 900;
  const fl = 550;
  const testX = 350;
  const testY = 620;
  const depth = 150;

  const worldPos = camera.unproject(testX, testY, depth, screenW, screenH, fl);
  const proj = camera.project(worldPos.x, worldPos.y, worldPos.z, screenW, screenH, fl);

  assert.ok(Math.abs(proj.screenX - testX) < 0.01, `Expected screenX ~ ${testX}, got ${proj.screenX}`);
  assert.ok(Math.abs(proj.screenY - testY) < 0.01, `Expected screenY ~ ${testY}, got ${proj.screenY}`);
  assert.ok(Math.abs(proj.cameraZ - depth) < 0.01, `Expected cameraZ ~ ${depth}, got ${proj.cameraZ}`);
});
