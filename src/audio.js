/**
 * Web Audio API Sound Synthesizer
 * Generates natural, procedural bubble pop and water droplet sounds
 * without external audio files.
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.isMuted = false;
    this.initialized = false;
    this.masterGain = null;
  }

  /**
   * Initialize AudioContext on first user interaction
   */
  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (err) {
      console.warn('Web Audio API not supported or blocked:', err);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : 0.35,
        this.ctx.currentTime
      );
    }
    return !this.isMuted;
  }

  /**
   * Play a bubble pop/bloop sound tailored to bubble radius
   * @param {number} radius - World or projected radius (affects pitch)
   */
  playPop(radius = 20) {
    if (!this.enabled || this.isMuted) return;
    this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;

    // Smaller bubbles = higher frequency, larger bubbles = deeper pitch
    const clampedRadius = Math.max(6, Math.min(60, radius));
    const baseFreq = 180 + (60 - clampedRadius) * 22; // ~300Hz to 1350Hz

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';

    // Characteristic bubble frequency chirp (quick pitch rise then drop)
    osc.frequency.setValueAtTime(baseFreq * 0.7, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.015);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.09);

    // Amplitude envelope
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Play a soft bubbly stream tick when streaming bubbles
   */
  playStreamBlip(radius = 15) {
    if (!this.enabled || this.isMuted) return;
    this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;

    // Rate-limit stream sounds so audio stays pleasant and not overwhelming
    if (this._lastBlip && Date.now() - this._lastBlip < 60) return;
    this._lastBlip = Date.now();

    const now = this.ctx.currentTime;
    const clampedRadius = Math.max(8, Math.min(45, radius));
    const freq = 450 + (45 - clampedRadius) * 16 + (Math.random() * 80 - 40);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.04);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }
}
