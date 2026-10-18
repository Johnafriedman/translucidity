/**
 * Bubble Entity
 * Represents an individual 3D bubble with physics-based buoyancy,
 * depth drift away from camera, surface tension oscillation, and perspective projection.
 */

export class Bubble {
  /**
   * @param {Object} options
   * @param {number} options.x - World X (0 is screen center)
   * @param {number} options.y - World Y (up is positive)
   * @param {number} options.z - World Z (depth away from camera, positive is deeper)
   * @param {number} options.radius - Intrinsic radius in world units
   * @param {Object} options.config - Simulation configuration
   * @param {number} [options.vx=0] - Initial X velocity
   * @param {number} [options.vy=0] - Additional Y velocity kick
   * @param {number} [options.vz] - Custom Z velocity
   * @param {boolean} [options.isStreamed=false] - True if emitted from user pointer
   * @param {number} [options.paletteIndex=0] - Color gradient index
   */
  constructor(options) {
    const {
      x,
      y,
      z = 20,
      radius,
      config,
      vx = 0,
      vy = 0,
      vz,
      isStreamed = false,
      paletteIndex = 0
    } = options;

    this.config = config;
    this.x = x;
    this.y = y;
    this.z = Math.max(0, z);
    this.radius = radius;
    this.initialRadius = radius;
    this.isStreamed = isStreamed;
    this.paletteIndex = paletteIndex;

    // Size-dependent buoyancy: v_y = baseBuoyancy * (r / refRadius)^exponent
    // Larger bubbles have greater volume-to-drag ratio and rise faster.
    const sizeRatio = this.radius / this.config.refRadius;
    const buoyancy = this.config.baseBuoyancy * Math.pow(sizeRatio, this.config.buoyancyExponent);

    this.baseVy = buoyancy;
    this.vy = buoyancy + (vy || 0);

    // Movement away from camera along Z axis (z increases over time)
    const zVariance = (Math.random() * 2 - 1) * this.config.zSpeedVariance;
    this.vz = vz !== undefined ? vz : this.config.baseZVelocity * (1 + zVariance);

    // Lateral velocity
    const driftDrift = (Math.random() * 2 - 1) * this.config.horizontalDrift;
    this.vx = vx !== undefined ? vx : driftDrift;

    // Wobble & oscillation harmonics (surface tension vibration)
    this.wobblePhaseX = Math.random() * Math.PI * 2;
    this.wobblePhaseY = Math.random() * Math.PI * 2;
    this.wobbleFreq = this.config.wobbleSpeed * (0.85 + Math.random() * 0.3) * (this.config.refRadius / this.radius);
    this.wobbleAmp = this.config.wobbleAmplitude * (0.7 + Math.random() * 0.6);

    // Lifecycle
    this.age = 0;
    this.alive = true;
    this.alpha = 0; // Starts at 0 and fades in smoothly
    this.maxAlpha = 0.88 + Math.random() * 0.12;
    this.fadeInRate = isStreamed ? 12 : 3.5; // Fast fade-in for streamed bubbles

    // Screen projected cache (calculated in update)
    this.cameraX = this.x;
    this.cameraY = this.y;
    this.cameraZ = this.z;
    this.projectedX = 0;
    this.projectedY = 0;
    this.projectedRadius = 0;
    this.scale = 1;
    this.aspectRatio = 1; // Oval deformation due to upward motion
    this.rotation = 0;
  }

