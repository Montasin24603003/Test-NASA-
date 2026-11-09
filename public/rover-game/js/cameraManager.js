import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const CAMERA_MODES = [
  { id: 'chase',        label: 'CHASE CAM',     short: '3RD CHASE', fov: 54, sensorOverlay: false },
  { id: 'first_person', label: 'ROVER DECK',    short: '1ST DECK',  fov: 62, sensorOverlay: false },
  { id: 'front_hazcam', label: 'FRONT HAZCAM',  short: 'F-HAZCAM',  fov: 96, sensorOverlay: true  },
  { id: 'rear_hazcam',  label: 'REAR HAZCAM',   short: 'R-HAZCAM',  fov: 96, sensorOverlay: true  },
  { id: 'mastcam',      label: 'MASTCAM-Z',     short: 'MASTCAM-Z', fov: 44, sensorOverlay: true  },
  { id: 'free',         label: 'FREE DRONE',    short: 'FREE CAM',  fov: 56, sensorOverlay: false }
];

/**
 * 6-Mode Smooth Camera System + Menu/Garage Showcase Modes
 */
export class CameraManager {
  constructor(camera, renderer, rover, world) {
    this.camera = camera;
    this.renderer = renderer;
    this.rover = rover;
    this.world = world;

    this.modeIndex = 0;
    this.mode = 'chase';
    this.showcaseMode = 'menu'; // 'none' | 'menu' | 'garage'
    this._showcaseAngle = 0.65;

    // Chase cam orbital angles & distance
    this.chaseYawOffset = 0;
    this.chasePitch = 0.28;
    this.chaseDistance = 6.8;
    this._idleRecenterTimer = 0;

    // Mastcam / 1st-person look offsets & telephoto zoom
    this.lookYaw = 0;
    this.lookPitch = -0.05;
    this.mastcamFov = 44;

    // Smooth camera transition state
    this._transitioning = false;
    this._transTime = 0;
    this._transDuration = 0.42;
    this._fromPos = new THREE.Vector3();
    this._fromQuat = new THREE.Quaternion();
    this._fromFov = 54;

    // Smoothed chase position
    this._smoothPos = new THREE.Vector3(0, 5, 10);
    this._smoothLook = new THREE.Vector3();
    this._desiredPos = new THREE.Vector3();
    this._desiredQuat = new THREE.Quaternion();
    this._lookMat = new THREE.Matrix4();
    this._upVec = new THREE.Vector3(0, 1, 0);

    // Free camera OrbitControls
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.06;
    this.orbitControls.minDistance = 2.2;
    this.orbitControls.maxDistance = 320;
    this.orbitControls.maxPolarAngle = Math.PI * 0.49;
    this.orbitControls.enabled = false;
  }

  setShowcaseMode(mode) {
    this.showcaseMode = mode; // 'none' | 'menu' | 'garage'
    if (mode !== 'none') {
      this.orbitControls.enabled = false;
    } else if (this.mode === 'free') {
      this.orbitControls.enabled = true;
      this.orbitControls.target.copy(this.rover.group.position);
    }
  }

  cycleCamera() {
    const nextIdx = (this.modeIndex + 1) % CAMERA_MODES.length;
    return this.setModeByIndex(nextIdx);
  }

  setModeByIndex(idx) {
    const clamped = ((idx % CAMERA_MODES.length) + CAMERA_MODES.length) % CAMERA_MODES.length;
    return this.setMode(CAMERA_MODES[clamped].id);
  }

