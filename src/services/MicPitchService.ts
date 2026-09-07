/**
 * SonicLab 3D - Real-Time Audio & Microphone Pitch Tracking Service
 * Extracts fundamental frequency (pitch) via fast autocorrelation algorithm
 * and powers reactive live cymatic sand dynamics.
 */

export class MicPitchService {
  private static instance: MicPitchService | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isListening: boolean = false;
  private animationFrameId: number | null = null;
  private buffer: Float32Array = new Float32Array(2048);
  private onPitchCallback: ((freqHz: number, volumeRms: number) => void) | null = null;

  public static getInstance(): MicPitchService {
    if (!this.instance) {
      this.instance = new MicPitchService();
    }
    return this.instance;
  }

  public setPitchCallback(callback: ((freqHz: number, volumeRms: number) => void) | null) {
    this.onPitchCallback = callback;
  }

  public async startMicrophone(): Promise<boolean> {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia is not supported on this browser or context (requires HTTPS).');
        return false;
      }

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
          },
        });
      } catch {
        // Fallback for Android WebViews or mobile devices that reject advanced audio constraints
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;

      this.sourceNode.connect(this.analyserNode);
      this.isListening = true;
      this.loop();
      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      return false;
    }
  }

  public stopMicrophone(): void {
    this.isListening = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }

  public isActive(): boolean {
    return this.isListening;
  }

  private loop = (): void => {
    if (!this.isListening || !this.analyserNode || !this.audioContext) return;

    this.analyserNode.getFloatTimeDomainData(this.buffer);

    // Compute RMS Volume
    let sumSquares = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sumSquares += this.buffer[i] * this.buffer[i];
    }
    const rms = Math.sqrt(sumSquares / this.buffer.length);

    // Only detect pitch if signal has sufficient energy
    if (rms > 0.015) {
      const pitch = this.autoCorrelate(this.buffer, this.audioContext.sampleRate);
      if (pitch > 40 && pitch < 3000 && this.onPitchCallback) {
        this.onPitchCallback(pitch, rms);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Fast Autocorrelation algorithm for pitch detection
   */
  private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    const SIZE = buffer.length;
    let r1 = 0;
    let r2 = SIZE - 1;
    const thres = 0.2;

    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < thres) {
        r1 = i;
        break;
      }
    }

    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buffer[SIZE - i]) < thres) {
        r2 = SIZE - i;
        break;
      }
    }

    const buf = buffer.subarray(r1, r2);
    const c = new Float32Array(buf.length);

    for (let i = 0; i < buf.length; i++) {
      for (let j = 0; j < buf.length - i; j++) {
        c[i] = c[i] + buf[j] * buf[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;

    let maxval = -1;
    let maxpos = -1;
    for (let i = d; i < buf.length; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    let T0 = maxpos;
    if (maxval > 0.4 * c[0]) {
      // Parabolic interpolation around peak
      const x1 = c[T0 - 1] || 0;
      const x2 = c[T0];
      const x3 = c[T0 + 1] || 0;
      const a = (x1 + x3 - 2 * x2) / 2;
      const b = (x3 - x1) / 2;
      if (a) {
        T0 = T0 - b / (2 * a);
      }
      return sampleRate / T0;
    }

    return -1;
  }
}
