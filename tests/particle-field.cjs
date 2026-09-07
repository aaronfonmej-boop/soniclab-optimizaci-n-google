const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
};
const {
  fieldSample,
  waveComponents,
} = require("../src/physics/ParticleField.ts");
const { AcousticPhysics } = require("../src/physics/AcousticPhysics.ts");
const s = {
  frequencyHz: 343,
  levelDbSpl: 75,
  temperatureC: 20,
  humidityPercent: 50,
  atmosphericPressureKPa: 101.325,
  waveform: "sine",
  harmonicMode: false,
  harmonics: [1, 0, 0, 0],
  visualExaggeration: 4,
  secondarySourceEnabled: false,
  secondaryFrequencyHz: 347,
  secondaryDistanceM: 1.5,
  secondaryPhaseRad: 0,
};
const c = AcousticPhysics.calculate(s);
const close = (a, b, tolerance = 1e-10) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
let sum = 0;
for (let i = 0; i < 1024; i++) {
  const p = fieldSample(1, 0, 0, i / (1024 * s.frequencyHz), s, c);
  sum += p.pressure ** 2;
}
close(Math.sqrt(sum / 1024), c.pressureRmsPa);
const a = fieldSample(1, 2, 0, 0.001, s, c),
  b = fieldSample(1, 2, 0, 0.001, { ...s, visualExaggeration: 100 }, c);
assert.deepEqual(a, b); // Visual scale cannot contaminate physical telemetry.
const radial = fieldSample(1, 2, 3, 0.001, s, c);
close(radial.dy, 2 * radial.dx);
close(radial.dz, 3 * radial.dx);
for (const waveform of ["sine", "triangle", "square", "pulse"]) {
  for (const t of [0, 0.001, 2]) {
    const p = fieldSample(0, 0, 0, t, { ...s, waveform }, c);
    assert.ok(Object.values(p).every(Number.isFinite));
  }
}
const cancel = {
  ...s,
  secondarySourceEnabled: true,
  secondaryDistanceM: 0,
  secondaryFrequencyHz: s.frequencyHz,
  secondaryPhaseRad: Math.PI,
};
const zero = fieldSample(1, 0, 0, 0.001, cancel, c);
close(zero.pressure, 0);
close(zero.dx, 0);
close(
  waveComponents(0, { ...s, harmonicMode: true, harmonics: [0, 1, 0, 0] })[1],
  0.5,
);
console.log(
  "PASS: RMS at 1 m, physical/visual separation, radial displacement, finite source, destructive interference, harmonic integration",
);
