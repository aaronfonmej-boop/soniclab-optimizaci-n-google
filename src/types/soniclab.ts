/**
 * SonicLab 3D - Global Scientific Types and Interfaces
 */

export type PlateGeometry = 'square' | 'circle' | 'triangle' | 'hexagon';
export type PlateBoundary = 'simply_supported' | 'clamped';
export type SonicLabModule =
  | 'cymatics'
  | 'acoustics'
  | 'resonators'
  | 'beamforming'
  | 'report'
  | 'optimization'
  | 'academic';

export type VisualPalette =
  | 'aurora_electrica'
  | 'solar_dorada'
  | 'obsidiana_cientifica'
  | 'oceano_bioluminiscente'
  | 'esmeralda_cuantica';

export type CameraMode = 'interactive' | 'top_down' | 'cinematic_show' | 'orbit';

export interface CymaticsState {
  geometry: PlateGeometry;
  boundary: PlateBoundary;
  modeIndex: number;
  driveFrequencyHz: number;
  normalizedDrive: number;
  dampingRatio: number;
  driveX: number; // -1 to 1
  driveY: number; // -1 to 1
  automaticMode: boolean;
  youngModulusPa: number; // e.g. 70e9 Pa (Aluminum)
  densityKgM3: number; // e.g. 2700 kg/m^3
  poissonRatio: number; // e.g. 0.33
  thicknessM: number; // e.g. 0.001 m
  characteristicSizeM: number; // e.g. 0.25 m
  sandParticleCount: number; // 2000 to 20000
  sandFlowIntensity: number;
  visualScale: number;
  palette: VisualPalette;
  cameraMode: CameraMode;
  showNodalStreams: boolean;
  showAura: boolean;
  showExciterPulses: boolean;
  showWireframe: boolean;
  paused: boolean;
  reduceMotion: boolean;
  audioCoupled: boolean;
  // Custom Chladni Superposition Mode (m, n, a, b)
  customChladniMode?: boolean;
  chladniM?: number; // 1 to 12
  chladniN?: number; // 1 to 12
  chladniA?: number; // weighting a
  chladniB?: number; // weighting b
  // Microphone & Audio input reactivity
  micInputActive?: boolean;
  micDetectedPitchHz?: number;
}

export interface CymaticsMetrics {
  modeIndex: number;
  naturalFrequencyHz: number;
  response: number;
  coupling: number;
  relativeDetuning: number;
  flexuralRigidityNm: number;
  normalizedAmplitude: number;
  firstFrequencyHz: number;
  lastFrequencyHz: number;
}

export interface ModeData {
  eigenvalue: number;
  field: Float32Array; // 64x64 values normalized between -1 and 1
}

export interface CymaticsModeBank {
  gridSize: number;
  modeCount: number;
  geometry: PlateGeometry;
  boundary: PlateBoundary;
  eigenvalues: Float32Array;
  mask: Float32Array; // 64x64 values (1 for inside, 0 for outside)
  fields: Float32Array[]; // 24 arrays of size 64*64
}

// Acoustics Lab (Air)
export type WaveformType = 'sine' | 'triangle' | 'square' | 'pulse';

export interface AcousticProbe {
  id: string;
  name: string;
  distanceM: number;
  color: string;
}

export interface AcousticsState {
  frequencyHz: number;
  levelDbSpl: number;
  temperatureC: number;
  humidityPercent: number;
  atmosphericPressureKPa: number;
  waveform: WaveformType;
  harmonicMode: boolean;
  harmonics: [number, number, number, number]; // 1st to 4th harmonic amplitudes
  visualExaggeration: number;
  particleGridDimension: number; // density of particles
  paused: boolean;
  showReferenceParticle: boolean;
  showWavefronts: boolean;
  showIsobars: boolean;
  secondarySourceEnabled: boolean;
  secondaryFrequencyHz: number;
  secondaryPhaseRad: number;
  secondaryDistanceM: number;
  probes: AcousticProbe[];
  activeView: '3d' | '2d_slice' | 'oscilloscope';
}

export interface AcousticCalculations {
  soundSpeedMps: number;
  wavelengthM: number;
  periodMs: number;
  waveNumberK: number;
  angularFrequencyOmega: number;
  pressureRmsPa: number;
  pressurePeakPa: number;
  airDensityKgM3: number;
  attenuationDbPerM: number;
}

// Code Optimization Audit
export interface OptimizationFinding {
  id: string;
  domain: 'GPU_SHADER' | 'MEMORY_GC' | 'PHYSICS_SIMD' | 'UI_RECOMPOSITION' | 'AUDIO_DSP' | 'PERCEPTUAL_ANIM';
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  description: string;
  fileAffected: string;
  beforeCode: string;
  afterCode: string;
  impactMetrics: string;
  appliedInWeb: boolean;
}

export interface AcademicExperiment {
  id: string;
  title: string;
  category: 'Cimática' | 'Acústica' | 'Interferencia';
  difficulty: 'Fundamentos' | 'Aplicación' | 'Avanzado';
  summary: string;
  objective: string;
  preset: {
    lab: 'cymatics' | 'acoustics';
    cymaticsState?: Partial<CymaticsState>;
    acousticsState?: Partial<AcousticsState>;
  };
  questions: string[];
}

// 5. Classic Resonators (Kundt Tube & Helmholtz Resonator)
export type TubeBoundaryType = 'open_open' | 'open_closed' | 'closed_closed';

export interface KundtState {
  lengthM: number;
  tubeBoundary: TubeBoundaryType;
  frequencyHz: number;
  temperatureC: number;
  gasType: 'air' | 'helium' | 'co2' | 'sf6';
  corkParticleCount: number;
  amplitude: number;
  paused: boolean;
  showPressureWave: boolean;
  showVelocityWave: boolean;
}

export interface HelmholtzState {
  cavityVolumeLiters: number;
  neckLengthCm: number;
  neckRadiusCm: number;
  temperatureC: number;
  damping: number;
  driveFrequencyHz: number;
  excitationLevel: number;
  paused: boolean;
}

// 4. Acoustic Arrays & Beamforming / Active Noise Cancellation
export interface SpeakerElement {
  id: number;
  posX: number; // in meters along line array
  phaseShiftDeg: number;
  amplitude: number;
  active: boolean;
}

export interface BeamformingState {
  elementCount: number;
  spacingM: number;
  frequencyHz: number;
  steeringAngleDeg: number;
  ancMode: boolean; // Active Noise Cancellation mode
  noiseSourceDistanceM: number;
  noiseSourceAngleDeg: number;
  antiNoiseGain: number;
  antiNoisePhaseDeg: number;
  elements: SpeakerElement[];
  paused: boolean;
  showFieldGrid: boolean;
  showIsobars: boolean;
}

// 6. Practice Lab Report Generator
export interface LabReportData {
  studentName: string;
  studentId: string;
  institution: string;
  date: string;
  selectedExperimentTitle: string;
  objective: string;
  notes: string;
  conclusions: string;
  cymaticsSnapshotUrl?: string;
  acousticsSnapshotUrl?: string;
}