  /**
   * Update bubble physics for delta time dt (in seconds)
   * @param {number} dt - Time delta in seconds
   * @param {number} screenWidth - Viewport width
   * @param {number} screenHeight - Viewport height
   * @param {import('./camera.js').Camera} [camera=null] - Active 3D camera
   */
  update(dt, screenWidth, screenHeight, camera = null) {
    if (!this.alive) return;

    this.age += dt;

    // Smooth entry fade-in
    if (this.alpha < this.maxAlpha) {
      this.alpha = Math.min(this.maxAlpha, this.alpha + this.fadeInRate * dt);
    }

    // Apply motion in world space
    this.y += this.vy * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // Surface tension wobble (horizontal swaying and shape deformation)
    const wobbleProgressX = this.age * this.wobbleFreq + this.wobblePhaseX;
    const wobbleProgressY = this.age * this.wobbleFreq * 1.3 + this.wobblePhaseY;
    const wobbleOffsetX = Math.sin(wobbleProgressX) * (this.radius * this.wobbleAmp);

    // Shape deformation: bubbles stretch slightly into an oblate spheroid as they rise
    const stretch = Math.sin(wobbleProgressY) * (this.wobbleAmp * 0.6);
    this.aspectRatio = 1 + stretch; // width / height

    // Align bubble elongation with projected world-up direction
    let upAngle = 0;
    if (camera) {
      const upCam = camera.worldToCamera(0, 1, 0);
      upAngle = Math.atan2(upCam.x, upCam.y);
    }
    this.rotation = Math.cos(wobbleProgressX) * 0.15 + upAngle;

    // Calculate 3D perspective projection through camera
    let camX, camY, camZ;
    if (camera) {
      const camPos = camera.worldToCamera(this.x + wobbleOffsetX, this.y, this.z);
      camX = camPos.x;
      camY = camPos.y;
      camZ = camPos.z;
    } else {
      camX = this.x + wobbleOffsetX;
      camY = this.y;
      camZ = this.z;
    }

    this.cameraX = camX;
    this.cameraY = camY;
    this.cameraZ = camZ;

    const fl = this.config.focalLength;
    const effectiveZ = Math.max(-fl * 0.9, camZ);
    this.scale = fl / (fl + effectiveZ);

    const halfW = screenWidth * 0.5;
    const halfH = screenHeight * 0.5;

    // Projected screen coordinates
    this.projectedX = halfW + camX * this.scale;
    this.projectedY = halfH - camY * this.scale; // Upward (+Y) maps to upwards on screen (-Y)
    this.projectedRadius = Math.max(0.5, this.radius * this.scale);

    // Intrinsic gradual radius shrinkage as bubble ages in distance
    const depthVal = camZ !== undefined ? camZ : this.z;
    if (depthVal > this.config.fadeDepthStart) {
      const depthProgress = (depthVal - this.config.fadeDepthStart) / (this.config.maxDepth - this.config.fadeDepthStart);
      this.radius = Math.max(2, this.initialRadius * (1 - depthProgress * 0.45));
    }

    // Check boundary & lifecycle limits:
    // 1. Beyond max depth horizon or behind camera plane
    if (camZ >= this.config.maxDepth || camZ <= -fl * 0.8) {
      this.alive = false;
      return;
    }

    // 2. Beyond ceiling of viewport (with margin)
    const topMargin = 120;
    if (this.projectedY + this.projectedRadius < -topMargin && this.y > 0) {
      this.alive = false;
      return;
    }

    // 3. Off lateral screen edges by wide margin (allowing camera rotation)
    const sideMargin = Math.max(600, screenWidth * 0.6);
    if (
      this.projectedX < -sideMargin ||
      this.projectedX > screenWidth + sideMargin
    ) {
      this.alive = false;
    }
  }

  /**
   * Get rendering opacity accounting for depth fog and fade out
   */
  getRenderAlpha() {
    let depthFactor = 1;
    const depthVal = this.cameraZ !== undefined ? this.cameraZ : this.z;
    if (depthVal > this.config.fadeDepthStart) {
      const depthRange = this.config.maxDepth - this.config.fadeDepthStart;
      depthFactor = Math.max(0, 1 - (depthVal - this.config.fadeDepthStart) / depthRange);
    }
    return this.alpha * depthFactor;
  }

  /**
   * Check if a 2D screen coordinate (e.g. click/tap) hits this bubble
   * @param {number} screenX
   * @param {number} screenY
   * @returns {boolean}
   */
  containsPoint(screenX, screenY) {
    if (!this.alive || this.alpha < 0.2) return false;
    const dx = screenX - this.projectedX;
    const dy = screenY - this.projectedY;
    // Allow slight touch target padding for smaller bubbles
    const hitRadius = Math.max(16, this.projectedRadius * 1.15);
    return dx * dx + dy * dy <= hitRadius * hitRadius;
  }
}
