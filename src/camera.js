/**
 * 3D Camera with Yaw/Pitch Rotation, Normal Vector Calculation,
 * and Perspective Projection Transformations.
 */

export class Camera {
  /**
   * @param {Object} [config={}]
   * @param {number} [config.cameraMaxYaw=0.45] - Max yaw in radians (~25.8 deg)
   * @param {number} [config.cameraMaxPitch=0.30] - Max pitch in radians (~17.2 deg)
   * @param {number} [config.cameraDamping=8.0] - Damping factor for smooth orientation tracking
   * @param {boolean} [config.cameraTiltEnabled=true] - Whether tilt interaction is active
   */
  constructor(config = {}) {
    this.config = config;
    this.maxYaw = config.cameraMaxYaw !== undefined ? config.cameraMaxYaw : 0.45;
    this.maxPitch = config.cameraMaxPitch !== undefined ? config.cameraMaxPitch : 0.30;
    this.damping = config.cameraDamping !== undefined ? config.cameraDamping : 8.0;
    this.enabled = config.cameraTiltEnabled !== undefined ? config.cameraTiltEnabled : true;

    // Current Euler angles (radians)
    this.yaw = 0;   // Rotation around Y-axis (left/right)
    this.pitch = 0; // Rotation around X-axis (up/down)

    // Target Euler angles
    this.targetYaw = 0;
    this.targetPitch = 0;

    // Direction vectors in world space
    this.forward = { x: 0, y: 0, z: 1 };
    this.right = { x: 1, y: 0, z: 0 };
    this.up = { x: 0, y: 1, z: 0 };

    // 3x3 Rotation matrix R (camera to world) and its transpose R^T (world to camera)
    // Row-major: [m00, m01, m02, m10, m11, m12, m20, m21, m22]
    this.matrix = new Float32Array(9);
    this.invMatrix = new Float32Array(9);

    this.updateMatrices();
  }

  /**
   * Set target orientation from normalized screen pointer coordinates
   * @param {number} screenX - Pointer screen X
   * @param {number} screenY - Pointer screen Y
   * @param {number} screenWidth - Viewport width
   * @param {number} screenHeight - Viewport height
   */
  setTargetFromPointer(screenX, screenY, screenWidth, screenHeight) {
    if (!this.enabled || screenWidth <= 0 || screenHeight <= 0) return;

    const halfW = screenWidth * 0.5;
    const halfH = screenHeight * 0.5;

    // Normalized offset: [-1, 1] relative to center
    const nx = Math.max(-1, Math.min(1, (screenX - halfW) / halfW));
    const ny = Math.max(-1, Math.min(1, (screenY - halfH) / halfH));

    // Horizontal offset rotates around Y-axis (negative nx tilts left)
    this.targetYaw = nx * this.maxYaw;

    // Vertical offset rotates around X-axis (negative ny tilts up)
    this.targetPitch = ny * this.maxPitch;
  }

