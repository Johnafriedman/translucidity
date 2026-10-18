/**
 * Canvas 2D Rendering Engine
 * Implements 3D perspective projection, iridescent procedural bubble shading,
 * depth fog attenuation, and bursting particle effects.
 */

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} config
   */
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;
    this.currentTheme = null;

    // Ambient floating dust particles to give deep spatial depth cues
    this.ambientParticles = [];
    this.initAmbientParticles(60);

    // Burst effects
    this.bursts = [];
  }

  setTheme(theme) {
    this.currentTheme = theme;
  }

  initAmbientParticles(count) {
    this.ambientParticles = [];
    for (let i = 0; i < count; i++) {
      this.ambientParticles.push({
        x: (Math.random() - 0.5) * 2200,
        y: (Math.random() - 0.5) * 1600,
        z: Math.random() * this.config.maxDepth,
        radius: 0.8 + Math.random() * 1.5,
        speedY: 8 + Math.random() * 12,
        speedZ: 25 + Math.random() * 45,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  /**
   * Add a bubble burst animation
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @param {number} radius - Screen radius
   * @param {Object} palette
   */
  triggerBurst(x, y, radius, palette) {
    const particleCount = Math.max(6, Math.min(24, Math.floor(radius * 0.8)));
    const droplets = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.4 - 0.2);
      const speed = (radius * 2.2) * (0.6 + Math.random() * 0.8);
      droplets.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15, // slight upward kick
        radius: Math.max(1, radius * 0.08 * (0.6 + Math.random() * 0.8)),
        alpha: 1
      });
    }

    this.bursts.push({
      x,
      y,
      ringRadius: radius * 0.8,
      maxRingRadius: radius * 1.6,
      ringAlpha: 0.9,
      droplets,
      palette,
      age: 0,
      duration: 0.38
    });
  }

  /**
   * Main render call
   * @param {Bubble[]} bubbles
   * @param {number} dt
   * @param {import('./camera.js').Camera} [camera=null]
   */
  render(bubbles, dt, camera = null) {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // 1. Draw background gradient with subtle camera parallax
    this.drawBackground(width, height, camera);

    // 2. Draw ambient depth motes projected through camera
    this.updateAndDrawAmbientParticles(dt, width, height, camera);

    // 3. Sort bubbles by depth in camera space (furthest drawn first)
    // Painter's algorithm ensures correct occlusion
    bubbles.sort((a, b) => (b.cameraZ !== undefined ? b.cameraZ : b.z) - (a.cameraZ !== undefined ? a.cameraZ : a.z));

    // 4. Render each bubble
    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      if (!bubble.alive) continue;
      this.drawBubble(bubble);
    }

    // 5. Update and render burst effects
    this.updateAndDrawBursts(dt);
  }

  drawBackground(width, height, camera = null) {
    const ctx = this.ctx;
    const colors = this.currentTheme.background;

    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, colors[0]);
    bgGradient.addColorStop(0.55, colors[1]);
    bgGradient.addColorStop(1, colors[2] || colors[1]);

    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle radial light vignette with camera parallax shift
    const parallaxX = camera ? -camera.yaw * width * 0.22 : 0;
    const parallaxY = camera ? camera.pitch * height * 0.22 : 0;

    const lightGlow = ctx.createRadialGradient(
      width * 0.5 + parallaxX,
      height * 0.35 + parallaxY,
      height * 0.05,
      width * 0.5 + parallaxX * 0.5,
      height * 0.4 + parallaxY * 0.5,
      Math.max(width, height) * 0.85
    );
    lightGlow.addColorStop(0, 'rgba(255, 255, 255, 0.035)');
    lightGlow.addColorStop(0.6, 'rgba(255, 255, 255, 0.005)');
    lightGlow.addColorStop(1, 'rgba(0, 0, 0, 0.45)');

    ctx.fillStyle = lightGlow;
    ctx.fillRect(0, 0, width, height);
  }

  updateAndDrawAmbientParticles(dt, width, height, camera = null) {
    const ctx = this.ctx;
    const fl = this.config.focalLength;
    const halfW = width * 0.5;
    const halfH = height * 0.5;

    ctx.fillStyle = this.currentTheme.particleColor;

    for (const p of this.ambientParticles) {
      // Advance motion
      p.y += p.speedY * dt;
      p.z += p.speedZ * dt;

      // Wrap around bounds
      if (p.z > this.config.maxDepth) p.z = 20;
      if (p.y > 900) p.y = -900;

      // Transform particle position through camera view
      let camX = p.x;
      let camY = p.y;
      let camZ = p.z;

      if (camera) {
        const camPos = camera.worldToCamera(p.x, p.y, p.z);
        camX = camPos.x;
        camY = camPos.y;
        camZ = camPos.z;
      }

      if (camZ <= 0) continue;

      // Project
      const scale = fl / (fl + camZ);
      const px = halfW + camX * scale;
      const py = halfH - camY * scale;
      const pr = Math.max(0.4, p.radius * scale);

      if (px < 0 || px > width || py < 0 || py > height) continue;

      const alpha = Math.max(0, 0.45 * (1 - camZ / this.config.maxDepth));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  drawBubble(bubble) {
    const ctx = this.ctx;
    const x = bubble.projectedX;
    const y = bubble.projectedY;
    const r = bubble.projectedRadius;

    if (r < 0.6) return;

    const renderAlpha = bubble.getRenderAlpha();
    if (renderAlpha <= 0.01) return;

    const paletteList = this.currentTheme.bubbleGradients;
    const palette = paletteList[bubble.paletteIndex % paletteList.length];

    ctx.save();
    ctx.globalAlpha = renderAlpha;
    ctx.translate(x, y);
    ctx.rotate(bubble.rotation);

    // Apply fluid aspect ratio deformation
    const stretchX = Math.max(0.6, Math.min(1.4, bubble.aspectRatio));
    const stretchY = 1 / stretchX;
    ctx.scale(stretchX, stretchY);

    // 1. Base translucent glass body with soft internal refraction
    const bodyGrad = ctx.createRadialGradient(
      -r * 0.25, -r * 0.25, r * 0.1,
      0, 0, r
    );
    bodyGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    bodyGrad.addColorStop(0.5, palette.core);
    bodyGrad.addColorStop(0.82, palette.mid);
    bodyGrad.addColorStop(1, palette.rim);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 2. Iridescent outer rim stroke
    ctx.lineWidth = Math.max(0.8, r * 0.04);
    ctx.strokeStyle = palette.rim;
    ctx.stroke();

    // 3. Primary specular reflection (crescent glint on top-left)
    const highlightRadiusX = r * 0.42;
    const highlightRadiusY = r * 0.20;
    const highlightX = -r * 0.38;
    const highlightY = -r * 0.42;

    ctx.save();
    ctx.translate(highlightX, highlightY);
    ctx.rotate(-Math.PI * 0.22);

    const primaryGlint = ctx.createRadialGradient(
      0, 0, 0,
      0, 0, highlightRadiusX
    );
    primaryGlint.addColorStop(0, this.currentTheme.highlightColor);
    primaryGlint.addColorStop(0.4, 'rgba(255, 255, 255, 0.85)');
    primaryGlint.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.ellipse(0, 0, highlightRadiusX, highlightRadiusY, 0, 0, Math.PI * 2);
    ctx.fillStyle = primaryGlint;
    ctx.fill();
    ctx.restore();

    // 4. Secondary specular reflection (soft environmental bounce on bottom-right)
    const bounceRadius = r * 0.26;
    const bounceX = r * 0.34;
    const bounceY = r * 0.36;

    const secondaryGlint = ctx.createRadialGradient(
      bounceX, bounceY, 0,
      bounceX, bounceY, bounceRadius
    );
    secondaryGlint.addColorStop(0, this.currentTheme.secondaryHighlight);
    secondaryGlint.addColorStop(0.7, 'rgba(255, 255, 255, 0.25)');
    secondaryGlint.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(bounceX, bounceY, bounceRadius, 0, Math.PI * 2);
    ctx.fillStyle = secondaryGlint;
    ctx.fill();

    // 5. Thin refractive sheen arc near bottom rim
    if (r > 12) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, Math.PI * 0.2, Math.PI * 0.8);
      ctx.lineWidth = Math.max(0.6, r * 0.035);
      ctx.strokeStyle = palette.mid;
      ctx.stroke();
    }

    ctx.restore();
  }

  updateAndDrawBursts(dt) {
    const ctx = this.ctx;

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.age += dt;
      const progress = burst.age / burst.duration;

      if (progress >= 1) {
        this.bursts.splice(i, 1);
        continue;
      }

      const easeOut = 1 - Math.pow(1 - progress, 2);

      // Expanding pop ring
      const currentRingRadius = burst.ringRadius + (burst.maxRingRadius - burst.ringRadius) * easeOut;
      const currentRingAlpha = burst.ringAlpha * (1 - progress);

      ctx.save();
      ctx.globalAlpha = currentRingAlpha;
      ctx.lineWidth = Math.max(1, 2.5 * (1 - progress));
      ctx.strokeStyle = burst.palette?.rim || this.currentTheme.highlightColor;

      ctx.beginPath();
      ctx.arc(burst.x, burst.y, currentRingRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Droplets
      for (const d of burst.droplets) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vy += 80 * dt; // gravity on droplet
        d.alpha = Math.max(0, 1 - progress * 1.2);

        ctx.globalAlpha = d.alpha;
        ctx.fillStyle = burst.palette?.rim || this.currentTheme.highlightColor;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
