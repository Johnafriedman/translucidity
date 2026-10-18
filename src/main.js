/**
 * Application Entry Point
 * Orchestrates canvas lifecycle, high-DPI scaling, animation loop,
 * pointer event delegation, and UI controls.
 */

import { DEFAULT_CONFIG, THEMES } from './config.js';
import { Renderer } from './renderer.js';
import { AudioManager } from './audio.js';
import { BubbleSystem } from './bubble-system.js';

class App {
  constructor() {
    this.canvas = document.getElementById('bubble-canvas');
    this.config = { ...DEFAULT_CONFIG };

    this.renderer = new Renderer(this.canvas, this.config);
    this.audio = new AudioManager();
    this.system = new BubbleSystem({
      config: this.config,
      renderer: this.renderer,
      audio: this.audio
    });

    this.isPaused = false;
    this.lastTime = performance.now();
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();

    this.init();
  }

  init() {
    // 1. Set initial theme
    this.setTheme(this.config.theme);

    // 2. Setup high-DPI canvas & responsive resizing
    this.setupCanvas();

    // 3. Pre-populate ambient bubbles
    this.system.populateInitial(40, this.canvas.width, this.canvas.height);

    // 4. Attach pointer & touch interactions
    this.bindPointerEvents();

    // 5. Attach HUD UI controls
    this.bindUI();

    // 6. Attach keyboard shortcuts
    this.bindKeyboard();

    // 7. Start render loop
    requestAnimationFrame((t) => this.loop(t));
  }

  setupCanvas() {
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;

      if (this.canvas.width !== displayWidth * dpr || this.canvas.height !== displayHeight * dpr) {
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.canvas.style.width = `${displayWidth}px`;
        this.canvas.style.height = `${displayHeight}px`;

        // Scale context so internal drawings use standard CSS pixel coordinates
        this.renderer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    window.addEventListener('resize', resize, { passive: true });
    resize();

    // Store logical CSS pixel dimensions for simulation
    this.getLogicalWidth = () => window.innerWidth;
    this.getLogicalHeight = () => window.innerHeight;
  }

  setTheme(themeKey) {
    const theme = THEMES[themeKey] || THEMES.iridescent;
    this.config.theme = themeKey;
    this.renderer.setTheme(theme);

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect && themeSelect.value !== themeKey) {
      themeSelect.value = themeKey;
    }
  }

  bindPointerEvents() {
    const canvas = this.canvas;
    const touchPointers = new Map();

    // Apply touch-action: none so touch dragging doesn't trigger scroll/pinch
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', (e) => {
      // Unlock audio on first interaction
      this.audio.init();

      if (e.button !== 0 && e.pointerType === 'mouse') return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const width = this.getLogicalWidth();
      const height = this.getLogicalHeight();

      // Multi-touch handling: 2 fingers tilt camera; 1 finger streams/pops
      if (e.pointerType === 'touch') {
        touchPointers.set(e.pointerId, { x, y });
        if (touchPointers.size >= 2) {
          // Release streaming for touches when entering 2-finger tilt mode
          for (const id of touchPointers.keys()) {
            this.system.onPointerUp(id);
          }
          const pts = Array.from(touchPointers.values());
          const cx = (pts[0].x + pts[1].x) * 0.5;
          const cy = (pts[0].y + pts[1].y) * 0.5;
          this.system.setCameraTargetFromPointer(cx, cy, width, height);
          return;
        }
      }

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        // Fallback if setPointerCapture is unsupported
      }