  /**
   * Set explicit target angles in radians
   * @param {number} yaw
   * @param {number} pitch
   */
  setTarget(yaw, pitch) {
    if (!this.enabled) return;
    this.targetYaw = Math.max(-this.maxYaw, Math.min(this.maxYaw, yaw));
    this.targetPitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, pitch));
  }

  /**
   * Reset target orientation to neutral center (0, 0)
   */
  resetTarget() {
    this.targetYaw = 0;
    this.targetPitch = 0;
  }

  /**
   * Snap camera instantly to neutral orientation
   */
  snapToNeutral() {
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.updateMatrices();
  }

  /**
   * Advance orientation interpolation towards target
   * @param {number} dt - Time delta in seconds
   */
  update(dt) {
    if (dt <= 0) return;

    // Exponential smoothing: 1 - exp(-k * dt)
    const factor = Math.min(1, 1 - Math.exp(-this.damping * dt));

    this.yaw += (this.targetYaw - this.yaw) * factor;
    this.pitch += (this.targetPitch - this.pitch) * factor;

    // Snap to zero if extremely close
    if (Math.abs(this.yaw) < 0.0001 && Math.abs(this.targetYaw) < 0.0001) this.yaw = 0;
    if (Math.abs(this.pitch) < 0.0001 && Math.abs(this.targetPitch) < 0.0001) this.pitch = 0;

    this.updateMatrices();
  }

  /**
   * Compute rotation matrix R = Ry(yaw) * Rx(pitch) and inverse R^T
   */
  updateMatrices() {
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cx = Math.cos(this.pitch);
    const sx = Math.sin(this.pitch);

    // Composite rotation R = Ry * Rx:
    // [ cy,  sy*sx,  sy*cx ]
    // [  0,     cx,    -sx ]
    // [-sy,  cy*sx,  cy*cx ]
    const m = this.matrix;
    m[0] = cy;
    m[1] = sy * sx;
    m[2] = sy * cx;

    m[3] = 0;
    m[4] = cx;
    m[5] = -sx;

    m[6] = -sy;
    m[7] = cy * sx;
    m[8] = cy * cx;

    // Transpose R^T (world to camera):
    const inv = this.invMatrix;
    inv[0] = m[0]; inv[1] = m[3]; inv[2] = m[6];
    inv[3] = m[1]; inv[4] = m[4]; inv[5] = m[7];
    inv[6] = m[2]; inv[7] = m[5]; inv[8] = m[8];

    // Direction vectors in world space:
    // Forward is normal perpendicular to camera plane: R * (0, 0, 1)^T
    this.forward.x = m[2] === 0 ? 0 : m[2];
    this.forward.y = m[5] === 0 ? 0 : m[5];
    this.forward.z = m[8] === 0 ? 0 : m[8];

    // Right is R * (1, 0, 0)^T
    this.right.x = m[0] === 0 ? 0 : m[0];
    this.right.y = m[3] === 0 ? 0 : m[3];
    this.right.z = m[6] === 0 ? 0 : m[6];

    // Up is R * (0, 1, 0)^T
    this.up.x = m[1] === 0 ? 0 : m[1];
    this.up.y = m[4] === 0 ? 0 : m[4];
    this.up.z = m[7] === 0 ? 0 : m[7];
  }

  /**
   * Transform a 3D point or vector from world space to camera space
   * P_cam = R^T * P_world
   * @param {number|{x: number, y: number, z: number}} wx
   * @param {number} [wy]
   * @param {number} [wz]
   * @returns {{x: number, y: number, z: number}}
   */
  worldToCamera(wx, wy, wz) {
    let x, y, z;
    if (typeof wx === 'object' && wx !== null) {
      x = wx.x;
      y = wx.y;
      z = wx.z;
    } else {
      x = wx;
      y = wy;
      z = wz;
    }

    const inv = this.invMatrix;
    return {
      x: inv[0] * x + inv[1] * y + inv[2] * z,
      y: inv[3] * x + inv[4] * y + inv[5] * z,
      z: inv[6] * x + inv[7] * y + inv[8] * z
    };
  }

  /**
   * Transform a 3D vector from camera space to world space
   * V_world = R * V_cam
   * @param {number|{x: number, y: number, z: number}} cx
   * @param {number} [cy]
   * @param {number} [cz]
   * @returns {{x: number, y: number, z: number}}
   */
  cameraToWorld(cx, cy, cz) {
    let x, y, z;
    if (typeof cx === 'object' && cx !== null) {
      x = cx.x;
      y = cx.y;
      z = cx.z;
    } else {
      x = cx;
      y = cy;
      z = cz;
    }

    const m = this.matrix;
    return {
      x: m[0] * x + m[1] * y + m[2] * z,
      y: m[3] * x + m[4] * y + m[5] * z,
      z: m[6] * x + m[7] * y + m[8] * z
    };
  }

  /**
   * Unproject a screen coordinate to a 3D world position at depth z in camera space
   * @param {number} screenX - Screen X coordinate
   * @param {number} screenY - Screen Y coordinate
   * @param {number} depth - Camera space depth (Z_cam >= 0)
   * @param {number} screenWidth - Viewport width
   * @param {number} screenHeight - Viewport height
   * @param {number} focalLength - Camera focal length
   * @returns {{x: number, y: number, z: number}} World position
   */
  unproject(screenX, screenY, depth, screenWidth, screenHeight, focalLength) {
    const scale = focalLength / (focalLength + depth);
    const halfW = screenWidth * 0.5;
    const halfH = screenHeight * 0.5;

    // Camera space position
    const camX = (screenX - halfW) / scale;
    const camY = (halfH - screenY) / scale;
    const camZ = depth;

    // Transform to world space
    return this.cameraToWorld(camX, camY, camZ);
  }

  /**
   * Project a 3D world position into 2D screen coordinates
   * @param {number} wx
   * @param {number} wy
   * @param {number} wz
   * @param {number} screenWidth
   * @param {number} screenHeight
   * @param {number} focalLength
   * @returns {{screenX: number, screenY: number, scale: number, cameraZ: number, visible: boolean}}
   */
  project(wx, wy, wz, screenWidth, screenHeight, focalLength) {
    const cam = this.worldToCamera(wx, wy, wz);

    if (focalLength + cam.z <= 0) {
      return { screenX: 0, screenY: 0, scale: 0, cameraZ: cam.z, visible: false };
    }

    const scale = focalLength / (focalLength + cam.z);
    const halfW = screenWidth * 0.5;
    const halfH = screenHeight * 0.5;

    return {
      screenX: halfW + cam.x * scale,
      screenY: halfH - cam.y * scale,
      scale,
      cameraZ: cam.z,
      visible: cam.z > 0
    };
  }
}
