/**
 * SonicLab 3D - Beamforming & Active Noise Cancellation (ANC) Physics Engine
 * Implements acoustic phased arrays, constructive/destructive wave interference,
 * and anti-phase cancellation zones.
 */

import { BeamformingState, SpeakerElement } from '../types/soniclab';

export interface BeamformingField {
  gridWidth: number;
  gridHeight: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  pressureData: Float32Array; // values between -1.0 and 1.0 (snapshot in time)
  intensityData: Float32Array; // RMS acoustic power
  directivityAnglesDeg: number[];
  directivityDb: number[];
}

export class BeamformingPhysics {
  public static readonly SPEED_OF_SOUND = 343.0; // m/s

  // Memory buffer caches to eliminate GC allocations at 60 FPS
  private static cachedPressure: Float32Array | null = null;
  private static cachedIntensity: Float32Array | null = null;
  private static cachedDirectivityKey: string = '';
  private static cachedAngles: number[] = [];
  private static cachedDb: number[] = [];

  /**
   * Initializes or updates speaker element positions along the line array
   */
  public static updateElements(
    count: number,
    spacingM: number,
    frequencyHz: number,
    steerAngleDeg: number
  ): SpeakerElement[] {
    const elements: SpeakerElement[] = [];
    const totalSpan = (count - 1) * spacingM;
    const startX = -totalSpan * 0.5;
    const k = (2.0 * Math.PI * frequencyHz) / this.SPEED_OF_SOUND;
    const steerRad = (steerAngleDeg * Math.PI) / 180.0;

    for (let i = 0; i < count; i++) {
      const posX = startX + i * spacingM;
      // Phase delay for steering: delta_phi = -k * d * sin(theta)
      const phaseRad = -k * posX * Math.sin(steerRad);
      const phaseDeg = (phaseRad * 180.0) / Math.PI;

      elements.push({
        id: i,
        posX,
        phaseShiftDeg: phaseDeg,
        amplitude: 1.0,
        active: true,
      });
    }

    return elements;
  }

