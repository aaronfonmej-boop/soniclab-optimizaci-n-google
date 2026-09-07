/**
 * SonicLab 3D - Scientific Exporters Utility
 * Supports 3D CAD/3D Printing models (STL, OBJ) and scientific data formats (CSV, JSON)
 */

import { AcousticCalculations, CymaticsMetrics, CymaticsModeBank, CymaticsState } from '../types/soniclab';

/**
 * Downloads arbitrary text/blob data as a file in the browser
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates an ASCII STL file of the 3D deformed Chladni plate with thickness
 * Suitable for direct 3D printing or importing into CAD (Fusion 360, Blender, SolidWorks)
 */
export function exportPlateSTL(
  bank: CymaticsModeBank | null,
  modeIndex: number,
  state: CymaticsState,
  reliefScaleMm: number = 6.0,
  baseThicknessMm: number = 3.0
): void {
  if (!bank || !bank.fields || bank.fields.length === 0) {
    alert('No hay banco modal cargado para exportar.');
    return;
  }

  const mode = Math.min(Math.max(modeIndex, 0), bank.modeCount - 1);
  const field = bank.fields[mode];
  const grid = bank.gridSize; // 64
  const plateSizeMm = state.characteristicSizeM * 1000;
  const stepMm = plateSizeMm / (grid - 1);

  let stl = `solid SonicLab_Chladni_Mode_${mode + 1}_${state.geometry}\n`;

  const getZ = (gx: number, gy: number): number => {
    const val = field[gy * grid + gx] || 0;
    return baseThicknessMm + val * reliefScaleMm;
  };

  const getPos = (gx: number, gy: number, isBottom: boolean = false): [number, number, number] => {
    const x = (gx - (grid - 1) * 0.5) * stepMm;
    const y = (gy - (grid - 1) * 0.5) * stepMm;
    const z = isBottom ? 0 : getZ(gx, gy);
    return [x, y, z];
  };

  const writeTriangle = (
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number]
  ) => {
    // Normal vector calculation
    const ax = p2[0] - p1[0];
    const ay = p2[1] - p1[1];
    const az = p2[2] - p1[2];
    const bx = p3[0] - p1[0];
    const by = p3[1] - p1[1];
    const bz = p3[2] - p1[2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    stl += `  facet normal ${(nx / len).toFixed(4)} ${(ny / len).toFixed(4)} ${(nz / len).toFixed(4)}\n`;
    stl += `    outer loop\n`;
    stl += `      vertex ${p1[0].toFixed(3)} ${p1[1].toFixed(3)} ${p1[2].toFixed(3)}\n`;
    stl += `      vertex ${p2[0].toFixed(3)} ${p2[1].toFixed(3)} ${p2[2].toFixed(3)}\n`;
    stl += `      vertex ${p3[0].toFixed(3)} ${p3[1].toFixed(3)} ${p3[2].toFixed(3)}\n`;
    stl += `    endloop\n`;
    stl += `  endfacet\n`;
  };

  // Build top and bottom surface meshes
  for (let y = 0; y < grid - 1; y++) {
    for (let x = 0; x < grid - 1; x++) {
      // Check mask if not square
      if (bank.mask) {
        if (bank.mask[y * grid + x] < 0.3) continue;
      }

      const pTop00 = getPos(x, y, false);
      const pTop10 = getPos(x + 1, y, false);
      const pTop01 = getPos(x, y + 1, false);
      const pTop11 = getPos(x + 1, y + 1, false);

      // Top surface (CCW)
      writeTriangle(pTop00, pTop10, pTop11);
      writeTriangle(pTop00, pTop11, pTop01);

      // Bottom surface (CW so normal points down)
      const pBot00 = getPos(x, y, true);
      const pBot10 = getPos(x + 1, y, true);
      const pBot01 = getPos(x, y + 1, true);
      const pBot11 = getPos(x + 1, y + 1, true);

      writeTriangle(pBot00, pBot11, pBot10);
      writeTriangle(pBot00, pBot01, pBot11);
    }
  }

  // Build boundary walls around perimeter
  for (let x = 0; x < grid - 1; x++) {
    // Bottom edge (y = 0)
    writeTriangle(getPos(x, 0, true), getPos(x + 1, 0, true), getPos(x + 1, 0, false));
    writeTriangle(getPos(x, 0, true), getPos(x + 1, 0, false), getPos(x, 0, false));
    // Top edge (y = grid - 1)
    writeTriangle(getPos(x, grid - 1, true), getPos(x, grid - 1, false), getPos(x + 1, grid - 1, false));
    writeTriangle(getPos(x, grid - 1, true), getPos(x + 1, grid - 1, false), getPos(x + 1, grid - 1, true));
  }

  for (let y = 0; y < grid - 1; y++) {
    // Left edge (x = 0)
    writeTriangle(getPos(0, y, true), getPos(0, y, false), getPos(0, y + 1, false));
    writeTriangle(getPos(0, y, true), getPos(0, y + 1, false), getPos(0, y + 1, true));
    // Right edge (x = grid - 1)
    writeTriangle(getPos(grid - 1, y, true), getPos(grid - 1, y + 1, false), getPos(grid - 1, y, false));
    writeTriangle(getPos(grid - 1, y, true), getPos(grid - 1, y + 1, true), getPos(grid - 1, y + 1, false));
  }

  stl += `endsolid SonicLab_Chladni_Mode_${mode + 1}_${state.geometry}\n`;

  const blob = new Blob([stl], { type: 'model/stl' });
  triggerDownload(blob, `soniclab_chladni_modo_${mode + 1}_${state.geometry}.stl`);
}