  setMode(modeId) {
    const foundIdx = CAMERA_MODES.findIndex((m) => m.id === modeId);
    if (foundIdx === -1) return this.getCurrentConfig();

    // Capture current camera transform for smooth transition interpolation
    this._fromPos.copy(this.camera.position);
    this._fromQuat.copy(this.camera.quaternion);
    this._fromFov = this.camera.fov;
    this._transTime = 0;
    this._transitioning = true;

    this.modeIndex = foundIdx;
    this.mode = modeId;

    if (modeId === 'free' && this.showcaseMode === 'none') {
      this.orbitControls.enabled = true;
      this.orbitControls.target.copy(this.rover.group.position).add(new THREE.Vector3(0, 0.8, 0));
      // Position free drone slightly elevated if entering from tight bumper cam
      const p = this.rover.group.position;
      this.camera.position.set(p.x + 10, p.y + 8, p.z + 12);
    } else {
      this.orbitControls.enabled = false;
    }

    if (modeId !== 'mastcam') {
      this.rover.mastHead.rotation.set(0, 0, 0);
    }
    this.lookYaw = 0;
    this.lookPitch = -0.04;

    return this.getCurrentConfig();
  }

  getCurrentConfig() {
    return CAMERA_MODES[this.modeIndex];
  }

  update(dt, input, physics) {
    const roverPos = this.rover.group.position;
    const roverQuat = this.rover.group.quaternion;

    // 1. Menu or Garage Cinematic Orbit Showcase
    if (this.showcaseMode === 'menu' || this.showcaseMode === 'garage') {
      this._showcaseAngle += dt * (this.showcaseMode === 'garage' ? 0.32 : 0.14);
      const radius = this.showcaseMode === 'garage' ? 3.85 : 6.4;
      const height = this.showcaseMode === 'garage' ? 1.45 : 2.35;

      const cx = roverPos.x + Math.sin(this._showcaseAngle) * radius;
      const cz = roverPos.z + Math.cos(this._showcaseAngle) * radius;
      const groundY = this.world.getElevationAt(cx, cz);
      const cy = Math.max(groundY + 0.6, roverPos.y + height);

      this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 5.0));
      const lookAt = roverPos.clone().add(new THREE.Vector3(0, this.showcaseMode === 'garage' ? 0.32 : 0.55, 0));
      this.camera.lookAt(lookAt);
      if (Math.abs(this.camera.fov - 48) > 0.1) {
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 48, Math.min(1, dt * 6));
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    const lookInput = input ? input.consumeLookAndZoom() : { dx: 0, dy: 0, wheel: 0 };

    // 2. Free Exploration Camera Mode
    if (this.mode === 'free') {
      this.orbitControls.update();
      const minGround = this.world.getElevationAt(this.camera.position.x, this.camera.position.z) + 0.5;
      if (this.camera.position.y < minGround) {
        this.camera.position.y = minGround;
      }
      const targetFov = 56;
      if (Math.abs(this.camera.fov - targetFov) > 0.1) {
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 8));
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    let targetFov = this.getCurrentConfig().fov;

