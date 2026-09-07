import { AcousticCalculations, AcousticsState } from "../types/soniclab";

/** Shared with the vertex shader: bounded Fourier series, pressure/displacement in quadrature. */
export function waveComponents(
  phase: number,
  s: AcousticsState,
): [number, number] {
  let pressure = 0,
    displacement = 0;
  if (s.harmonicMode) {
    for (let i = 0; i < 4; i++) {
      pressure += s.harmonics[i] * Math.sin((i + 1) * phase);
      displacement += (s.harmonics[i] * Math.cos((i + 1) * phase)) / (i + 1);
    }
  } else if (s.waveform === "sine") {
    return [Math.sin(phase), Math.cos(phase)];
  } else {
    for (let i = 0; i < 4; i++) {
      const n = 2 * i + 1;
      const gain =
        s.waveform === "triangle"
          ? ((i % 2 ? -1 : 1) * 8) / (Math.PI ** 2 * n ** 2)
          : s.waveform === "square"
            ? 4 / (Math.PI * n)
            : 0.25;
      pressure += gain * Math.sin(n * phase);
      displacement += (gain * Math.cos(n * phase)) / n;
    }
  }
  return [pressure, displacement];
}

export function envelope(radius: number, attenuation: number) {
  return (
    (Math.sqrt(1.04) / Math.sqrt(radius * radius + 0.04)) *
    Math.exp((-attenuation / 8.685889638) * Math.max(radius - 1, 0))
  );
}

/** Physical values have no visual exaggeration. time is slowed simulation time, in seconds. */
export function fieldSample(
  x: number,
  y: number,
  z: number,
  time: number,
  s: AcousticsState,
  c: AcousticCalculations,
) {
  const r = Math.hypot(x, y, z),
    env = envelope(r, c.attenuationDbPerM);
  const [p, d] = waveComponents(
    c.waveNumberK * r - c.angularFrequencyOmega * time,
    s,
  );
  const amp =
    c.pressurePeakPa /
    Math.max(
      c.airDensityKgM3 * c.soundSpeedMps * c.angularFrequencyOmega,
      1e-12,
    );
  let pressure = p * c.pressurePeakPa * env;
  let dx = r > 1e-6 ? (x / r) * d * amp * env : 0;
  let dy = r > 1e-6 ? (y / r) * d * amp * env : 0;
  let dz = r > 1e-6 ? (z / r) * d * amp * env : 0;
  if (s.secondarySourceEnabled) {
    const bx = x - s.secondaryDistanceM,
      br = Math.hypot(bx, y, z);
    const omega = 2 * Math.PI * s.secondaryFrequencyHz;
    const phase =
      (omega / c.soundSpeedMps) * br - omega * time + s.secondaryPhaseRad;
    const benv = envelope(br, c.attenuationDbPerM);
    pressure += c.pressurePeakPa * benv * Math.sin(phase);
    const bd =
      (c.pressurePeakPa * benv * Math.cos(phase)) /
      Math.max(c.airDensityKgM3 * c.soundSpeedMps * omega, 1e-12);
    if (br > 1e-6) {
      dx += (bx / br) * bd;
      dy += (y / br) * bd;
      dz += (z / br) * bd;
    }
  }
  return { pressure, dx, dy, dz };
}