/**
 * Generates an OBJ 3D model
 */
export function exportPlateOBJ(
  bank: CymaticsModeBank | null,
  modeIndex: number,
  state: CymaticsState
): void {
  if (!bank || !bank.fields || bank.fields.length === 0) return;

  const mode = Math.min(Math.max(modeIndex, 0), bank.modeCount - 1);
  const field = bank.fields[mode];
  const grid = bank.gridSize;
  const plateSizeM = state.characteristicSizeM;
  const step = plateSizeM / (grid - 1);

  let obj = `# SonicLab 3D OBJ Export\n# Modo ${mode + 1} (${state.geometry}, ${state.boundary})\no ChladniPlate\n`;

  // Vertices
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const vx = (x - (grid - 1) * 0.5) * step;
      const vy = (y - (grid - 1) * 0.5) * step;
      const vz = (field[y * grid + x] || 0) * 0.015; // 15 mm relief
      obj += `v ${vx.toFixed(5)} ${vz.toFixed(5)} ${vy.toFixed(5)}\n`;
    }
  }

  // Faces (1-indexed)
  for (let y = 0; y < grid - 1; y++) {
    for (let x = 0; x < grid - 1; x++) {
      const i00 = y * grid + x + 1;
      const i10 = y * grid + (x + 1) + 1;
      const i01 = (y + 1) * grid + x + 1;
      const i11 = (y + 1) * grid + (x + 1) + 1;
      obj += `f ${i00} ${i10} ${i11}\n`;
      obj += `f ${i00} ${i11} ${i01}\n`;
    }
  }

  const blob = new Blob([obj], { type: 'model/obj' });
  triggerDownload(blob, `soniclab_chladni_modo_${mode + 1}.obj`);
}

/**
 * Exports complete telemetry & calculation data as CSV for Excel / MATLAB
 */
export function exportTelemetryCSV(
  metrics: CymaticsMetrics,
  cymState: CymaticsState,
  calcs: AcousticCalculations
): void {
  const timestamp = new Date().toISOString();
  let csv = `sep=,\n`;
  csv += `PARAMETRO,VALOR,UNIDAD,DESCRIPCION\n`;
  csv += `Fecha y Hora,${timestamp},ISO,Registro de laboratorio\n`;
  csv += `Geometria Placa,${cymState.geometry},adimensional,Geometria de la placa de Chladni\n`;
  csv += `Condicion de Borde,${cymState.boundary},adimensional,Fijacion de los bordes\n`;
  csv += `Modo Activo,${metrics.modeIndex + 1},entero,Indice del modo propio de vibracion\n`;
  csv += `Frecuencia Excitacion,${cymState.driveFrequencyHz.toFixed(2)},Hz,Frecuencia del actuador mecanico\n`;
  csv += `Frecuencia Natural Modo,${metrics.naturalFrequencyHz.toFixed(2)},Hz,Resonancia teorica Kirchhoff-Love\n`;
  csv += `Desintonizacion Relativa,${(metrics.relativeDetuning * 100).toFixed(2)},%,Error relativo abs(f_drive - f_nat)/f_nat\n`;
  csv += `Magnitud de Respuesta H(r),${metrics.response.toFixed(4)},adimensional,Factor dinamico de amplificacion\n`;
  csv += `Acoplamiento Espacial,${metrics.coupling.toFixed(4)},adimensional,Amplitud del modo en el punto del actuador\n`;
  csv += `Rigidez a la Flexion (D),${metrics.flexuralRigidityNm.toExponential(4)},N*m,Rigidez segun espesor y modulo Young\n`;
  csv += `Modulo de Young (E),${(cymState.youngModulusPa / 1e9).toFixed(1)},GPa,Elasticidad del material\n`;
  csv += `Densidad del Material (rho),${cymState.densityKgM3.toFixed(0)},kg/m^3,Densidad volumetrica\n`;
  csv += `Espesor de Placa (h),${(cymState.thicknessM * 1000).toFixed(2)},mm,Espesor de la chapa metalica\n`;
  csv += `Particulas de Arena,${cymState.sandParticleCount},unidades,Numero de particulas simuladas\n`;
  csv += `\n`;
  csv += `ACUSTICA DEL AIRE (ISO 9613-1),,,,\n`;
  csv += `Velocidad del Sonido (c),${calcs.soundSpeedMps.toFixed(2)},m/s,Velocidad de propagacion a temperatura ambiente\n`;
  csv += `Longitud de Onda (lambda),${calcs.wavelengthM.toFixed(4)},m,Distancia espacial entre frentes de onda\n`;
  csv += `Periodo (T),${calcs.periodMs.toFixed(3)},ms,Periodo temporal de oscilacion\n`;
  csv += `Numero de Onda (k),${calcs.waveNumberK.toFixed(3)},rad/m,Constante de propagacion espacial\n`;
  csv += `Presion Acustica RMS,${calcs.pressureRmsPa.toFixed(4)},Pa,Presion sonora eficaz\n`;
  csv += `Presion Acustica Pico,${calcs.pressurePeakPa.toFixed(4)},Pa,Presion sonora maxima\n`;
  csv += `Densidad del Aire,${calcs.airDensityKgM3.toFixed(4)},kg/m^3,Densidad del medio a presion y humedad dada\n`;
  csv += `Atenuacion Atmosferica,${calcs.attenuationDbPerM.toFixed(6)},dB/m,Perdida de energia por absorcion\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `soniclab_telemetria_${Date.now()}.csv`);
}