    // 3. Calculate Desired Camera Pose for Modes 1–5
    if (this.mode === 'chase') {
      if (Math.abs(lookInput.dx) > 0.01 || Math.abs(lookInput.dy) > 0.01) {
        this.chaseYawOffset -= lookInput.dx * 0.0045;
        this.chasePitch = THREE.MathUtils.clamp(this.chasePitch + lookInput.dy * 0.0038, 0.06, 1.15);
        this._idleRecenterTimer = 2.6;
      } else {
        this._idleRecenterTimer = Math.max(0, this._idleRecenterTimer - dt);
        // Gently align behind rover when driving if user hasn't rotated mouse recently
        if (this._idleRecenterTimer <= 0 && Math.abs(physics.forwardSpeed) > 0.6) {
          this.chaseYawOffset = THREE.MathUtils.lerp(this.chaseYawOffset, 0, Math.min(1, dt * 1.8));
        }
      }

      if (lookInput.wheel !== 0) {
        this.chaseDistance = THREE.MathUtils.clamp(this.chaseDistance + lookInput.wheel * 0.75, 3.6, 15.5);
      }

      // Rover heading yaw
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(roverQuat);
      const roverYaw = Math.atan2(-fwd.x, -fwd.z);
      const totalYaw = roverYaw + this.chaseYawOffset;

      const horizDist = Math.cos(this.chasePitch) * this.chaseDistance;
      const vertDist = Math.sin(this.chasePitch) * this.chaseDistance + 0.85;

      const desiredX = roverPos.x + Math.sin(totalYaw) * horizDist;
      const desiredZ = roverPos.z + Math.cos(totalYaw) * horizDist;
      const terrainFloor = this.world.getElevationAt(desiredX, desiredZ) + 0.55;
      const desiredY = Math.max(terrainFloor, roverPos.y + vertDist);

      this._smoothPos.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), Math.min(1, dt * 9.5));
      this._desiredPos.copy(this._smoothPos);

      const targetLook = roverPos.clone().add(new THREE.Vector3(0, 0.55, 0));
      this._smoothLook.lerp(targetLook, Math.min(1, dt * 14.0));
      this._lookMat.lookAt(this._desiredPos, this._smoothLook, this._upVec);
      this._desiredQuat.setFromRotationMatrix(this._lookMat);

      // Dynamic speed FOV subtle widening on Overdrive boost
      targetFov = 54 + Math.min(8, Math.max(0, physics.speedMagnitude - 4.5) * 1.4);

    } else if (this.mode === 'first_person') {
      this.lookYaw = THREE.MathUtils.clamp(this.lookYaw - lookInput.dx * 0.0038, -1.35, 1.35);
      this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - lookInput.dy * 0.0035, -0.65, 0.55);

      this.rover.firstPersonAnchor.getWorldPosition(this._desiredPos);
      const localEuler = new THREE.Euler(this.lookPitch - 0.12, this.lookYaw, 0, 'YXZ');
      const localQuat = new THREE.Quaternion().setFromEuler(localEuler);
      this._desiredQuat.copy(roverQuat).multiply(localQuat);

    } else if (this.mode === 'front_hazcam') {
      this.rover.frontHazcamAnchor.getWorldPosition(this._desiredPos);
      const pitchDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.24);
      this._desiredQuat.copy(roverQuat).multiply(pitchDown);

    } else if (this.mode === 'rear_hazcam') {
      this.rover.rearHazcamAnchor.getWorldPosition(this._desiredPos);
      // Look aft (+Z in rover body space -> rotate 180 deg around Y) + pitch down slightly
      const turnBack = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, Math.PI, 0, 'YXZ'));
      this._desiredQuat.copy(roverQuat).multiply(turnBack);

    } else if (this.mode === 'mastcam') {
      this.lookYaw = THREE.MathUtils.clamp(this.lookYaw - lookInput.dx * 0.0035, -2.6, 2.6);
      this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - lookInput.dy * 0.0035, -0.78, 0.65);

      if (lookInput.wheel !== 0) {
        this.mastcamFov = THREE.MathUtils.clamp(this.mastcamFov + lookInput.wheel * 4.0, 16, 56);
      }
      targetFov = this.mastcamFov;

      // Physically pan & tilt the 3D Mastcam head on the rover!
      this.rover.mastHead.rotation.set(this.lookPitch, this.lookYaw, 0, 'YXZ');
      this.rover.mastcamAnchor.getWorldPosition(this._desiredPos);
      this.rover.mastHead.getWorldQuaternion(this._desiredQuat);
    }

    // 4. Apply Smooth Transition Interpolation when switching cameras
    if (this._transitioning) {
      this._transTime += dt;
      const rawT = Math.min(1.0, this._transTime / this._transDuration);
      const ease = 1.0 - Math.pow(1.0 - rawT, 3); // Cubic ease-out

      this.camera.position.lerpVectors(this._fromPos, this._desiredPos, ease);
      this.camera.quaternion.slerpQuaternions(this._fromQuat, this._desiredQuat, ease);
      this.camera.fov = THREE.MathUtils.lerp(this._fromFov, targetFov, ease);
      this.camera.updateProjectionMatrix();

      if (rawT >= 1.0) {
        this._transitioning = false;
        this._smoothPos.copy(this._desiredPos);
      }
    } else {
      this.camera.position.copy(this._desiredPos);
      this.camera.quaternion.copy(this._desiredQuat);
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 8.0));
        this.camera.updateProjectionMatrix();
      }
    }
  }
}