      this.system.onPointerDown(e.pointerId, x, y);
    });

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const width = this.getLogicalWidth();
      const height = this.getLogicalHeight();

      if (e.pointerType === 'touch') {
        if (touchPointers.has(e.pointerId)) {
          touchPointers.set(e.pointerId, { x, y });
        }
        if (touchPointers.size >= 2) {
          const pts = Array.from(touchPointers.values());
          const cx = (pts[0].x + pts[1].x) * 0.5;
          const cy = (pts[0].y + pts[1].y) * 0.5;
          this.system.setCameraTargetFromPointer(cx, cy, width, height);
          return;
        }
      } else {
        // Mouse or Stylus/Pen hover without button down: tilt camera
        if (e.buttons === 0) {
          this.system.setCameraTargetFromPointer(x, y, width, height);
        }
      }

      this.system.onPointerMove(e.pointerId, x, y, e.buttons, width, height);
    });

    const releasePointer = (e) => {
      if (e.pointerType === 'touch') {
        touchPointers.delete(e.pointerId);
      }
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
      this.system.onPointerUp(e.pointerId);
    };

    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);
    canvas.addEventListener('lostpointercapture', releasePointer);

    canvas.addEventListener('pointerleave', () => {
      if (this.config.cameraReturnOnLeave) {
        this.system.resetCameraTarget();
      }
    });

    window.addEventListener('blur', () => {
      if (this.config.cameraReturnOnLeave) {
        this.system.resetCameraTarget();
      }
    });
  }

  bindUI() {
    // Sliders
    const buoyancySlider = document.getElementById('buoyancy-slider');
    const buoyancyVal = document.getElementById('buoyancy-val');
    if (buoyancySlider) {
      buoyancySlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.config.baseBuoyancy = val;
        if (buoyancyVal) buoyancyVal.textContent = `${Math.round(val)}`;
        // Update existing bubbles
        for (const b of this.system.bubbles) {
          const ratio = b.radius / this.config.refRadius;
          b.baseVy = val * Math.pow(ratio, this.config.buoyancyExponent);
        }
      });
    }

    const depthSpeedSlider = document.getElementById('depth-speed-slider');
    const depthSpeedVal = document.getElementById('depth-speed-val');
    if (depthSpeedSlider) {
      depthSpeedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.config.baseZVelocity = val;
        if (depthSpeedVal) depthSpeedVal.textContent = `${Math.round(val)}`;
        for (const b of this.system.bubbles) {
          b.vz = val * (1 + (Math.random() * 2 - 1) * this.config.zSpeedVariance);
        }
      });
    }

    const streamRateSlider = document.getElementById('stream-rate-slider');
    const streamRateVal = document.getElementById('stream-rate-val');
    if (streamRateSlider) {
      streamRateSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.config.streamRate = val;
        if (streamRateVal) streamRateVal.textContent = `${Math.round(val)}`;
      });
    }

    // Camera Tilt Slider
    const cameraTiltSlider = document.getElementById('camera-tilt-slider');
    const cameraTiltVal = document.getElementById('camera-tilt-val');
    if (cameraTiltSlider) {
      cameraTiltSlider.addEventListener('input', (e) => {
        const deg = parseFloat(e.target.value);
        const rad = (deg * Math.PI) / 180;
        this.config.cameraMaxYaw = rad;
        this.config.cameraMaxPitch = rad * 0.67;
        if (this.system.camera) {
          this.system.camera.maxYaw = this.config.cameraMaxYaw;
          this.system.camera.maxPitch = this.config.cameraMaxPitch;
        }
        if (cameraTiltVal) cameraTiltVal.textContent = `${Math.round(deg)}°`;
      });
    }

    // Camera Tilt Toggle
    const cameraTiltBtn = document.getElementById('camera-tilt-btn');
    if (cameraTiltBtn) {
      cameraTiltBtn.addEventListener('click', () => {
        this.config.cameraTiltEnabled = !this.config.cameraTiltEnabled;
        if (this.system.camera) {
          this.system.camera.enabled = this.config.cameraTiltEnabled;
          if (!this.config.cameraTiltEnabled) {
            this.system.camera.resetTarget();
          }
        }
        cameraTiltBtn.textContent = this.config.cameraTiltEnabled ? '🎥 Tilt: On' : '🎥 Tilt: Off';
        cameraTiltBtn.classList.toggle('muted', !this.config.cameraTiltEnabled);
      });
    }

    // Reset Camera Button
    const resetCameraBtn = document.getElementById('reset-camera-btn');
    if (resetCameraBtn) {
      resetCameraBtn.addEventListener('click', () => {
        if (this.system.camera) {
          this.system.camera.snapToNeutral();
        }
      });
    }

    // Theme selector
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.setTheme(e.target.value);
      });
    }

    // Sound toggle button
    const soundBtn = document.getElementById('sound-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const unmuted = this.audio.toggleMute();
        soundBtn.textContent = unmuted ? '🔊 Sound: On' : '🔇 Sound: Off';
        soundBtn.classList.toggle('muted', !unmuted);
      });
    }

    // Pop all button
    const popAllBtn = document.getElementById('pop-all-btn');
    if (popAllBtn) {
      popAllBtn.addEventListener('click', () => {
        this.system.popAll();
      });
    }

    // Pause button
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.isPaused = !this.isPaused;
        pauseBtn.textContent = this.isPaused ? '▶ Resume' : '⏸ Pause';
      });
    }

    // HUD toggle
    const toggleHudBtn = document.getElementById('toggle-hud-btn');
    const hudElement = document.getElementById('hud');
    if (toggleHudBtn && hudElement) {
      toggleHudBtn.addEventListener('click', () => {
        const isCollapsed = hudElement.classList.toggle('collapsed');
        toggleHudBtn.textContent = isCollapsed ? '⚙ Controls' : '✕ Close';
      });
    }
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) pauseBtn.textContent = this.isPaused ? '▶ Resume' : '⏸ Pause';
      } else if (e.key === 'c' || e.key === 'C') {
        this.system.popAll();
      } else if (e.key === 'r' || e.key === 'R') {
        if (this.system.camera) {
          this.system.camera.snapToNeutral();
        }
      } else if (e.key === 'h' || e.key === 'H') {
        const hudElement = document.getElementById('hud');
        const toggleHudBtn = document.getElementById('toggle-hud-btn');
        if (hudElement) {
          const isCollapsed = hudElement.classList.toggle('collapsed');
          if (toggleHudBtn) toggleHudBtn.textContent = isCollapsed ? '⚙ Controls' : '✕ Close';
        }
      }
    });
  }

  loop(currentTime) {
    requestAnimationFrame((t) => this.loop(t));

    // Clamp dt to prevent massive simulation jumps when tab returns from background
    const dt = Math.min(0.08, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // Track FPS
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;

      const bubbleCountEl = document.getElementById('bubble-count');
      const fpsEl = document.getElementById('fps-count');
      if (bubbleCountEl) bubbleCountEl.textContent = `${this.system.bubbles.length}`;
      if (fpsEl) fpsEl.textContent = `${this.fps}`;
    }

    const width = this.getLogicalWidth();
    const height = this.getLogicalHeight();

    if (!this.isPaused) {
      this.system.update(dt, width, height);
    }

    this.renderer.render(this.system.bubbles, dt, this.system.camera);
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.__app = new App();
});
