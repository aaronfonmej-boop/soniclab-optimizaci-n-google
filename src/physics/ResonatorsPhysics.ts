/**
 * SonicLab 3D - Classic Acoustic Resonators Physics
 * Implements Kundt's Tube (standing waves & cork dust striations)
 * and Helmholtz Resonator (acoustic mass-spring system & cavity impedance).
 */

import { HelmholtzState, KundtState } from '../types/soniclab';

export interface KundtCalculations {
  soundSpeedMps: number;
  wavelengthM: number;
  resonantHarmonicsHz: number[];
  activeHarmonicN: number;
  nearestResonanceHz: number;
  isNearResonance: boolean;
  pressureNodesX: number[]; // Positions along tube [0, L]
  velocityNodesX: number[]; // Positions where cork dust accumulates
}

export interface HelmholtzCalculations {
  soundSpeedMps: number;
  effectiveNeckLengthM: number;
  neckAreaM2: number;
  cavityVolumeM3: number;
  resonantFrequencyHz: number;
  acousticMassKgM4: number; // M_a = rho * L' / S
  acousticComplianceM5N: number; // C_a = V / (rho * c^2)
  qualityFactorQ: number;
  responseMagnitude: number;
  phaseShiftDeg: number;
}

export class ResonatorsPhysics {
  /**
   * Sound speed in different media as a function of temperature
   */
  public static gasSpeedOfSound(gas: 'air' | 'helium' | 'co2' | 'sf6', tempC: number): number {
    const tempK = tempC + 273.15;
    // c = sqrt(gamma * R_specific * T)
    switch (gas) {
      case 'helium':
        return 1007 * Math.sqrt(tempK / 293.15);
      case 'co2':
        return 267 * Math.sqrt(tempK / 293.15);
      case 'sf6':
        return 152 * Math.sqrt(tempK / 293.15);
      case 'air':
      default:
        return 331.3 + 0.606 * tempC;
    }
  }

  /**
   * Calculates Kundt's tube standing wave properties
   */
  public static calculateKundt(state: KundtState): KundtCalculations {
    const c = this.gasSpeedOfSound(state.gasType, state.temperatureC);
    const L = Math.max(state.lengthM, 0.2);
    const f = Math.max(state.frequencyHz, 20);

    const harmonics: number[] = [];
    if (state.tubeBoundary === 'open_closed') {
      // Quarter-wave harmonics: f_n = (2n - 1) * c / (4 * L)
      for (let n = 1; n <= 10; n++) {
        harmonics.push(((2 * n - 1) * c) / (4 * L));
      }
    } else {
      // Half-wave harmonics (open-open or closed-closed): f_n = n * c / (2 * L)
      for (let n = 1; n <= 10; n++) {
        harmonics.push((n * c) / (2 * L));
      }
    }

    // Find closest resonance
    let minDiff = Infinity;
    let nearestRes = harmonics[0];
    let activeN = 1;
    for (let i = 0; i < harmonics.length; i++) {
      const diff = Math.abs(f - harmonics[i]);
      if (diff < minDiff) {
        minDiff = diff;
        nearestRes = harmonics[i];
        activeN = i + 1;
      }
    }

    const isNearResonance = minDiff < nearestRes * 0.08; // within 8% of resonance

    // Calculate node and antinode positions along tube length L
    const lambda = c / f;
    const velocityNodes: number[] = [];
    const pressureNodes: number[] = [];

    // Depending on boundary conditions:
    if (state.tubeBoundary === 'closed_closed') {
      // Closed ends are velocity nodes (dust piles up at x = 0, L, and multiples of lambda/2)
      for (let x = 0; x <= L + 1e-4; x += lambda / 2) {
        velocityNodes.push(x);
      }
      for (let x = lambda / 4; x <= L; x += lambda / 2) {
        pressureNodes.push(x);
      }
    } else if (state.tubeBoundary === 'open_closed') {
      // Closed end at x = L is a velocity node; open end at x = 0 is a pressure node
      // Velocity nodes at x = L, L - lambda/2, ...
      for (let x = L; x >= 0; x -= lambda / 2) {
        velocityNodes.push(x);
      }
      for (let x = 0; x <= L; x += lambda / 2) {
        pressureNodes.push(x);
      }
    } else {
      // open_open: ends are pressure nodes, middle has velocity nodes
      for (let x = lambda / 4; x <= L; x += lambda / 2) {
        velocityNodes.push(x);
      }
      for (let x = 0; x <= L + 1e-4; x += lambda / 2) {
        pressureNodes.push(x);
      }
    }

    return {
      soundSpeedMps: c,
      wavelengthM: lambda,
      resonantHarmonicsHz: harmonics,
      activeHarmonicN: activeN,
      nearestResonanceHz: nearestRes,
      isNearResonance,
      pressureNodesX: pressureNodes,
      velocityNodesX: velocityNodes,
    };
  }

  /**
   * Calculates Helmholtz resonator acoustic resonance and impedance
   * f_H = (c / (2 * pi)) * sqrt(S / (V * L'))
   */
  public static calculateHelmholtz(state: HelmholtzState): HelmholtzCalculations {
    const c = this.gasSpeedOfSound('air', state.temperatureC);
    const r = Math.max(state.neckRadiusCm / 100, 0.003); // in meters
    const S = Math.PI * r * r;
    const L = Math.max(state.neckLengthCm / 100, 0.005); // in meters
    const V = Math.max(state.cavityVolumeLiters / 1000, 0.0001); // in m^3

    // End correction for flanged or unflanged neck: delta_L ~ 1.7 * r
    const L_prime = L + 1.7 * r;

    // Resonant frequency in Hz
    const f_H = (c / (2 * Math.PI)) * Math.sqrt(S / (V * L_prime));

    const rho = 1.2; // kg/m^3
    const acousticMass = (rho * L_prime) / S;
    const acousticCompliance = V / (rho * c * c);

    const Q = Math.max(1.0 / (2.0 * Math.max(state.damping, 0.01)), 2.0);

    // Dynamic magnification H(r)
    const r_ratio = state.driveFrequencyHz / f_H;
    const zeta = Math.max(state.damping, 0.02);
    const denom = Math.sqrt(Math.pow(1 - r_ratio * r_ratio, 2) + Math.pow(2 * zeta * r_ratio, 2));
    const response = denom > 0 ? 1 / denom : 0;

    const phaseRad = Math.atan2(2 * zeta * r_ratio, 1 - r_ratio * r_ratio);
    const phaseDeg = (phaseRad * 180) / Math.PI;

    return {
      soundSpeedMps: c,
      effectiveNeckLengthM: L_prime,
      neckAreaM2: S,
      cavityVolumeM3: V,
      resonantFrequencyHz: f_H,
      acousticMassKgM4: acousticMass,
      acousticComplianceM5N: acousticCompliance,
      qualityFactorQ: Q,
      responseMagnitude: response,
      phaseShiftDeg: phaseDeg,
    };
  }
}
