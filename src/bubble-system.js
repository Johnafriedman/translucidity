/**
 * Bubble System Manager
 * Manages active bubbles, ambient spawner, multi-pointer stream emission,
 * hit detection, and lifecycle integration.
 */

import { Bubble } from './bubble.js';
import { Camera } from './camera.js';

export class BubbleSystem {
  /**
   * @param {Object} options
   * @param {Object} options.config
   * @param {import('./renderer.js').Renderer} options.renderer
   * @param {import('./audio.js').AudioManager} options.audio
   * @param {import('./camera.js').Camera} [options.camera]
   */
  constructor(options) {
    const { config, renderer, audio, camera } = options;
    this.config = config;
    this.renderer = renderer;
    this.audio = audio;
    this.camera = camera || new Camera(this.config);

    this.bubbles = [];
    this.activePointers = new Map(); // pointerId -> { x, y, prevX, prevY, vx, vy, accumulator }
    this.ambientAccumulator = 0;
    this.paletteCounter = 0;
  }

  /**
   * Pre-populate the scene with ambient bubbles at diverse depths and heights
   */
  populateInitial(count = 35, width, height) {
    for (let i = 0; i < count; i++) {
      const z = 20 + Math.random() * (this.config.maxDepth * 0.75);
      const fl = this.config.focalLength;

      // Distribute across screen coordinates, unprojected to world
      const screenX = Math.random() * width;
      const screenY = Math.random() * height;

      const worldPos = this.camera
        ? this.camera.unproject(screenX, screenY, z, width, height, fl)
        : {
            x: (screenX - width * 0.5) / (fl / (fl + z)),
            y: (height * 0.5 - screenY) / (fl / (fl + z)),
            z
          };

      const radius = this.config.minRadius + Math.random() * (this.config.maxRadius - this.config.minRadius);

      const bubble = new Bubble({
        x: worldPos.x,
        y: worldPos.y,
        z: worldPos.z,
        radius,
        config: this.config,
        paletteIndex: this.paletteCounter++
      });

      // Ambient bubbles already have faded in
      bubble.alpha = bubble.maxAlpha;
      bubble.update(0.01, width, height, this.camera);
      this.bubbles.push(bubble);
    }
  }

  /**
   * Register pointer press
   * @param {number} pointerId
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @returns {boolean} True if a bubble was clicked and popped
   */
  onPointerDown(pointerId, x, y) {
    // 1. Check if an existing bubble was tapped/clicked
    // Search front-to-back (nearest z first) for intuitive interaction
    const sortedForHit = [...this.bubbles].sort((a, b) => a.z - b.z);
    for (const b of sortedForHit) {
      if (b.containsPoint(x, y)) {
        this.popBubble(b);
        return true; // Popped a bubble
      }
    }

    // 2. Start continuous streaming
    this.activePointers.set(pointerId, {
      x,
      y,
      prevX: x,
      prevY: y,
      vx: 0,
      vy: 0,
      accumulator: 1.0 // Trigger immediate first bubble on touch/click
    });

    return false;
  }

  /**
   * Register pointer movement
   * @param {number} pointerId
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @param {number} [buttons=0] - Active pointer buttons mask
   * @param {number} [width=0] - Viewport width
   * @param {number} [height=0] - Viewport height
   */
  onPointerMove(pointerId, x, y, buttons = 0, width = 0, height = 0) {
    // If no button is pressed and no active stream, tilt camera
    if (buttons === 0 && this.activePointers.size === 0 && this.camera && width > 0 && height > 0) {
      this.camera.setTargetFromPointer(x, y, width, height);
    }

    const ptr = this.activePointers.get(pointerId);
    if (!ptr) return;

    // Smooth velocity estimation
    ptr.vx = (x - ptr.prevX) * 0.4 + ptr.vx * 0.6;
    ptr.vy = (y - ptr.prevY) * 0.4 + ptr.vy * 0.6;
    ptr.prevX = ptr.x;
    ptr.prevY = ptr.y;
    ptr.x = x;
    ptr.y = y;
  }

  /**
   * Set target camera rotation from pointer offset
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   */
  setCameraTargetFromPointer(x, y, width, height) {
    if (this.camera) {
      this.camera.setTargetFromPointer(x, y, width, height);
    }
  }

  /**
   * Reset target camera rotation to neutral center
   */
  resetCameraTarget() {
    if (this.camera) {
      this.camera.resetTarget();
    }
  }

  /**
   * Register pointer release / cancellation
   * @param {number} pointerId
   */
  onPointerUp(pointerId) {
    this.activePointers.delete(pointerId);
  }

  /**
   * Pop an individual bubble with burst effect and sound
   * @param {Bubble} bubble
   */
  popBubble(bubble) {
    bubble.alive = false;
    const palette = this.renderer.currentTheme.bubbleGradients[
      bubble.paletteIndex % this.renderer.currentTheme.bubbleGradients.length
    ];

    this.renderer.triggerBurst(
      bubble.projectedX,
      bubble.projectedY,
      bubble.projectedRadius,
      palette
    );

    this.audio.playPop(bubble.radius);
  }

  /**
   * Pop all bubbles on screen (useful for UI button / reset)
   */
  popAll() {
    for (const b of this.bubbles) {
      if (b.alive) {
        this.popBubble(b);
      }
    }
  }

