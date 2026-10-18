/**
 * Translucidity Configuration and Presets
 */

export const THEMES = {
  iridescent: {
    name: 'Iridescent Soap',
    background: ['#060814', '#0d1329', '#141a38'],
    bubbleGradients: [
      { rim: 'rgba(180, 220, 255, 0.75)', mid: 'rgba(255, 175, 225, 0.25)', core: 'rgba(130, 255, 230, 0.12)' },
      { rim: 'rgba(210, 190, 255, 0.80)', mid: 'rgba(160, 230, 255, 0.30)', core: 'rgba(255, 220, 180, 0.14)' },
      { rim: 'rgba(160, 255, 240, 0.75)', mid: 'rgba(215, 170, 255, 0.28)', core: 'rgba(170, 200, 255, 0.15)' }
    ],
    highlightColor: 'rgba(255, 255, 255, 0.95)',
    secondaryHighlight: 'rgba(180, 230, 255, 0.55)',
    particleColor: 'rgba(210, 235, 255, 0.85)'
  },
  oceanic: {
    name: 'Deep Oceanic',
    background: ['#020b18', '#051930', '#0a2a4a'],
    bubbleGradients: [
      { rim: 'rgba(120, 220, 255, 0.80)', mid: 'rgba(40, 160, 220, 0.25)', core: 'rgba(20, 210, 190, 0.12)' },
      { rim: 'rgba(80, 240, 220, 0.75)', mid: 'rgba(20, 180, 200, 0.30)', core: 'rgba(40, 130, 230, 0.14)' },
      { rim: 'rgba(150, 210, 255, 0.70)', mid: 'rgba(60, 140, 210, 0.22)', core: 'rgba(100, 230, 255, 0.10)' }
    ],
    highlightColor: 'rgba(230, 250, 255, 0.92)',
    secondaryHighlight: 'rgba(80, 200, 255, 0.60)',
    particleColor: 'rgba(140, 230, 255, 0.85)'
  },
  bioluminescent: {
    name: 'Bioluminescent',
    background: ['#020509', '#05131a', '#06222b'],
    bubbleGradients: [
      { rim: 'rgba(50, 255, 180, 0.85)', mid: 'rgba(0, 210, 255, 0.35)', core: 'rgba(80, 255, 120, 0.15)' },
      { rim: 'rgba(0, 240, 255, 0.85)', mid: 'rgba(150, 70, 255, 0.35)', core: 'rgba(0, 255, 200, 0.16)' },
      { rim: 'rgba(180, 255, 80, 0.80)', mid: 'rgba(0, 230, 200, 0.30)', core: 'rgba(60, 255, 240, 0.15)' }
    ],
    highlightColor: 'rgba(220, 255, 245, 0.95)',
    secondaryHighlight: 'rgba(0, 255, 200, 0.70)',
    particleColor: 'rgba(100, 255, 210, 0.90)'
  },
  sunset: {
    name: 'Sunset Opal',
    background: ['#120816', '#220e26', '#3b1636'],
    bubbleGradients: [
      { rim: 'rgba(255, 190, 150, 0.85)', mid: 'rgba(255, 110, 160, 0.30)', core: 'rgba(255, 210, 120, 0.16)' },
      { rim: 'rgba(255, 140, 180, 0.80)', mid: 'rgba(190, 110, 240, 0.32)', core: 'rgba(255, 180, 130, 0.15)' },
      { rim: 'rgba(255, 215, 130, 0.80)', mid: 'rgba(255, 130, 130, 0.28)', core: 'rgba(220, 130, 230, 0.14)' }
    ],
    highlightColor: 'rgba(255, 250, 240, 0.95)',
    secondaryHighlight: 'rgba(255, 180, 160, 0.65)',
    particleColor: 'rgba(255, 210, 180, 0.85)'
  },
  monochrome: {
    name: 'Crystal Glass',
    background: ['#09090c', '#13141a', '#1e2029'],
    bubbleGradients: [
      { rim: 'rgba(235, 240, 255, 0.80)', mid: 'rgba(200, 215, 240, 0.20)', core: 'rgba(255, 255, 255, 0.08)' },
      { rim: 'rgba(215, 225, 245, 0.75)', mid: 'rgba(180, 195, 220, 0.22)', core: 'rgba(220, 230, 255, 0.10)' }
    ],
    highlightColor: 'rgba(255, 255, 255, 0.98)',
    secondaryHighlight: 'rgba(200, 220, 255, 0.50)',
    particleColor: 'rgba(240, 245, 255, 0.80)'
  }
};

export const DEFAULT_CONFIG = {
  // Perspective projection & Camera
  focalLength: 550,          // Camera focal distance
  cameraZ: 0,                // Camera z position
  cameraMaxYaw: 0.45,        // Max rotation around Y-axis in radians (~25.8°)
  cameraMaxPitch: 0.30,      // Max rotation around X-axis in radians (~17.2°)
  cameraDamping: 8.0,        // Damping factor for smooth pointer tilt tracking
  cameraTiltEnabled: true,   // Interactive tilt on hover / two-finger drag
  cameraReturnOnLeave: true, // Smoothly return to center when pointer leaves canvas

  // Bubble size range (world units)
  minRadius: 10,
  maxRadius: 42,
  refRadius: 20,             // Reference radius for buoyancy scaling

  // Motion & Physics
  baseBuoyancy: 75,          // Base upward velocity in world units/sec
  buoyancyExponent: 0.68,    // v_y = baseBuoyancy * (r / refRadius)^exponent
  baseZVelocity: 110,        // Speed moving away from camera into the scene (z+)
  zSpeedVariance: 0.35,      // Random variance factor for z velocity
  horizontalDrift: 18,       // Base random drift speed
  wobbleSpeed: 2.6,          // Harmonic oscillation frequency (rad/sec)
  wobbleAmplitude: 0.10,     // Surface tension deformation fraction

  // Lifecycle
  maxDepth: 1600,            // Z distance where bubbles dissolve into depth fog
  spawnZMin: 20,             // Near plane spawn depth
  spawnZMax: 200,            // Ambient spawn depth start
  fadeDepthStart: 1100,      // Depth at which alpha fade begins

  // Pointer Streamer
  streamRate: 50,            // Bubbles per second while pointer is down
  streamBurstSize: 1,        // Number of bubbles per emit tick
  streamMinRadius: 8,
  streamMaxRadius: 36,
  streamScatterVelocity: 45, // Radial kick speed on spawn

  // Global limits
  maxBubbles: 650,
  ambientSpawnRate: 7,       // Ambient background bubbles per second

  // Theme & Audio
  theme: 'iridescent',
  soundEnabled: true
};
