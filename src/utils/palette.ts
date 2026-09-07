/**
 * SonicLab 3D - Visual Theme and Color Palettes
 */

import { VisualPalette } from '../types/soniclab';

export interface PaletteConfig {
  id: VisualPalette;
  name: string;
  description: string;
  plateBaseHex: number;
  plateEmissiveHex: number;
  nodalLineHex: number;
  sandParticleHex: number;
  streamParticleHex: number;
  auraHex: number;
  cssBg: string;
  cssAccent: string;
}

export const PALETTES: Record<VisualPalette, PaletteConfig> = {
  aurora_electrica: {
    id: 'aurora_electrica',
    name: 'Aurora Eléctrica',
    description: 'Tonos cian y violeta neón de alta energía con emisión luminiscente',
    plateBaseHex: 0x0f1423,
    plateEmissiveHex: 0x182c54,
    nodalLineHex: 0x00f0ff,
    sandParticleHex: 0x38bdf8,
    streamParticleHex: 0xc084fc,
    auraHex: 0x0ea5e9,
    cssBg: 'from-slate-950 via-slate-900 to-indigo-950',
    cssAccent: '#00f0ff',
  },
  solar_dorada: {
    id: 'solar_dorada',
    name: 'Solar Dorada',
    description: 'Obsidiana con filamentos dorados incandescentes y partículas de ámbar',
    plateBaseHex: 0x14100c,
    plateEmissiveHex: 0x3d2810,
    nodalLineHex: 0xf59e0b,
    sandParticleHex: 0xfde047,
    streamParticleHex: 0xfbbf24,
    auraHex: 0xd97706,
    cssBg: 'from-stone-950 via-neutral-900 to-amber-950',
    cssAccent: '#f59e0b',
  },
  obsidiana_cientifica: {
    id: 'obsidiana_cientifica',
    name: 'Obsidiana Científica',
    description: 'Monocromo de alto contraste para máxima legibilidad de geometrías modales',
    plateBaseHex: 0x121215,
    plateEmissiveHex: 0x24242c,
    nodalLineHex: 0xffffff,
    sandParticleHex: 0xe2e8f0,
    streamParticleHex: 0x94a3b8,
    auraHex: 0x64748b,
    cssBg: 'from-neutral-950 via-zinc-900 to-neutral-950',
    cssAccent: '#ffffff',
  },
  oceano_bioluminiscente: {
    id: 'oceano_bioluminiscente',
    name: 'Océano Bioluminiscente',
    description: 'Azul abisal con fosforescencia marina y partículas flotantes',
    plateBaseHex: 0x05161f,
    plateEmissiveHex: 0x0a3242,
    nodalLineHex: 0x2dd4bf,
    sandParticleHex: 0x5eead4,
    streamParticleHex: 0x38bdf8,
    auraHex: 0x14b8a6,
    cssBg: 'from-slate-950 via-cyan-950 to-teal-950',
    cssAccent: '#2dd4bf',
  },
  esmeralda_cuantica: {
    id: 'esmeralda_cuantica',
    name: 'Esmeralda Cuántica',
    description: 'Verde láser cuántico sobre superficie de grafito espacial',
    plateBaseHex: 0x0c1712,
    plateEmissiveHex: 0x133825,
    nodalLineHex: 0x10b981,
    sandParticleHex: 0x34d399,
    streamParticleHex: 0xa7f3d0,
    auraHex: 0x059669,
    cssBg: 'from-zinc-950 via-emerald-950 to-neutral-950',
    cssAccent: '#10b981',
  },
};
