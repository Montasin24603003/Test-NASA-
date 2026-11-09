/**
 * Procedural Martian Acoustic & Rover Telemetry Sound Engine (Web Audio API)
 * Zero external audio files required — 100% browser-native, instant load, HTTPS/offline safe.
 */
export class MarsAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.masterVolume = 0.75;

    this.masterGain = null;
    this.windGain = null;
    this.windFilter = null;
    this.motorOsc = null;
    this.motorGain = null;
    this.tireNoiseGain = null;
    this._noiseBuffer = null;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    // Reusable 3-second brown/pink noise buffer
    const len = this.ctx.sampleRate * 3;
    this._noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = this._noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.028 * white) / 1.028;
      ch[i] = last * 3.2;
    }

    // 1. Continuous Martian Atmospheric Wind Loop
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this._noiseBuffer;
    windSrc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 155;
    this.windFilter.Q.value = 1.8;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 65;
    lfo.connect(lfoGain);
    lfoGain.connect(this.windFilter.frequency);
    lfo.start();

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    windSrc.start();

    // 2. Rover Electric Servo Drive Hum
    this.motorOsc = this.ctx.createOscillator();
    this.motorOsc.type = 'triangle';
    this.motorOsc.frequency.value = 68;

    const motorLowpass = this.ctx.createBiquadFilter();
    motorLowpass.type = 'lowpass';
    motorLowpass.frequency.value = 340;

    this.motorGain = this.ctx.createGain();
    this.motorGain.gain.value = 0;

    this.motorOsc.connect(motorLowpass);
    motorLowpass.connect(this.motorGain);
    this.motorGain.connect(this.masterGain);
    this.motorOsc.start();

    // 3. Regolith Tire Rolling / Slip Grain Loop
    const tireSrc = this.ctx.createBufferSource();
    tireSrc.buffer = this._noiseBuffer;
    tireSrc.loop = true;

    const tireFilter = this.ctx.createBiquadFilter();
    tireFilter.type = 'bandpass';
    tireFilter.frequency.value = 420;
    tireFilter.Q.value = 1.1;

    this.tireNoiseGain = this.ctx.createGain();
    this.tireNoiseGain.gain.value = 0;

    tireSrc.connect(tireFilter);
    tireFilter.connect(this.tireNoiseGain);
    this.tireNoiseGain.connect(this.masterGain);
    tireSrc.start();
  }

  ensureUnlocked() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle(forceState = null) {
    this.ensureUnlocked();
    this.enabled = forceState !== null ? forceState : !this.enabled;
    if (!this.ctx) return false;

    const now = this.ctx.currentTime;
    if (!this.enabled) {
      this.windGain.gain.setTargetAtTime(0, now, 0.15);
      this.motorGain.gain.setTargetAtTime(0, now, 0.1);
      this.tireNoiseGain.gain.setTargetAtTime(0, now, 0.1);
    } else {
      this.windGain.gain.setTargetAtTime(0.24, now, 0.4);
    }
    return this.enabled;
  }

  setVolume(vol01) {
    this.masterVolume = Math.max(0, Math.min(1, vol01));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Per-frame continuous modulation for speed, wheel slip & dust storm intensity
   */
  update(speedMs, slipRatio, stormIntensity, groundedWheels) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Wind scales up dramatically during Dust Storms
    const targetWind = 0.20 + stormIntensity * 0.55;
    this.windGain.gain.setTargetAtTime(targetWind, now, 0.2);
    this.windFilter.frequency.setTargetAtTime(145 + stormIntensity * 220, now, 0.25);

    // Electric actuator hum pitch & gain
    const absSpeed = Math.abs(speedMs);
    const motorTarget = absSpeed > 0.08 ? Math.min(0.085, 0.018 + absSpeed * 0.008) : 0;
    this.motorOsc.frequency.setTargetAtTime(64 + absSpeed * 19 + slipRatio * 35, now, 0.08);
    this.motorGain.gain.setTargetAtTime(motorTarget, now, 0.08);

    // Tire regolith rumble
    const tireTarget = groundedWheels > 0 && absSpeed > 0.15
      ? Math.min(0.14, absSpeed * 0.014 + slipRatio * 0.08)
      : 0;
    this.tireNoiseGain.gain.setTargetAtTime(tireTarget, now, 0.08);
  }

  /**
   * SuperCam LIBS Pulsed Laser Acoustic Snaps (authentic 5-pulse burst)
   */
  playLaserZap() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1650, t);
      osc.frequency.exponentialRampToValueAtTime(190, t + 0.065);
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  /**
   * Rotary-Percussive Core Drill Sound
   */
  playDrillSound() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const g = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.linearRampToValueAtTime(310, now + 0.4);
    osc.frequency.setValueAtTime(295, now + 1.2);

    mod.frequency.value = 34; // Percussive hammer rate
    modGain.gain.value = 55;
    mod.connect(modGain);
    modGain.connect(osc.frequency);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.15);
    g.gain.setValueAtTime(0.13, now + 1.25);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.55);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    mod.start(now);
    osc.stop(now + 1.6);
    mod.stop(now + 1.6);
  }

  /**
   * Mastcam Mechanical Shutter Click + Telemetry Beep
   */
  playCameraShutter() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.setValueAtTime(1560, now + 0.05);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Chassis Rock Collision Thud
   */
  playImpact(impactSpeed) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.18);
    const vol = Math.min(0.32, 0.06 + impactSpeed * 0.04);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Waypoint & Mission Completion Telemetry Chimes
   */
  playWaypointChime(isMissionComplete = false) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = isMissionComplete ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880.0];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.095;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.30);
    });
  }
}
