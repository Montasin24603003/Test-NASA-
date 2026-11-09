/**
 * Unified Keyboard, Mouse & Touchscreen Input Controller
 */
export class InputController {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.enabled = false; // Enabled during active gameplay (disabled while typing or in full-screen menus)

    this.keys = new Set();

    // Continuous analog/digital control state consumed by physics & camera
    this.state = {
      forward: 0,
      reverse: 0,
      steerLeft: 0,
      steerRight: 0,
      brake: false,
      boost: false
    };

    // Touch override flags
    this.touchState = {
      forward: 0,
      reverse: 0,
      steerLeft: 0,
      steerRight: 0,
      brake: false,
      boost: false
    };

    // Camera mouse drag & wheel deltas
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;
    this.isMouseDragging = false;
    this._lastMouse = { x: 0, y: 0 };

    // Discrete action callbacks
    this.actions = {
      onCycleCamera: null,
      onSelectCameraIndex: null,
      onInteract: null,
      onResetRover: null,
      onToggleHeadlights: null,
      onCapturePhoto: null,
      onTogglePauseMenu: null,
      onToggleMissions: null,
      onToggleTelemetryDrawer: null,
      onTogglePhysicsViz: null,
      onToggleEngineeringMode: null,
      onToggleCreepMode: null,
      onLocalizationFix: null,
      onToggleSimPause: null
    };

    this.allowEngineeringHotkeys = false;

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouchUI();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (this.actions.onTogglePauseMenu) this.actions.onTogglePauseMenu();
        return;
      }

      if (!e.repeat && this.allowEngineeringHotkeys) {
        if (e.code === 'KeyG' && this.actions.onToggleEngineeringMode) {
          this.actions.onToggleEngineeringMode();
          return;
        }
        if (e.code === 'KeyK' && this.actions.onToggleSimPause) {
          this.actions.onToggleSimPause();
          return;
        }
      }

      if (!this.enabled) return;

      // Prevent browser scrolling on Space / Arrow keys during gameplay
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (!e.repeat) {
        if (e.code === 'KeyC' && this.actions.onCycleCamera) this.actions.onCycleCamera();
        if (e.code === 'KeyE' && this.actions.onInteract) this.actions.onInteract();
        if (e.code === 'KeyR' && this.actions.onResetRover) this.actions.onResetRover();
        if (e.code === 'KeyF' && this.actions.onToggleHeadlights) this.actions.onToggleHeadlights();
        if (e.code === 'KeyP' && this.actions.onCapturePhoto) this.actions.onCapturePhoto();
        if (e.code === 'KeyM' && this.actions.onToggleMissions) this.actions.onToggleMissions();
        if (e.code === 'KeyT' && this.actions.onToggleTelemetryDrawer) this.actions.onToggleTelemetryDrawer();
        if (e.code === 'KeyV' && this.actions.onTogglePhysicsViz) this.actions.onTogglePhysicsViz();
        if (e.code === 'KeyX' && this.actions.onToggleCreepMode) this.actions.onToggleCreepMode();
        if (e.code === 'KeyL' && this.actions.onLocalizationFix) this.actions.onLocalizationFix();

        // Direct camera hotkeys 1-6
        if (e.code.startsWith('Digit')) {
          const num = parseInt(e.code.replace('Digit', ''), 10);
          if (num >= 1 && num <= 6 && this.actions.onSelectCameraIndex) {
            this.actions.onSelectCameraIndex(num - 1);
          }
        }
      }

      this.keys.add(e.code);
      this._syncState();
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this._syncState();
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.isMouseDragging = false;
      this._syncState();
    });
  }

  _bindMouse() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0 || e.button === 2) {
        this.isMouseDragging = true;
        this._lastMouse.x = e.clientX;
        this._lastMouse.y = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.isMouseDragging) return;
      this.mouseDeltaX += e.clientX - this._lastMouse.x;
      this.mouseDeltaY += e.clientY - this._lastMouse.y;
      this._lastMouse.x = e.clientX;
      this._lastMouse.y = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.wheelDelta += Math.sign(e.deltaY);
    }, { passive: false });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _bindTouchUI() {
    // Multi-touch look on canvas
    let lookTouchId = null;
    let lastTX = 0;
    let lastTY = 0;

    this.canvas.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (lookTouchId === null) {
          lookTouchId = t.identifier;
          lastTX = t.clientX;
          lastTY = t.clientY;
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === lookTouchId) {
          this.mouseDeltaX += (t.clientX - lastTX) * 1.25;
          this.mouseDeltaY += (t.clientY - lastTY) * 1.25;
          lastTX = t.clientX;
          lastTY = t.clientY;
        }
      }
    }, { passive: true });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookTouchId) {
          lookTouchId = null;
        }
      }
    };
    this.canvas.addEventListener('touchend', endTouch, { passive: true });
    this.canvas.addEventListener('touchcancel', endTouch, { passive: true });
  }

  /**
   * Bind DOM touch pedal/steering buttons after UI renders
   */
  bindTouchButtons(root = document) {
    const holdBtns = root.querySelectorAll('[data-touch-control]');
    holdBtns.forEach((btn) => {
      const prop = btn.dataset.touchControl;
      const press = (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        if (prop === 'brake' || prop === 'boost') {
          this.touchState[prop] = true;
        } else {
          this.touchState[prop] = 1;
        }
        this._syncState();
      };
      const release = (e) => {
        e.preventDefault();
        btn.classList.remove('pressed');
        if (prop === 'brake' || prop === 'boost') {
          this.touchState[prop] = false;
        } else {
          this.touchState[prop] = 0;
        }
        this._syncState();
      };

      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    });
  }

  _syncState() {
    if (!this.enabled) {
      this.state.forward = 0;
      this.state.reverse = 0;
      this.state.steerLeft = 0;
      this.state.steerRight = 0;
      this.state.brake = false;
      this.state.boost = false;
      return;
    }

    const fwdKey = this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0;
    const revKey = this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0;
    const leftKey = this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0;
    const rightKey = this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0;
    const brkKey = this.keys.has('Space');
    const bstKey = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    this.state.forward = Math.max(fwdKey, this.touchState.forward);
    this.state.reverse = Math.max(revKey, this.touchState.reverse);
    this.state.steerLeft = Math.max(leftKey, this.touchState.steerLeft);
    this.state.steerRight = Math.max(rightKey, this.touchState.steerRight);
    this.state.brake = brkKey || this.touchState.brake;
    this.state.boost = bstKey || this.touchState.boost;
  }

  setEnabled(flag) {
    this.enabled = flag;
    if (!flag) {
      this.keys.clear();
    }
    this._syncState();
  }

  consumeLookAndZoom() {
    const out = {
      dx: this.mouseDeltaX,
      dy: this.mouseDeltaY,
      wheel: this.wheelDelta
    };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;
    return out;
  }
}