  /**
   * Computes acoustic field in 2D space (x from -3m to +3m, y from 0.1m to 4.5m)
   */
  public static computeField(
    state: BeamformingState,
    timeSec: number,
    gridW: number = 80,
    gridH: number = 60
  ): BeamformingField {
    const minX = -3.0;
    const maxX = 3.0;
    const minY = 0.1;
    const maxY = 4.5;
    const cells = gridW * gridH;

    if (!this.cachedPressure || this.cachedPressure.length !== cells) {
      this.cachedPressure = new Float32Array(cells);
      this.cachedIntensity = new Float32Array(cells);
    }
    const pressureData = this.cachedPressure;
    const intensityData = this.cachedIntensity!;

    const f = Math.max(state.frequencyHz, 50);
    const omega = 2.0 * Math.PI * f;
    const k = omega / this.SPEED_OF_SOUND;

    const activeElements = state.elements.filter((e) => e.active);

    for (let gy = 0; gy < gridH; gy++) {
      const y = minY + (gy / (gridH - 1)) * (maxY - minY);
      for (let gx = 0; gx < gridW; gx++) {
        const x = minX + (gx / (gridW - 1)) * (maxX - minX);
        const idx = gy * gridW + gx;

        let totalReal = 0;
        let totalImag = 0;

        if (state.ancMode) {
          // --- ACTIVE NOISE CANCELLATION MODE ---
          // 1. Primary Noise Source at (noiseSourceDistanceM * sin(ang), noiseSourceDistanceM * cos(ang))
          const noiseRad = (state.noiseSourceAngleDeg * Math.PI) / 180;
          const noiseX = state.noiseSourceDistanceM * Math.sin(noiseRad);
          const noiseY = state.noiseSourceDistanceM * Math.cos(noiseRad);

          const rNoise = Math.hypot(x - noiseX, y - noiseY);
          const ampNoise = 1.0 / Math.max(rNoise, 0.2);
          const phaseNoise = -k * rNoise;

          totalReal += ampNoise * Math.cos(phaseNoise);
          totalImag += ampNoise * Math.sin(phaseNoise);

          // 2. Anti-Noise Speaker at origin (0, 0)
          const rAnti = Math.hypot(x, y);
          const ampAnti = (state.antiNoiseGain / Math.max(rAnti, 0.2));
          // Anti-noise is shifted by 180 deg + user fine-tuning phase
          const antiPhaseShiftRad = Math.PI + (state.antiNoisePhaseDeg * Math.PI) / 180;
          const phaseAnti = -k * rAnti + antiPhaseShiftRad;

          totalReal += ampAnti * Math.cos(phaseAnti);
          totalImag += ampAnti * Math.sin(phaseAnti);
        } else {
          // --- STANDARD PHASED ARRAY BEAMFORMING ---
          for (let i = 0; i < activeElements.length; i++) {
            const el = activeElements[i];
            const dx = x - el.posX;
            const dy = y; // array is at y = 0
            const r = Math.hypot(dx, dy);
            const geometricAtten = 1.0 / Math.max(r, 0.3);

            const elPhaseRad = (el.phaseShiftDeg * Math.PI) / 180.0;
            const phase = -k * r + elPhaseRad;

            totalReal += el.amplitude * geometricAtten * Math.cos(phase);
            totalImag += el.amplitude * geometricAtten * Math.sin(phase);
          }
        }

        // Instantaneous snapshot at time t
        const instantPressure = totalReal * Math.cos(omega * timeSec) - totalImag * Math.sin(omega * timeSec);
        const intensity = totalReal * totalReal + totalImag * totalImag;

        pressureData[idx] = instantPressure;
        intensityData[idx] = intensity;
      }
    }

    // Directivity polar pattern (cached when array geometry and steer angle are static)
    const directivityKey = `${state.ancMode}_${f.toFixed(1)}_${state.steeringAngleDeg}_${activeElements.length}_${activeElements.map(e => `${e.posX.toFixed(2)}_${e.phaseShiftDeg.toFixed(1)}_${e.amplitude.toFixed(2)}`).join(',')}`;

    let directivityAnglesDeg = this.cachedAngles;
    let directivityDb = this.cachedDb;

    if (this.cachedDirectivityKey !== directivityKey || this.cachedAngles.length === 0) {
      this.cachedDirectivityKey = directivityKey;
      directivityAnglesDeg = [];
      directivityDb = [];
      let maxIntensity = 1e-6;

      for (let deg = -90; deg <= 90; deg += 2) {
        const rad = (deg * Math.PI) / 180;
        let afReal = 0;
        let afImag = 0;

        for (let i = 0; i < activeElements.length; i++) {
          const el = activeElements[i];
          const spatialPhase = k * el.posX * Math.sin(rad) + (el.phaseShiftDeg * Math.PI) / 180;
          afReal += el.amplitude * Math.cos(spatialPhase);
          afImag += el.amplitude * Math.sin(spatialPhase);
        }

        const power = afReal * afReal + afImag * afImag;
        if (power > maxIntensity) maxIntensity = power;

        directivityAnglesDeg.push(deg);
        directivityDb.push(power);
      }

      // Convert directivity to normalized dB [-35 dB to 0 dB]
      for (let i = 0; i < directivityDb.length; i++) {
        const rel = directivityDb[i] / maxIntensity;
        const db = rel > 1e-4 ? 10 * Math.log10(rel) : -40;
        directivityDb[i] = Math.max(db, -35);
      }

      this.cachedAngles = directivityAnglesDeg;
      this.cachedDb = directivityDb;
    }

    return {
      gridWidth: gridW,
      gridHeight: gridH,
      minX,
      maxX,
      minY,
      maxY,
      pressureData,
      intensityData,
      directivityAnglesDeg,
      directivityDb,
    };
  }
}