  /**
   * Update all bubbles, spawn ambient bubbles, and stream pointer bubbles
   * @param {number} dt - Time delta in seconds
   * @param {number} width - Screen width
   * @param {number} height - Screen height
   */
  update(dt, width, height) {
    // 0. Advance camera orientation interpolation
    if (this.camera) {
      this.camera.update(dt);
    }

    // 1. Process active pointer streams
    this.processPointerStreams(dt, width, height);

    // 2. Ambient background spawner
    this.processAmbientSpawning(dt, width, height);

    // 3. Update active bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const bubble = this.bubbles[i];
      bubble.update(dt, width, height, this.camera);

      if (!bubble.alive) {
        // Natural pop if at surface
        if (bubble.projectedY + bubble.projectedRadius < 0 && bubble.alpha > 0.4) {
          const palette = this.renderer.currentTheme.bubbleGradients[
            bubble.paletteIndex % this.renderer.currentTheme.bubbleGradients.length
          ];
          this.renderer.triggerBurst(
            bubble.projectedX,
            Math.max(0, bubble.projectedY),
            bubble.projectedRadius,
            palette
          );
        }
        this.bubbles.splice(i, 1);
      }
    }

    // 4. Enforce max bubble capacity if needed
    if (this.bubbles.length > this.config.maxBubbles) {
      // Remove deepest bubbles in camera space
      this.bubbles.sort((a, b) => (b.cameraZ !== undefined ? b.cameraZ : b.z) - (a.cameraZ !== undefined ? a.cameraZ : a.z));
      this.bubbles.splice(this.config.maxBubbles);
    }
  }

  processPointerStreams(dt, width, height) {
    const streamInterval = 1 / this.config.streamRate;

    for (const [pointerId, ptr] of this.activePointers) {
      ptr.accumulator += dt;

      while (ptr.accumulator >= streamInterval) {
        ptr.accumulator -= streamInterval;

        if (this.bubbles.length >= this.config.maxBubbles) break;

        // Unproject pointer position to 3D world space at near plane z0
        const z0 = this.config.spawnZMin + Math.random() * 25;
        const fl = this.config.focalLength;

        let spawnPos;
        if (this.camera) {
          spawnPos = this.camera.unproject(ptr.x, ptr.y, z0, width, height, fl);
        } else {
          const scale = fl / (fl + z0);
          spawnPos = {
            x: (ptr.x - width * 0.5) / scale,
            y: (height * 0.5 - ptr.y) / scale,
            z: z0
          };
        }

        // Random radius from stream range
        const radius = this.config.streamMinRadius + Math.random() * (this.config.streamMaxRadius - this.config.streamMinRadius);

        // Direction perpendicular to the camera plane (forward normal)
        const normal = this.camera ? this.camera.forward : { x: 0, y: 0, z: 1 };
        const right = this.camera ? this.camera.right : { x: 1, y: 0, z: 0 };
        const up = this.camera ? this.camera.up : { x: 0, y: 1, z: 0 };

        // Speed into scene along camera normal
        const zVariance = (Math.random() * 2 - 1) * this.config.zSpeedVariance;
        const forwardSpeed = this.config.baseZVelocity * (1 + zVariance);

        // Radial burst velocity jitter around pointer in camera plane
        const scatterAngle = Math.random() * Math.PI * 2;
        const scatterSpeed = (Math.random() * 0.8 + 0.2) * this.config.streamScatterVelocity;

        // Momentum from pointer dragging
        const dragVx = ptr.vx * 0.6;
        const dragVy = -ptr.vy * 0.6; // Invert because screen Y is down, camera Y is up

        const camVx = Math.cos(scatterAngle) * scatterSpeed + dragVx;
        const camVy = Math.sin(scatterAngle) * scatterSpeed * 0.5 + dragVy;

        // World velocity components: normal emission + camera-plane scatter
        const vx = forwardSpeed * normal.x + camVx * right.x + camVy * up.x;
        const vy = forwardSpeed * normal.y + camVx * right.y + camVy * up.y;
        const vz = forwardSpeed * normal.z + camVx * right.z + camVy * up.z;

        const bubble = new Bubble({
          x: spawnPos.x,
          y: spawnPos.y,
          z: spawnPos.z,
          radius,
          config: this.config,
          vx,
          vy,
          vz,
          isStreamed: true,
          paletteIndex: this.paletteCounter++
        });

        // Initialize projection immediately
        bubble.update(0.001, width, height, this.camera);
        this.bubbles.push(bubble);

        this.audio.playStreamBlip(radius);
      }
    }
  }

  processAmbientSpawning(dt, width, height) {
    if (this.bubbles.length >= this.config.maxBubbles) return;

    this.ambientAccumulator += dt;
    const interval = 1 / this.config.ambientSpawnRate;

    while (this.ambientAccumulator >= interval) {
      this.ambientAccumulator -= interval;

      const z = this.config.spawnZMin + Math.random() * (this.config.maxDepth * 0.6);
      const fl = this.config.focalLength;

      // Spawn below screen bottom in world space
      const screenX = Math.random() * width;
      const screenY = height + 40;

      const worldPos = this.camera
        ? this.camera.unproject(screenX, screenY, z, width, height, fl)
        : {
            x: (screenX - width * 0.5) / (fl / (fl + z)),
            y: (height * 0.5 - screenY) / (fl / (fl + z)),
            z
          };

      const radius = this.config.minRadius + Math.random() * (this.config.maxRadius - this.config.minRadius);

      const normal = this.camera ? this.camera.forward : { x: 0, y: 0, z: 1 };
      const zVariance = (Math.random() * 2 - 1) * this.config.zSpeedVariance;
      const forwardSpeed = this.config.baseZVelocity * (1 + zVariance);

      const vx = forwardSpeed * normal.x;
      const vy = forwardSpeed * normal.y;
      const vz = forwardSpeed * normal.z;

      const bubble = new Bubble({
        x: worldPos.x,
        y: worldPos.y,
        z: worldPos.z,
        radius,
        config: this.config,
        vx,
        vy,
        vz,
        paletteIndex: this.paletteCounter++
      });

      this.bubbles.push(bubble);
    }
  }
}
