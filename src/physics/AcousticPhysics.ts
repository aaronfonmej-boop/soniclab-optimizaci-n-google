/**
 * SonicLab 3D - Acoustic Air Physics Engine
 * Implements longitudinal wave propagation, pressure fields, particle displacement,
 * and atmospheric acoustic physics (ISO 9613-1).
 */

import { AcousticCalculations, AcousticsState } from '../types/soniclab';

export class AcousticPhysics {
  public static readonly REFERENCE_PRESSURE_PA = 20e-6; // 20 microPascals

  /**
   * Speed of sound in air as a function of temperature (Celsius):
   * c = 331.3 + 0.606 * T
   */
  public static soundSpeedMps(temperatureC: number): number {
    return 331.3 + 0.606 * temperatureC;
  }

  /**
   * Wavelength lambda = c / f
   */
  public static wavelengthM(soundSpeed: number, frequencyHz: number): number {
    if (frequencyHz <= 0) return 0;
    return soundSpeed / frequencyHz;
  }

  /**
   * Period T in milliseconds = 1000 / f
   */
  public static periodMs(frequencyHz: number): number {
    if (frequencyHz <= 0) return 0;
    return 1000.0 / frequencyHz;
  }

  /**
   * Angular frequency omega = 2 * pi * f
   */
  public static angularFrequency(frequencyHz: number): number {
    return 2.0 * Math.PI * frequencyHz;
  }

  /**
   * Wave number k = 2 * pi / lambda
   */
  public static waveNumber(wavelengthM: number): number {
    if (wavelengthM <= 0) return 0;
    return (2.0 * Math.PI) / wavelengthM;
  }

  /**
   * RMS sound pressure in Pascals: p_rms = p_ref * 10^(SPL / 20)
   */
  public static soundPressureRmsPa(levelDbSpl: number): number {
    return this.REFERENCE_PRESSURE_PA * Math.pow(10, levelDbSpl / 20.0);
  }

  /**
   * Peak sound pressure in Pascals: p_peak = p_rms * sqrt(2)
   */
  public static soundPressurePeakPa(levelDbSpl: number): number {
    return this.soundPressureRmsPa(levelDbSpl) * Math.SQRT2;
  }

  /**
   * Dry/moist air density approximation (kg/m^3)
   */
  public static airDensityKgM3(
    temperatureC: number,
    humidityPercent: number,
    pressureKPa: number
  ): number {
    const tempK = temperatureC + 273.15;
    const totalPressurePa = pressureKPa * 1000.0;
    const satVaporPa = 610.94 * Math.exp((17.625 * temperatureC) / (temperatureC + 243.04));
    const vaporPressurePa =
      (Math.min(Math.max(humidityPercent, 0), 100) / 100.0) *
      Math.min(satVaporPa, totalPressurePa * 0.2);
    const dryPressurePa = totalPressurePa - vaporPressurePa;
    return dryPressurePa / (287.058 * tempK) + vaporPressurePa / (461.495 * tempK);
  }

  /**
   * Atmospheric absorption attenuation in dB/m (simplified ISO 9613-1)
   */
  public static atmosphericAbsorptionDbPerM(frequencyHz: number, temperatureC: number): number {
    const f = Math.max(frequencyHz, 20);
    // Typical absorption coefficient across audible spectrum
    return 1.5e-4 * Math.pow(f / 1000, 1.4) * (1 + (temperatureC - 20) * 0.01);
  }

  /**
   * Computes comprehensive acoustic calculations for the current laboratory state
   */
  public static calculate(state: AcousticsState): AcousticCalculations {
    const c = this.soundSpeedMps(state.temperatureC);
    const lambda = this.wavelengthM(c, state.frequencyHz);
    const period = this.periodMs(state.frequencyHz);
    const k = this.waveNumber(lambda);
    const omega = this.angularFrequency(state.frequencyHz);
    const pRms = this.soundPressureRmsPa(state.levelDbSpl);
    const pPeak = this.soundPressurePeakPa(state.levelDbSpl);
    const density = this.airDensityKgM3(
      state.temperatureC,
      state.humidityPercent,
      state.atmosphericPressureKPa
    );
    const attenuation = this.atmosphericAbsorptionDbPerM(state.frequencyHz, state.temperatureC);

    return {
      soundSpeedMps: c,
      wavelengthM: lambda,
      periodMs: period,
      waveNumberK: k,
      angularFrequencyOmega: omega,
      pressureRmsPa: pRms,
      pressurePeakPa: pPeak,
      airDensityKgM3: density,
      attenuationDbPerM: attenuation,
    };
  }

  /**
   * Longitudinal displacement of an air particle with equilibrium position x0:
   * xi(x0, t) = xi_max * sin(omega * t - k * x0)
   * If harmonics or secondary interference are enabled, superimposes them linearly.
   */
  public static sampleDisplacement(
    x0: number,
    t: number,
    state: AcousticsState,
    calcs: AcousticCalculations
  ): number {
    const k1 = calcs.waveNumberK;
    const omega1 = calcs.angularFrequencyOmega;
    const baseAmp = 0.05 * state.visualExaggeration;

    let totalDisplacement = 0;

    if (!state.harmonicMode) {
      // Single pure tone
      totalDisplacement = baseAmp * Math.sin(omega1 * t - k1 * x0);
    } else {
      // Harmonics sum
      const [h1, h2, h3, h4] = state.harmonics;
      const sumH = Math.max(h1 + h2 + h3 + h4, 0.001);
      totalDisplacement += (baseAmp * (h1 / sumH)) * Math.sin(omega1 * t - k1 * x0);
      totalDisplacement += (baseAmp * (h2 / sumH)) * Math.sin(2 * omega1 * t - 2 * k1 * x0);
      totalDisplacement += (baseAmp * (h3 / sumH)) * Math.sin(3 * omega1 * t - 3 * k1 * x0);
      totalDisplacement += (baseAmp * (h4 / sumH)) * Math.sin(4 * omega1 * t - 4 * k1 * x0);
    }

    // Secondary source interference
    if (state.secondarySourceEnabled) {
      const c = calcs.soundSpeedMps;
      const f2 = state.secondaryFrequencyHz;
      const k2 = (2 * Math.PI * f2) / c;
      const omega2 = 2 * Math.PI * f2;
      const dist2 = Math.abs(x0 - state.secondaryDistanceM);
      const secondaryAmp = baseAmp * 0.75;
      totalDisplacement += secondaryAmp * Math.sin(omega2 * t - k2 * dist2 + state.secondaryPhaseRad);
    }

    return totalDisplacement;
  }

  /**
   * Acoustic pressure perturbation delta P(x0, t):
   * Acoustic pressure is proportional to the negative spatial derivative of displacement:
   * delta P = - rho * c^2 * (d xi / d x)
   * This is in 90 degree phase quadrature with displacement!
   */
  public static samplePressurePerturbation(
    x0: number,
    t: number,
    state: AcousticsState,
    calcs: AcousticCalculations
  ): number {
    const dx = 0.01;
    const xi1 = this.sampleDisplacement(x0 - dx, t, state, calcs);
    const xi2 = this.sampleDisplacement(x0 + dx, t, state, calcs);
    const strain = (xi2 - xi1) / (2 * dx);
    return -strain; // Normalized pressure perturbation (-1 to +1)
  }
}
