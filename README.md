# Translucidity (3D Interactive Bubble Simulation)

An interactive, high-performance web animation featuring physics-based translucent bubbles floating in 3D space.

## Features

- **Size-Dependent Buoyancy**:
  In fluid mechanics, larger bubbles have a higher volume-to-surface-area ratio, experiencing significantly stronger net buoyancy relative to viscous drag. Translucidity models this via non-linear power-law scaling ($v_y = v_{base} \cdot (r / r_{ref})^{0.68}$), causing larger bubbles to gracefully outpace smaller micro-bubbles.
- **3D Depth Drift & Perspective Projection**:
  Bubbles continuously drift away from the camera along the $+z$ axis. Perspective projection calculates apparent screen coordinates and radii ($R_{screen} = r \cdot \frac{f}{f + z}$), causing them to shrink and soften into atmospheric depth fog as they recede into the distance.
- **Interactive Pointer Streaming**:
  Clicking and holding the mouse or touching and dragging on mobile devices continuously streams newly spawned bubbles from the pointer's location. Streamed bubbles inherit pointer momentum and immediately integrate into the ambient simulation with identical physics and rendering.
- **Surface Tension Wobble & Fluid Deformation**:
  Bubbles oscillate horizontally and vertically with harmonic phase shifts, slightly flattening into oblate spheroids as they rise faster.
- **Procedural Shading & Aesthetics**:
  Multi-layer procedural rendering with iridescent rim glow, dual specular highlights (directional light glint + ambient bounce reflection), and dynamic color themes (*Iridescent Soap*, *Deep Oceanic*, *Bioluminescent*, *Sunset Opal*, *Crystal Glass*).
- **Procedural Web Audio API Synthesizer**:
  Generates pitch-accurate bubble pop and droplet sounds without any external audio assets. Pitch modulates dynamically based on bubble diameter.
- **Zero External Dependencies**:
  Built with pure modern Vanilla HTML5 Canvas 2D + ES Modules. Instant loading, 60–120 FPS performance, and full offline capability.

---

## Quick Start

### Option 1: Open Directly
Double-click [index.html](index.html) or open it directly in any modern web browser (Chrome, Safari, Firefox, Edge).

### Option 2: Local HTTP Server
Run the built-in zero-dependency Node static server:
```bash
npm start
```
Then navigate to `http://localhost:3000`.

---

## Running Automated Tests

Run the test suite using Node.js's native test runner:
```bash
npm test
```

Tests cover:
- Non-linear size-dependent buoyancy velocity scaling.
- Z-axis depth motion and perspective screen shrinkage.
- Multi-pointer streaming ingestion and lifecycle integration.
- Boundary ceiling and depth expiration.
- Pointer hit detection for bubble popping.

---

## Controls & Shortcuts

| Action | Control |
| :--- | :--- |
| **Stream Bubbles** | Click & hold (Mouse) or Touch & drag (Mobile) |
| **Pop Bubble** | Click or tap directly on any floating bubble |
| **Pause / Resume** | Spacebar or **Pause** button in HUD |
| **Pop All Bubbles** | `C` key or **💥 Pop All** button |
| **Toggle Controls HUD** | `H` key or **✕ Close** / **⚙ Controls** button |
| **Toggle Sound** | **🔊 Sound** button |
| **Tweak Physics** | Adjust Buoyancy, Z-Speed, or Stream Rate sliders in HUD |

---

## Architecture

```
translucidity/
├── index.html                 # Semantic HTML with canvas and glassmorphic HUD
├── style.css                  # Modern CSS (glassmorphism, touch-action, responsive layout)
├── package.json               # Scripts (test, start)
├── server.js                  # Lightweight zero-dependency static server
├── src/
│   ├── config.js              # Simulation constants, physics tunings, color palettes & presets
│   ├── bubble.js              # 3D bubble entity (physics, wobble, projection, lifecycle)
│   ├── bubble-system.js       # Bubble manager, ambient spawner, pointer stream integration, pop system
│   ├── renderer.js            # Canvas 2D rendering pipeline (iridescence, specular curves, depth haze)
│   ├── audio.js               # Web Audio API procedural sound synthesizer (soft pops & droplets)
│   └── main.js                # App bootstrap, animation loop, resize observer, event binding
└── test/
    ├── bubble-physics.test.js # Physics, buoyancy, depth, and projection unit tests
    └── bubble-system.test.js  # Stream integration and lifecycle unit tests
```
