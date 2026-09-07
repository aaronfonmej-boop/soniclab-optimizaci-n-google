/**
 * SonicLab 3D - High Performance Audio Synthesizer & Spectrum Analyzer
 * Built on Web Audio API with click-free parameter smoothing and dynamic compression.
 */

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Oscillators
  private primaryOsc: OscillatorNode | null = null;
  private primaryGain: GainNode | null = null;
  private harmonicOscs: OscillatorNode[] = [];
  private harmonicGains: GainNode[] = [];

  private isRunning: boolean = false;
  private currentFrequency: number = 120;
  private currentVolume: number = 0.15;

  private constructor() {}

  public static getInstance(): AudioEngine {
    if (!this.instance) {
      this.instance = new AudioEngine();
    }
    return this.instance;
  }

  private initContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.1, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.85;

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  public async startTone(frequency: number = 120, waveform: OscillatorType = 'sine') {
    this.initContext();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (this.isRunning) {
      this.setFrequency(frequency);
      return;
    }

    const now = this.ctx.currentTime;
    this.primaryOsc = this.ctx.createOscillator();
    this.primaryOsc.type = waveform;
    this.primaryOsc.frequency.setValueAtTime(frequency, now);

    this.primaryGain = this.ctx.createGain();
    this.primaryGain.gain.setValueAtTime(0.0001, now);
    this.primaryGain.gain.exponentialRampToValueAtTime(1.0, now + 0.04);

    this.primaryOsc.connect(this.primaryGain);
    if (this.compressor) {
      this.primaryGain.connect(this.compressor);
    }

    this.primaryOsc.start(now);
    this.isRunning = true;
    this.currentFrequency = frequency;
  }

  public stopTone() {
    if (!this.isRunning || !this.ctx || !this.primaryOsc || !this.primaryGain) return;
    const now = this.ctx.currentTime;
    this.primaryGain.gain.setValueAtTime(this.primaryGain.gain.value, now);
    this.primaryGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    setTimeout(() => {
      try {
        this.primaryOsc?.stop();
        this.primaryOsc?.disconnect();
        this.primaryGain?.disconnect();
      } catch {}
      this.primaryOsc = null;
      this.primaryGain = null;
      this.isRunning = false;
      this.stopHarmonics();
    }, 60);
  }

  public setFrequency(freq: number) {
    this.currentFrequency = freq;
    if (!this.ctx || !this.primaryOsc) return;
    const now = this.ctx.currentTime;
    // Click-free exponential frequency glide (prevents audio pop buffer underruns)
    const target = Math.max(freq, 20);
    this.primaryOsc.frequency.cancelScheduledValues(now);
    this.primaryOsc.frequency.exponentialRampToValueAtTime(target, now + 0.03);

    // Update harmonics if active
    this.harmonicOscs.forEach((osc, idx) => {
      const mult = idx + 2;
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.exponentialRampToValueAtTime(target * mult, now + 0.03);
    });
  }

  public setVolume(volume: number) {
    this.currentVolume = Math.min(Math.max(volume, 0), 1);
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(this.currentVolume, now + 0.02);
  }

  public setWaveform(waveform: OscillatorType) {
    if (this.primaryOsc) {
      this.primaryOsc.type = waveform;
    }
  }

  public updateHarmonics(amps: [number, number, number, number]) {
    if (!this.ctx || !this.isRunning || !this.compressor) return;
    const now = this.ctx.currentTime;

    // Harmonic 1 is primary
    if (this.primaryGain) {
      this.primaryGain.gain.cancelScheduledValues(now);
      this.primaryGain.gain.linearRampToValueAtTime(Math.max(amps[0], 0.0001), now + 0.02);
    }

    // Harmonics 2, 3, 4
    for (let i = 1; i <= 3; i++) {
      const harmonicIndex = i - 1;
      const targetAmp = amps[i];

      if (targetAmp > 0.01) {
        if (!this.harmonicOscs[harmonicIndex]) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(this.currentFrequency * (i + 1), now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(targetAmp, now + 0.03);
          osc.connect(gain);
          gain.connect(this.compressor);
          osc.start(now);
          this.harmonicOscs[harmonicIndex] = osc;
          this.harmonicGains[harmonicIndex] = gain;
        } else {
          this.harmonicGains[harmonicIndex]?.gain.cancelScheduledValues(now);
          this.harmonicGains[harmonicIndex]?.gain.linearRampToValueAtTime(targetAmp, now + 0.02);
        }
      } else if (this.harmonicOscs[harmonicIndex]) {
        this.harmonicGains[harmonicIndex]?.gain.cancelScheduledValues(now);
        this.harmonicGains[harmonicIndex]?.gain.linearRampToValueAtTime(0.0001, now + 0.03);
      }
    }
  }

  private stopHarmonics() {
    this.harmonicOscs.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.harmonicGains.forEach((gain) => {
      try {
        gain.disconnect();
      } catch {}
    });
    this.harmonicOscs = [];
    this.harmonicGains = [];
  }

  public getOscilloscopeData(dataArray: Uint8Array) {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(dataArray);
    } else {
      dataArray.fill(128);
    }
  }

  public getFrequencyData(dataArray: Uint8Array) {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(dataArray);
    } else {
      dataArray.fill(0);
    }
  }

  public get active(): boolean {
    return this.isRunning;
  }
}
