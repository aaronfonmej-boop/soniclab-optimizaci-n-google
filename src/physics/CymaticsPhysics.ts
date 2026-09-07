/**
 * SonicLab 3D - Cymatics Physics Engine
 * Implements Kirchhoff-Love thin plate vibration and modal dynamics.
 */

import { CymaticsMetrics, CymaticsModeBank, CymaticsState } from '../types/soniclab';

export class CymaticsPhysics {
  /**
   * Calculates flexural rigidity D = (E * h^3) / (12 * (1 - nu^2))
   */
  public static flexuralRigidity(state: CymaticsState): number {
    const E = Math.max(state.youngModulusPa, 1e9);
    const h = Math.max(state.thicknessM, 0.0001);
    const nu = Math.min(Math.max(state.poissonRatio, 0.01), 0.49);
    return (E * Math.pow(h, 3)) / (12 * (1 - nu * nu));
  }

  /**
   * Calculates natural frequency f_i in Hz given the dimensionless eigenvalue lambda_i:
   * f_i = (4 / (2 * pi * L^2)) * sqrt(D / (rho * h)) * sqrt(lambda_i)
   */
  public static naturalFrequencyHz(state: CymaticsState, eigenvalue: number): number {
    if (!Number.isFinite(eigenvalue) || eigenvalue <= 0) return 0;
    const D = this.flexuralRigidity(state);
    const rho = Math.max(state.densityKgM3, 100);
    const h = Math.max(state.thicknessM, 0.0001);
    const L = Math.max(state.characteristicSizeM, 0.05);
    const arealMass = rho * h;

    const angular = (4.0 / (L * L)) * Math.sqrt(D / arealMass) * Math.sqrt(eigenvalue);
    return angular / (2.0 * Math.PI);
  }

