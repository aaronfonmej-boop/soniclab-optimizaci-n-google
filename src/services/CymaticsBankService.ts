/**
 * SonicLab 3D - Cymatics Mode Bank Service
 * Decodes native binary .cym (CYM8 format) modal files from assets/cymatics
 * and provides analytical fallback generators.
 */

import { CymaticsModeBank, PlateBoundary, PlateGeometry } from '../types/soniclab';

export class CymaticsBankService {
  private static cache: Map<string, CymaticsModeBank> = new Map();

  /**
   * Loads or retrieves a cached modal bank
   */
  public static async loadBank(
    geometry: PlateGeometry,
    boundary: PlateBoundary
  ): Promise<CymaticsModeBank> {
    const key = `${geometry}_${boundary}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const response = await fetch(`/cymatics/${key}.cym`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} loading modal bank ${key}`);
      }
      const buffer = await response.arrayBuffer();
      const bank = this.decodeCYM8(buffer, geometry, boundary);
      this.cache.set(key, bank);
      return bank;
    } catch (err) {
      console.warn(`Could not fetch /cymatics/${key}.cym, using analytical generation:`, err);
      const fallback = this.generateAnalyticalBank(geometry, boundary);
      this.cache.set(key, fallback);
      return fallback;
    }
  }

  /**
   * Decodes CYM8 big-endian binary bank
   */
  private static decodeCYM8(
    buffer: ArrayBuffer,
    geometry: PlateGeometry,
    boundary: PlateBoundary
  ): CymaticsModeBank {
    const view = new DataView(buffer);

    // Check magic 'CYM8'
    const magic = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    if (magic !== 'CYM8') {
      throw new Error(`Invalid magic header: expected CYM8, got ${magic}`);
    }

    const version = view.getInt32(4, false); // big-endian
    const gridSize = view.getInt32(8, false);
    const modeCount = view.getInt32(12, false);
    const geometryOrdinal = view.getInt32(16, false);
    const boundaryOrdinal = view.getInt32(20, false);

    let offset = 24;

    // Read eigenvalues (modeCount floats)
    const eigenvalues = new Float32Array(modeCount);
    for (let i = 0; i < modeCount; i++) {
      eigenvalues[i] = view.getFloat32(offset, false);
      offset += 4;
    }

    // Read mask (gridSize * gridSize floats)
    const cells = gridSize * gridSize;
    const mask = new Float32Array(cells);
    for (let i = 0; i < cells; i++) {
      mask[i] = view.getFloat32(offset, false);
      offset += 4;
    }

    // Read fields (modeCount * cells floats)
    const fields: Float32Array[] = [];
    for (let m = 0; m < modeCount; m++) {
      const modeField = new Float32Array(cells);
      for (let i = 0; i < cells; i++) {
        modeField[i] = view.getFloat32(offset, false);
        offset += 4;
      }
      fields.push(modeField);
    }

    return {
      gridSize,
      modeCount,
      geometry,
      boundary,
      eigenvalues,
      mask,
      fields,
    };
  }

  /**
   * Generates a scientific analytical modal bank when offline or fallback is needed
   */
  public static generateAnalyticalBank(
    geometry: PlateGeometry,
    boundary: PlateBoundary
  ): CymaticsModeBank {
    const gridSize = 64;
    const modeCount = 24;
    const cells = gridSize * gridSize;
    const mask = new Float32Array(cells);
    const eigenvalues = new Float32Array(modeCount);
    const fields: Float32Array[] = [];

    // Calculate boundary mask
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const nx = (x / (gridSize - 1)) * 2 - 1; // -1 to +1
        const ny = (y / (gridSize - 1)) * 2 - 1;
        const idx = y * gridSize + x;

        let inside = false;
        if (geometry === 'square') {
          inside = Math.abs(nx) <= 0.88 && Math.abs(ny) <= 0.88;
        } else if (geometry === 'circle') {
          inside = nx * nx + ny * ny <= 0.82 * 0.82;
        } else if (geometry === 'triangle') {
          // Equilateral triangle
          const h = 0.85;
          const yShift = ny + 0.25;
          inside = yShift >= -h * 0.5 && yShift <= h && Math.abs(nx) <= (h - yShift) / Math.sqrt(3);
        } else if (geometry === 'hexagon') {
          const r = 0.85;
          const qx = Math.abs(nx);
          const qy = Math.abs(ny);
          inside = qx <= r && qy <= (r * Math.sqrt(3)) / 2 && qx + qy / Math.sqrt(3) <= r;
        }
        mask[idx] = inside ? 1.0 : 0.0;
      }
    }

    // Generate 24 modes with analytical harmonic modal wave patterns
    const modePairs: [number, number][] = [
      [1, 1], [1, 2], [2, 1], [2, 2],
      [1, 3], [3, 1], [2, 3], [3, 2],
      [3, 3], [1, 4], [4, 1], [2, 4],
      [4, 2], [3, 4], [4, 3], [4, 4],
      [1, 5], [5, 1], [2, 5], [5, 2],
      [3, 5], [5, 3], [4, 5], [5, 4],
    ];

    for (let mIdx = 0; mIdx < modeCount; mIdx++) {
      const [m, n] = modePairs[mIdx] || [mIdx + 1, mIdx + 1];
      const baseEigen = Math.pow((Math.PI / 1.8), 4) * Math.pow(m * m + n * n, 2);
      const boundaryFactor = boundary === 'clamped' ? 2.2 : 1.0;
      eigenvalues[mIdx] = baseEigen * boundaryFactor;

      const field = new Float32Array(cells);
      let maxAbs = 0.0001;

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const idx = y * gridSize + x;
          if (mask[idx] <= 0.1) {
            field[idx] = 0;
            continue;
          }
          const nx = (x / (gridSize - 1)) * 2 - 1;
          const ny = (y / (gridSize - 1)) * 2 - 1;

          let val = 0;
          if (geometry === 'square') {
            // Chladni modal pattern: w = a * sin(m pi x) * sin(n pi y) + b * sin(n pi x) * sin(m pi y)
            const u = ((nx / 0.88 + 1) * 0.5) * Math.PI;
            const v = ((ny / 0.88 + 1) * 0.5) * Math.PI;
            val = Math.sin(m * u) * Math.sin(n * v) + 0.35 * Math.sin(n * u) * Math.sin(m * v);
          } else if (geometry === 'circle') {
            // Bessel-like circular modes
            const r = Math.sqrt(nx * nx + ny * ny) / 0.82;
            const theta = Math.atan2(ny, nx);
            const radial = Math.sin(m * Math.PI * r);
            const angular = Math.cos(n * theta);
            val = radial * angular;
          } else {
            // Geometric standing wave superposition
            const u = nx * Math.PI * 1.5;
            const v = ny * Math.PI * 1.5;
            val = Math.sin(m * u + n * v) + Math.cos(n * u - m * v);
          }

          if (boundary === 'clamped') {
            // Damped boundary edge
            const distFromEdge = mask[idx];
            val *= distFromEdge;
          }

          field[idx] = val;
          if (Math.abs(val) > maxAbs) {
            maxAbs = Math.abs(val);
          }
        }
      }

      // Normalize field to peak +/- 1.0
      for (let i = 0; i < cells; i++) {
        field[i] /= maxAbs;
      }
      fields.push(field);
    }

    return {
      gridSize,
      modeCount,
      geometry,
      boundary,
      eigenvalues,
      mask,
      fields,
    };
  }

  /**
   * Generates a custom modal field by arbitrary Chladni superposition:
   * w(x, y) = a * cos(m * pi * x / 2) * cos(n * pi * y / 2) + b * cos(n * pi * x / 2) * cos(m * pi * y / 2)
   */
  public static generateCustomChladniField(
    m: number,
    n: number,
    a: number,
    b: number,
    geometry: PlateGeometry,
    mask: Float32Array,
    gridSize: number = 64
  ): Float32Array {
    const field = new Float32Array(gridSize * gridSize);
    let maxAbs = 1e-5;

    for (let gy = 0; gy < gridSize; gy++) {
      const ny = ((gy / (gridSize - 1)) * 2.0 - 1.0);
      for (let gx = 0; gx < gridSize; gx++) {
        const nx = ((gx / (gridSize - 1)) * 2.0 - 1.0);
        const idx = gy * gridSize + gx;

        if (mask[idx] <= 0.05) {
          field[idx] = 0;
          continue;
        }

        let val = 0;
        if (geometry === 'square') {
          const t1 = a * Math.cos(m * Math.PI * nx * 0.5) * Math.cos(n * Math.PI * ny * 0.5);
          const t2 = b * Math.cos(n * Math.PI * nx * 0.5) * Math.cos(m * Math.PI * ny * 0.5);
          val = t1 + t2;
        } else if (geometry === 'circle') {
          const r = Math.sqrt(nx * nx + ny * ny);
          const theta = Math.atan2(ny, nx);
          val = (a * Math.cos(m * theta) + b * Math.sin(n * theta)) * Math.sin(Math.PI * (m + n) * r);
        } else {
          val =
            a * Math.cos(m * Math.PI * nx * 0.7) * Math.sin(n * Math.PI * ny * 0.7) +
            b * Math.sin(n * Math.PI * nx * 0.7) * Math.cos(m * Math.PI * ny * 0.7);
        }

        field[idx] = val;
        if (Math.abs(val) > maxAbs) {
          maxAbs = Math.abs(val);
        }
      }
    }

    for (let i = 0; i < field.length; i++) {
      field[i] /= maxAbs;
    }
    return field;
  }
}
