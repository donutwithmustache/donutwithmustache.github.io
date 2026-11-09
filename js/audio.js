// Procedural Jet Engine & Combat SFX Engine via Web Audio API

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
    
    // Continuous audio nodes
    this.engineGain = null;
    this.engineOsc = null;
    this.burnerGain = null;
    this.burnerNoise = null;
    this.windGain = null;
    this.brakeGain = null;
    
    // Cooldown timers
    this.lastGunTime = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.45, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupEngineLoop();
      this.setupAfterburnerLoop();
      this.setupWindAndBrakeLoops();

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const vol = (this.masterVolume !== undefined ? this.masterVolume : 1.0) * 0.45;
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : vol, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1.0, val));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.masterVolume * 0.45, this.ctx.currentTime);
    }
  }

  getMasterVolume() {
    return this.masterVolume !== undefined ? this.masterVolume : 1.0;
  }

  // Generate pink/white noise buffer
  createNoiseBuffer(seconds = 3) {
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.5;
    }
    return buffer;
  }

  setupEngineLoop() {
    // Jet Turbine Whine
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(140, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'bandpass';
    this.engineFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc.start();
  }

  setupAfterburnerLoop() {
    // Deep roaring afterburner noise
    const noiseBuffer = this.createNoiseBuffer(4);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    this.burnerFilter = this.ctx.createBiquadFilter();
    this.burnerFilter.type = 'lowpass';
    this.burnerFilter.frequency.setValueAtTime(120, this.ctx.currentTime);

    this.burnerGain = this.ctx.createGain();
    this.burnerGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    noiseSource.connect(this.burnerFilter);
    this.burnerFilter.connect(this.burnerGain);
    this.burnerGain.connect(this.masterGain);

    noiseSource.start();
  }

  setupWindAndBrakeLoops() {
    // Dynamic air rush & airbrake hiss
    const noiseBuffer = this.createNoiseBuffer(3);
    
    // Wind rush
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.setValueAtTime(300, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

    windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    windSource.start();

    // Airbrake hiss
    const brakeSource = this.ctx.createBufferSource();
    brakeSource.buffer = noiseBuffer;
    brakeSource.loop = true;

    this.brakeFilter = this.ctx.createBiquadFilter();
    this.brakeFilter.type = 'highpass';
    this.brakeFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    this.brakeGain = this.ctx.createGain();
    this.brakeGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    brakeSource.connect(this.brakeFilter);
    this.brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(this.masterGain);
    brakeSource.start();
  }

  update(flightState) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const speedRatio = Math.min(1.5, flightState.speed / 250);
    const throttleRatio = flightState.throttle;

    // Modulate turbine pitch
    const pitch = 120 + speedRatio * 160 + throttleRatio * 90;
    this.engineOsc.frequency.setTargetAtTime(pitch, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(pitch * 2.8, t, 0.1);

    // Modulate afterburner roar
    const targetBurner = flightState.isAfterburning ? 0.35 : (flightState.throttle > 0.9 ? 0.08 : 0.0);
    this.burnerGain.gain.setTargetAtTime(targetBurner, t, 0.15);
    this.burnerFilter.frequency.setTargetAtTime(110 + throttleRatio * 120, t, 0.15);

    // Modulate wind rush (increases with speed and high-G turn drift)
    const driftBoost = flightState.isDrifting ? 0.15 : 0.0;
    const targetWind = 0.04 + speedRatio * 0.14 + driftBoost;
    this.windGain.gain.setTargetAtTime(targetWind, t, 0.1);
    this.windFilter.frequency.setTargetAtTime(250 + speedRatio * 450, t, 0.1);

    // Modulate airbrake
    const targetBrake = flightState.isAirbraking ? 0.28 : 0.0;
    this.brakeGain.gain.setTargetAtTime(targetBrake, t, 0.08);
  }

  // Gun firing burst - Realistic 20mm/30mm Autocannon (Heavy concussive thump + supersonic crack + mechanical snap)
  playGunSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (t - this.lastGunTime < 0.055) return;
    this.lastGunTime = t;

    // 1. Heavy mechanical low-end thump (GSh-30 / Vulcan rotary chamber explosion)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(115, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.065);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.55, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(t);
    subOsc.stop(t + 0.075);

    // 2. High-pressure supersonic muzzle blast & crack (noise impulse)
    const blastBuffer = this.createNoiseBuffer(0.08);
    const blastSource = this.ctx.createBufferSource();
    blastSource.buffer = blastBuffer;

    const blastFilter = this.ctx.createBiquadFilter();
    blastFilter.type = 'bandpass';
    blastFilter.frequency.setValueAtTime(1400, t);
    blastFilter.frequency.exponentialRampToValueAtTime(320, t + 0.06);
    blastFilter.Q.setValueAtTime(1.4, t);

    const blastGain = this.ctx.createGain();
    blastGain.gain.setValueAtTime(0.65, t);
    blastGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

    blastSource.connect(blastFilter);
    blastFilter.connect(blastGain);
    blastGain.connect(this.masterGain);
    blastSource.start(t);
    blastSource.stop(t + 0.07);

    // 3. Metallic bolt slap & breech mechanism snap
    const snapOsc = this.ctx.createOscillator();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(2400, t);
    snapOsc.frequency.exponentialRampToValueAtTime(650, t + 0.025);

    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(0.28, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    snapOsc.connect(snapGain);
    snapGain.connect(this.masterGain);
    snapOsc.start(t);
    snapOsc.stop(t + 0.035);
  }

  // Flare release pop and sizzle
  playFlareSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Pop oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Missile launch - Authentic solid-fuel rocket ignition roar, pylon decouple thump, and exhaust tear
  playMissileSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // 1. Mechanical Pylon Rail Detachment Thump
    const thumpOsc = this.ctx.createOscillator();
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(160, t);
    thumpOsc.frequency.exponentialRampToValueAtTime(45, t + 0.07);

    const thumpGain = this.ctx.createGain();
    thumpGain.gain.setValueAtTime(0.5, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.masterGain);
    thumpOsc.start(t);
    thumpOsc.stop(t + 0.085);

    // 2. Solid Propellant Rocket Ignition Roar & High-Velocity Burn
    const roarBuffer = this.createNoiseBuffer(0.65);
    const roarSource = this.ctx.createBufferSource();
    roarSource.buffer = roarBuffer;

    const roarFilter = this.ctx.createBiquadFilter();
    roarFilter.type = 'lowpass';
    roarFilter.frequency.setValueAtTime(250, t);
    roarFilter.frequency.exponentialRampToValueAtTime(950, t + 0.12);
    roarFilter.frequency.exponentialRampToValueAtTime(180, t + 0.55);
    roarFilter.Q.setValueAtTime(2.2, t);

    const roarGain = this.ctx.createGain();
    roarGain.gain.setValueAtTime(0.0, t);
    roarGain.gain.linearRampToValueAtTime(0.65, t + 0.04);
    roarGain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);

    roarSource.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(this.masterGain);
    roarSource.start(t);
    roarSource.stop(t + 0.60);

    // 3. Supersonic Exhaust Air-Tear Hiss (high pressure exhaust wash)
    const hissSource = this.ctx.createBufferSource();
    hissSource.buffer = roarBuffer;

    const hissFilter = this.ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.setValueAtTime(1600, t);
    hissFilter.frequency.exponentialRampToValueAtTime(3200, t + 0.15);
    hissFilter.Q.setValueAtTime(1.8, t);

    const hissGain = this.ctx.createGain();
    hissGain.gain.setValueAtTime(0.0, t);
    hissGain.gain.linearRampToValueAtTime(0.38, t + 0.03);
    hissGain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    hissSource.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(this.masterGain);
    hissSource.start(t);
    hissSource.stop(t + 0.45);
  }

  // Weapon switch sound effect (Authentic Ace Combat MFD avionics beep + mechanical switch click)
  playWeaponSwitchSound(selectedWeapon = 'msl') {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const isSpw = (selectedWeapon === 'spw');

    // 1. Tactile Relay Switch Click (Micro noise pulse)
    const clickDur = 0.015;
    const clickBuf = this.createNoiseBuffer(clickDur);
    const clickSrc = this.ctx.createBufferSource();
    clickSrc.buffer = clickBuf;

    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(3200, t);
    clickFilter.Q.setValueAtTime(3.0, t);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.18, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + clickDur);

    clickSrc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.masterGain);
    clickSrc.start(t);
    clickSrc.stop(t + clickDur);

    // 2. High-Tech Avionics Dual Chirp
    // SPW: crisp ascending chirp (1080 Hz -> 1540 Hz)
    // MSL: crisp descending confirmation chirp (1420 Hz -> 980 Hz)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const startFreq = isSpw ? 1080 : 1420;
    const midFreq = isSpw ? 1540 : 980;
    const dur = 0.085;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.setValueAtTime(midFreq, t + 0.035);

    // Harmonic cockpit tone
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(startFreq * 0.5, t);
    subOsc.frequency.setValueAtTime(midFreq * 0.5, t + 0.035);

    const toneGain = this.ctx.createGain();
    toneGain.gain.setValueAtTime(0.24, t);
    toneGain.gain.setValueAtTime(0.22, t + 0.035);
    toneGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.10, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(toneGain);
    toneGain.connect(this.masterGain);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    osc.start(t);
    subOsc.start(t);
    osc.stop(t + dur + 0.01);
    subOsc.stop(t + dur + 0.01);
  }

  // Fully depleted weapon / dry fire sound effect (dull mechanical clack + hollow low alert buzz)
  playDepletedSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // 1. Dry-fire mechanical striker click
    const clickDur = 0.025;
    const clickBuf = this.createNoiseBuffer(clickDur);
    const clickSrc = this.ctx.createBufferSource();
    clickSrc.buffer = clickBuf;

    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(1400, t);
    clickFilter.Q.setValueAtTime(3.5, t);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.28, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + clickDur);

    clickSrc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.masterGain);
    clickSrc.start(t);
    clickSrc.stop(t + clickDur);

    // 2. Low hollow alert buzz (160 Hz downward chirp)
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.12);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.26, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  // Weapon on cooldown / recharging sound effect (crisp double warning chirp / busy tone)
  playCooldownSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Two rapid high-pitch avionics warning beeps
    for (let i = 0; i < 2; i++) {
      const pulseT = t + i * 0.065;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(840, pulseT);
      osc.frequency.setValueAtTime(680, pulseT + 0.025);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.20, pulseT);
      gain.gain.exponentialRampToValueAtTime(0.001, pulseT + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(pulseT);
      osc.stop(pulseT + 0.055);
    }
  }

  // UI switch click sound
  playSwitchSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1320, t + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Target designation blip (RMB)
  playTargetDesignateSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.setValueAtTime(1600, t + 0.03);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  // Authentic Military HUD / Seeker Lock Tone (Clean, high-frequency harmonic tone)
  playLockTone() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (this.lastLockTone && t - this.lastLockTone < 0.18) return;
    this.lastLockTone = t;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(2600, t);
    osc2.frequency.setValueAtTime(3250, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.015);
    gain.gain.setValueAtTime(0.24, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.17);
    osc2.stop(t + 0.17);
  }

  // Authentic Military RWR "MISSILE LAUNCH / INCOMING THREAT" Urgent Alarm (Clean Dual Electronic Pulse)
  playMissileAlert() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (this.lastMissileAlert && t - this.lastMissileAlert < 0.25) return;
    this.lastMissileAlert = t;

    const playBeep = (time, freq, dur) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; // Clean sine tone: crisp military HUD tone without harsh square-wave buzz
      osc.frequency.setValueAtTime(freq, time);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(0.18, time + 0.006); // Balanced comfortable audio level
      gain.gain.setValueAtTime(0.18, time + dur - 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + dur + 0.01);
    };

    playBeep(t, 1500, 0.065);
    playBeep(t + 0.080, 1180, 0.065);
  }

  // Target destroyed kill confirmation chime
  playTargetDestroyed() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046, t); // C6
    osc.frequency.setValueAtTime(1318, t + 0.06); // E6
    osc.frequency.setValueAtTime(1567, t + 0.12); // G6

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Sonic boom transonic shockwave crack & deep thump
  playSonicBoom() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Sub-bass thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(22, t + 0.38);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.46);

    // Shockwave noise crack
    const buffer = this.createNoiseBuffer(0.3);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + 0.28);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.45, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.32);
  }

  // Stall Warning alert tone
  playStallWarning() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (this.lastStallBeep && t - this.lastStallBeep < 0.28) return;
    this.lastStallBeep = t;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.setValueAtTime(650, t + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  // Boundary Warning alert tone (approaching or exiting combat theater)
  playBoundaryWarning(urgent = false) {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const interval = urgent ? 0.20 : 0.45;
    if (this.lastBoundaryBeep && t - this.lastBoundaryBeep < interval) return;
    this.lastBoundaryBeep = t;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(urgent ? 950 : 700, t);
    osc.frequency.exponentialRampToValueAtTime(urgent ? 450 : 500, t + (urgent ? 0.11 : 0.16));

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(urgent ? 0.24 : 0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (urgent ? 0.11 : 0.16));

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + (urgent ? 0.12 : 0.17));
  }

  // Missile impact / warhead explosion sound (concussive blast + metal shrapnel crack + fiery explosion whoosh)
  playMissileHitSound(isHeavy = false) {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // 1. Sharp Detonation Supersonic Crack (Fragmentation warhead bursting)
    const crackDur = isHeavy ? 0.22 : 0.16;
    const crackBuffer = this.createNoiseBuffer(crackDur);
    const crack = this.ctx.createBufferSource();
    crack.buffer = crackBuffer;

    const crackFilter = this.ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(isHeavy ? 2400 : 2800, t);
    crackFilter.frequency.exponentialRampToValueAtTime(isHeavy ? 350 : 500, t + crackDur * 0.7);
    crackFilter.Q.setValueAtTime(2.0, t);

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(isHeavy ? 0.95 : 0.80, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + crackDur);

    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.masterGain);
    crack.start(t);
    crack.stop(t + crackDur + 0.02);

    // 2. Concussive Kinetic Airframe Impact Thump (Heavy low-frequency shockwave)
    const thumpOsc = this.ctx.createOscillator();
    thumpOsc.type = 'triangle';
    const startFreq = isHeavy ? 180 : 220;
    const endFreq = isHeavy ? 35 : 48;
    thumpOsc.frequency.setValueAtTime(startFreq, t);
    thumpOsc.frequency.exponentialRampToValueAtTime(endFreq, t + (isHeavy ? 0.32 : 0.22));

    const thumpGain = this.ctx.createGain();
    thumpGain.gain.setValueAtTime(isHeavy ? 0.90 : 0.75, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + (isHeavy ? 0.36 : 0.26));

    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.masterGain);
    thumpOsc.start(t);
    thumpOsc.stop(t + (isHeavy ? 0.38 : 0.28));

    // 3. Fiery Explosion Whoosh & Metal Ring Decay
    const blastDur = isHeavy ? 0.65 : 0.45;
    const blastBuffer = this.createNoiseBuffer(blastDur);
    const blast = this.ctx.createBufferSource();
    blast.buffer = blastBuffer;

    const blastFilter = this.ctx.createBiquadFilter();
    blastFilter.type = 'lowpass';
    blastFilter.frequency.setValueAtTime(isHeavy ? 750 : 900, t);
    blastFilter.frequency.exponentialRampToValueAtTime(80, t + blastDur);
    blastFilter.Q.setValueAtTime(1.8, t);

    const blastGain = this.ctx.createGain();
    blastGain.gain.setValueAtTime(isHeavy ? 0.75 : 0.60, t);
    blastGain.gain.exponentialRampToValueAtTime(0.001, t + blastDur);

    blast.connect(blastFilter);
    blastFilter.connect(blastGain);
    blastGain.connect(this.masterGain);
    blast.start(t);
    blast.stop(t + blastDur + 0.02);
  }

  // Explosion sound (both for airframe crashes and target missile/bomb detonations)
  playExplosionSound() {
    this.playCrashSound();
  }

  // Heavy multi-layer explosion (Supersonic crack + sub-bass blast wave + long rolling fireball rumble)
  playCrashSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // 1. Initial Supersonic Detonation Shockwave (Sharp Transient Crack)
    const crackBuffer = this.createNoiseBuffer(0.25);
    const crack = this.ctx.createBufferSource();
    crack.buffer = crackBuffer;

    const crackFilter = this.ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(1800, t);
    crackFilter.frequency.exponentialRampToValueAtTime(450, t + 0.12);
    crackFilter.Q.setValueAtTime(1.5, t);

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.75, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.masterGain);
    crack.start(t);
    crack.stop(t + 0.18);

    // 2. Concussive Sub-Bass Blast Wave (Deep Ground/Air Thump)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(58, t);
    subOsc.frequency.exponentialRampToValueAtTime(18, t + 0.65);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.85, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(t);
    subOsc.stop(t + 0.8);

    // 3. Deep Fireball Debris Rumble (Rolling Decay across the Sky)
    const rumbleBuffer = this.createNoiseBuffer(1.4);
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = rumbleBuffer;

    const rumbleFilter = this.ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(480, t);
    rumbleFilter.frequency.exponentialRampToValueAtTime(55, t + 1.2);
    rumbleFilter.Q.setValueAtTime(2.0, t);

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.0, t);
    rumbleGain.gain.linearRampToValueAtTime(0.7, t + 0.03);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 1.35);

    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumble.start(t);
    rumble.stop(t + 1.4);
  }

  // Radio transmission open chirp / squelch burst
  playRadioChirp() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Dual-tone frequency blip
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, t);
    osc.frequency.setValueAtTime(1920, t + 0.045);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);

    // Subtle radio squelch noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, t);
    filter.Q.setValueAtTime(2.0, t);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.12, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.09);
  }

  // Teletype / typewriter data entry click for letter-by-letter dialogue
  playTeletypeClick() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    // Randomized pitch for authentic mechanical data teletype feel
    const freq = 1200 + (Math.random() - 0.5) * 250;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.025);
  }

  // Megaton Nuclear Detonation Sound: blinding crack + 4.5s rolling sub-bass earthquake rumble
  playNukeSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // 1. Initial blinding supersonic atmospheric shock crack
    const crack = this.ctx.createBufferSource();
    crack.buffer = this.createNoiseBuffer(0.4);
    const cFilter = this.ctx.createBiquadFilter();
    cFilter.type = 'bandpass';
    cFilter.frequency.setValueAtTime(3200, t);
    cFilter.frequency.exponentialRampToValueAtTime(280, t + 0.25);
    const cGain = this.ctx.createGain();
    cGain.gain.setValueAtTime(0.85, t);
    cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    crack.connect(cFilter);
    cFilter.connect(cGain);
    cGain.connect(this.masterGain);
    crack.start(t);
    crack.stop(t + 0.4);

    // 2. Sub-bass ground-shaking shockwave (45Hz down to 20Hz)
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, t);
    sub.frequency.exponentialRampToValueAtTime(18, t + 3.8);
    subGain.gain.setValueAtTime(0.0, t);
    subGain.gain.linearRampToValueAtTime(1.0, t + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 4.2);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 4.5);

    // 3. Sustained nuclear fireball atmospheric roar (4.5s decay)
    const roar = this.ctx.createBufferSource();
    roar.buffer = this.createNoiseBuffer(4.5);
    const rFilter = this.ctx.createBiquadFilter();
    rFilter.type = 'lowpass';
    rFilter.frequency.setValueAtTime(550, t);
    rFilter.frequency.exponentialRampToValueAtTime(45, t + 4.0);
    const rGain = this.ctx.createGain();
    rGain.gain.setValueAtTime(0.0, t);
    rGain.gain.linearRampToValueAtTime(0.85, t + 0.15);
    rGain.gain.exponentialRampToValueAtTime(0.001, t + 4.4);

    roar.connect(rFilter);
    rFilter.connect(rGain);
    rGain.connect(this.masterGain);
    roar.start(t);
    roar.stop(t + 4.6);
  }

  // Ace Combat Return Line Resupply Chime: 4-tone ascending high-tech electronic chime
  playResupplyChime() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const baseTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const noteTime = baseTime + idx * 0.075;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0, noteTime);
      gain.gain.linearRampToValueAtTime(0.24, noteTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + (idx === 3 ? 0.65 : 0.35));

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteTime);
      osc.stop(noteTime + 0.7);
    });
  }

  // Cinematic Sector Transfer Sound: deep atmospheric whoosh + tactical tone
  playSectorTransitionSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Sub-bass atmospheric sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.2);

    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.45, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 1.4);

    // Filtered atmospheric air sweep
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(1.4);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.linearRampToValueAtTime(450, t + 0.6);
    filter.frequency.exponentialRampToValueAtTime(120, t + 1.3);
    filter.Q.setValueAtTime(1.8, t);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.0, t);
    nGain.gain.linearRampToValueAtTime(0.28, t + 0.3);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 1.35);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 1.4);
  }
}