  /**
   * Dynamic magnification factor (response magnitude) of a single-degree-of-freedom damped oscillator:
   * H(r, zeta) = 1 / sqrt((1 - r^2)^2 + (2 * zeta * r)^2), where r = f_drive / f_nat
   */
  public static responseMagnitude(
    driveFrequencyHz: number,
    naturalFrequencyHz: number,
    dampingRatio: number
  ): number {
    if (
      !Number.isFinite(driveFrequencyHz) ||
      !Number.isFinite(naturalFrequencyHz) ||
      naturalFrequencyHz <= 0
    ) {
      return 0;
    }
    const r = driveFrequencyHz / naturalFrequencyHz;
    const zeta = Math.min(Math.max(dampingRatio, 0.002), 0.3);
    const denom = Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(2 * zeta * r, 2));
    return denom > 0 ? 1 / denom : 0;
  }

  /**
   * Sample modal displacement field phi_i(x, y) with bilinear interpolation
   */
  public static sampleMode(
    bank: CymaticsModeBank | null | undefined,
    modeIndex: number,
    normalizedX: number,
    normalizedY: number
  ): number {
    if (!bank || !bank.fields || bank.modeCount === 0) return 0;
    const mode = Math.min(Math.max(modeIndex, 0), bank.modeCount - 1);
    const grid = bank.gridSize;
    const field = bank.fields[mode];
    if (!field) return 0;

    const x = Math.min(Math.max((normalizedX + 1) * 0.5 * (grid - 1), 0), grid - 1);
    const y = Math.min(Math.max((normalizedY + 1) * 0.5 * (grid - 1), 0), grid - 1);

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, grid - 1);
    const y1 = Math.min(y0 + 1, grid - 1);

    const tx = x - x0;
    const ty = y - y0;

    const a = field[y0 * grid + x0] * (1 - tx) + field[y0 * grid + x1] * tx;
    const b = field[y1 * grid + x0] * (1 - tx) + field[y1 * grid + x1] * tx;

    return a * (1 - ty) + b * ty;
  }

  /**
   * Fast unified bilinear sampler and spatial gradient computation for Chladni particle dynamics.
   * Eliminates 3 separate sampleMode lookups per particle, cutting particle physics time by 66%.
   */
  public static sampleModeWithGradient(
    bank: CymaticsModeBank | null | undefined,
    modeIndex: number,
    normalizedX: number,
    normalizedY: number,
    out: { val: number; gradX: number; gradY: number }
  ): void {
    if (!bank || !bank.fields || bank.modeCount === 0) {
      out.val = 0;
      out.gradX = 0;
      out.gradY = 0;
      return;
    }
    const mode = Math.min(Math.max(modeIndex, 0), bank.modeCount - 1);
    const grid = bank.gridSize;
    const field = bank.fields[mode];
    if (!field) {
      out.val = 0;
      out.gradX = 0;
      out.gradY = 0;
      return;
    }

    const x = Math.min(Math.max((normalizedX + 1) * 0.5 * (grid - 1), 0), grid - 1);
    const y = Math.min(Math.max((normalizedY + 1) * 0.5 * (grid - 1), 0), grid - 1);

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, grid - 1);
    const y1 = Math.min(y0 + 1, grid - 1);

    const tx = x - x0;
    const ty = y - y0;

    const row0 = y0 * grid;
    const row1 = y1 * grid;

    const f00 = field[row0 + x0];
    const f10 = field[row0 + x1];
    const f01 = field[row1 + x0];
    const f11 = field[row1 + x1];

    const a = f00 * (1 - tx) + f10 * tx;
    const b = f01 * (1 - tx) + f11 * tx;
    out.val = a * (1 - ty) + b * ty;

    // Gradient with respect to normalized domain coordinates
    const scale = (grid - 1) * 0.5;
    out.gradX = ((1 - ty) * (f10 - f00) + ty * (f11 - f01)) * scale;
    out.gradY = ((1 - tx) * (f01 - f00) + tx * (f11 - f10)) * scale;
  }

  /**
   * Tests whether normalized coordinate is inside the active geometry boundary
   */
  public static isInside(bank: CymaticsModeBank | null | undefined, normalizedX: number, normalizedY: number): boolean {
    if (!bank || !bank.mask) {
      return Math.abs(normalizedX) <= 0.88 && Math.abs(normalizedY) <= 0.88;
    }
    const grid = bank.gridSize;
    const x = Math.min(Math.max(Math.floor((normalizedX + 1) * 0.5 * (grid - 1)), 0), grid - 1);
    const y = Math.min(Math.max(Math.floor((normalizedY + 1) * 0.5 * (grid - 1)), 0), grid - 1);
    return bank.mask[y * grid + x] > 0.45;
  }

  /**
   * Computes complete physical metrics for current state
   */
  public static computeMetrics(state: CymaticsState, bank: CymaticsModeBank | null | undefined): CymaticsMetrics {
    if (!bank || !bank.eigenvalues || bank.modeCount === 0) {
      const defaultNat = 120;
      return {
        modeIndex: state.modeIndex || 0,
        naturalFrequencyHz: defaultNat,
        response: 0.5,
        coupling: 1.0,
        relativeDetuning: 0,
        flexuralRigidityNm: this.flexuralRigidity(state),
        normalizedAmplitude: 0.5,
        firstFrequencyHz: 60,
        lastFrequencyHz: 2400,
      };
    }

    const frequencies: number[] = [];
    for (let i = 0; i < bank.modeCount; i++) {
      frequencies.push(this.naturalFrequencyHz(state, bank.eigenvalues[i]));
    }

    let activeMode = state.modeIndex;
    if (state.automaticMode) {
      // Find mode that maximizes dynamic response multiplied by actuator coupling
      let maxScore = -1;
      let bestIndex = 0;
      for (let i = 0; i < frequencies.length; i++) {
        const coupling = Math.abs(this.sampleMode(bank, i, state.driveX, state.driveY));
        const resp = this.responseMagnitude(state.driveFrequencyHz, frequencies[i], state.dampingRatio);
        const score = resp * coupling;
        if (score > maxScore) {
          maxScore = score;
          bestIndex = i;
        }
      }
      activeMode = bestIndex;
    } else {
      activeMode = Math.min(Math.max(state.modeIndex, 0), frequencies.length - 1);
    }

    const naturalHz = frequencies[activeMode] || 120;
    const coupling = Math.min(Math.max(Math.abs(this.sampleMode(bank, activeMode, state.driveX, state.driveY)), 0), 1);
    const rawResponse = this.responseMagnitude(state.driveFrequencyHz, naturalHz, state.dampingRatio);
    const normalizedResponse = Math.min(Math.max(2.0 * state.dampingRatio * rawResponse, 0), 1);
    const amplitude = Math.min(Math.max(normalizedResponse * coupling * state.normalizedDrive, 0), 1);
    const detuning = naturalHz > 0 ? Math.abs(state.driveFrequencyHz - naturalHz) / naturalHz : 0;

    return {
      modeIndex: activeMode,
      naturalFrequencyHz: naturalHz,
      response: normalizedResponse,
      coupling,
      relativeDetuning: detuning,
      flexuralRigidityNm: this.flexuralRigidity(state),
      normalizedAmplitude: amplitude,
      firstFrequencyHz: frequencies[0] || 0,
      lastFrequencyHz: frequencies[frequencies.length - 1] || 0,
    };
  }

  /**
   * Decoupled perceptual oscillation frequency:
   * Maps physical frequency (20 Hz - 20,000 Hz) to an eye-safe, clear visual oscillation rate (0.2 Hz - 2.0 Hz)
   * avoiding unpleasant strobing/aliasing on 60 Hz screens.
   */
  public static visualCyclesPerSecond(frequencyHz: number, timeScale: number = 1.0): number {
    const clampedHz = Math.min(Math.max(frequencyHz, 20), 20000);
    const logPos = Math.log(clampedHz / 20) / Math.log(20000 / 20);
    const baseCycles = 0.35 + 0.55 * logPos;
    return Math.min(Math.max(baseCycles * timeScale, 0.05), 3.0);
  }
}
