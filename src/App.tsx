/**
 * SonicLab 3D - Advanced Cymatics & Acoustic Physics Virtual Laboratory
 * Interactive 3D physical simulations and repository code optimization suite
 * for https://github.com/aaronfonmej-boop/SonicLab
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AcademicExperiment,
  AcousticCalculations,
  AcousticsState,
  CymaticsMetrics,
  CymaticsModeBank,
  CymaticsState,
  SonicLabModule,
} from './types/soniclab';
import { CymaticsPhysics } from './physics/CymaticsPhysics';
import { AcousticPhysics } from './physics/AcousticPhysics';
import { CymaticsBankService } from './services/CymaticsBankService';
import { AudioEngine } from './audio/AudioEngine';

import { Cymatics3DView } from './components/CymaticsLab/Cymatics3DView';
import { CymaticsControls } from './components/CymaticsLab/CymaticsControls';
import { AcousticLab as Acoustics3DView } from './components/AcousticsLab/AcousticLab';
import { AcousticsControls } from './components/AcousticsLab/AcousticsControls';
import { ResonatorsView } from './components/ResonatorsLab/ResonatorsView';
import { BeamformingView } from './components/BeamformingLab/BeamformingView';
import { LabReportModal } from './components/ReportGenerator/LabReportModal';
import { CodeOptimizationAudit } from './components/CodeOptimization/CodeOptimizationAudit';
import { AcademicGuide } from './components/AcademicGuide/AcademicGuide';

import {
  Activity,
  BookOpen,
  Box,
  CheckCircle2,
  Code2,
  Compass,
  Disc,
  FileText,
  Github,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  Zap,
} from 'lucide-react';

export default function App() {
  // Navigation
  const [activeModule, setActiveModule] = useState<SonicLabModule>('cymatics');

  // Cymatics State
  const [cymaticsState, setCymaticsState] = useState<CymaticsState>({
    geometry: 'square',
    boundary: 'simply_supported',
    modeIndex: 3,
    driveFrequencyHz: 480,
    normalizedDrive: 0.8,
    dampingRatio: 0.02,
    characteristicSizeM: 0.3,
    thicknessM: 0.0015,
    youngModulusPa: 70e9, // Aluminum 70 GPa
    densityKgM3: 2700,
    poissonRatio: 0.33,
    sandParticleCount: 12000,
    sandFlowIntensity: 0.75,
    palette: 'aurora_electrica',
    cameraMode: 'interactive',
    showNodalStreams: true,
    showAura: true,
    showExciterPulses: true,
    showWireframe: false,
    paused: false,
    reduceMotion: false,
    audioCoupled: true,
    driveX: 0.0,
    driveY: 0.0,
    visualScale: 1.0,
    automaticMode: true,
  });

  // Acoustics State
  const [acousticsState, setAcousticsState] = useState<AcousticsState>({
    frequencyHz: 343,
    levelDbSpl: 75,
    temperatureC: 20,
    humidityPercent: 50,
    atmosphericPressureKPa: 101.325,
    waveform: 'sine',
    harmonicMode: false,
    harmonics: [1.0, 0.35, 0.15, 0.05],
    showReferenceParticle: true,
    showWavefronts: true,
    showIsobars: true,
    paused: false,
    visualExaggeration: 4.0,
    particleGridDimension: 40,
    secondarySourceEnabled: false,
    secondaryFrequencyHz: 347,
    secondaryPhaseRad: 0,
    secondaryDistanceM: 1.5,
    probes: [
      { id: 'A', name: 'A', distanceM: 1.0, color: '#38bdf8' },
      { id: 'B', name: 'B', distanceM: 2.0, color: '#a855f7' },
      { id: 'C', name: 'C', distanceM: 3.2, color: '#34d399' },
    ],
    activeView: '3d',
  });

  // Mode bank loaded for active geometry/boundary (initialized with analytical bank so never null)
  const [cymaticsBank, setCymaticsBank] = useState<CymaticsModeBank>(() =>
    CymaticsBankService.generateAnalyticalBank('square', 'simply_supported')
  );

  // Audio status
  const [audioActive, setAudioActive] = useState<boolean>(false);
  const [oscilloscopeBuffer] = useState<Uint8Array>(new Uint8Array(256));

  // Load modal bank on geometry or boundary change
  useEffect(() => {
    let mounted = true;
    CymaticsBankService.loadBank(cymaticsState.geometry, cymaticsState.boundary).then((bank) => {
      if (mounted) {
        setCymaticsBank(bank);
      }
    });
    return () => {
      mounted = false;
    };
  }, [cymaticsState.geometry, cymaticsState.boundary]);

  // Compute live cymatics metrics
  const cymaticsMetrics: CymaticsMetrics = useMemo(() => {
    return CymaticsPhysics.computeMetrics(cymaticsState, cymaticsBank);
  }, [cymaticsState, cymaticsBank]);

  // Compute live acoustic calculations
  const acousticCalcs: AcousticCalculations = useMemo(() => {
    return AcousticPhysics.calculate(acousticsState);
  }, [acousticsState]);

  // Sync audio engine with active lab state
  useEffect(() => {
    const audio = AudioEngine.getInstance();
    if (!audioActive) {
      audio.stopTone();
      return;
    }

    if (activeModule === 'cymatics') {
      audio.setFrequency(cymaticsState.driveFrequencyHz);
      audio.setWaveform('sine');
      audio.updateHarmonics([1.0, 0, 0, 0]);
    } else if (activeModule === 'acoustics') {
      audio.setFrequency(acousticsState.frequencyHz);
      audio.setWaveform(acousticsState.waveform === 'pulse' ? 'square' : acousticsState.waveform);
      if (acousticsState.harmonicMode) {
        audio.updateHarmonics(acousticsState.harmonics);
      } else {
        audio.updateHarmonics([1.0, 0, 0, 0]);
      }
    }
  }, [
    audioActive,
    activeModule,
    cymaticsState.driveFrequencyHz,
    acousticsState.frequencyHz,
    acousticsState.waveform,
    acousticsState.harmonicMode,
    acousticsState.harmonics,
  ]);

  // Audio toggle handler
  const handleToggleAudio = async () => {
    const audio = AudioEngine.getInstance();
    if (audioActive) {
      audio.stopTone();
      setAudioActive(false);
    } else {
      const freq =
        activeModule === 'cymatics'
          ? cymaticsState.driveFrequencyHz
          : acousticsState.frequencyHz;
      await audio.startTone(freq, 'sine');
      setAudioActive(true);
    }
  };

  // Lock cymatics drive frequency to natural resonance
  const handleLockToNaturalFrequency = () => {
    setCymaticsState((prev) => ({
      ...prev,
      driveFrequencyHz: cymaticsMetrics.naturalFrequencyHz,
    }));
    if (audioActive) {
      AudioEngine.getInstance().setFrequency(cymaticsMetrics.naturalFrequencyHz);
    }
  };

  // Load guided academic experiment preset
  const handleLoadExperiment = (exp: AcademicExperiment) => {
    if (exp.preset.lab === 'cymatics' && exp.preset.cymaticsState) {
      setCymaticsState((prev) => ({ ...prev, ...exp.preset.cymaticsState }));
      setActiveModule('cymatics');
    } else if (exp.preset.lab === 'acoustics' && exp.preset.acousticsState) {
      setAcousticsState((prev) => ({ ...prev, ...exp.preset.acousticsState }));
      setActiveModule('acoustics');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-3 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 safe-area-top">
        {/* Branding & Repository Link */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
            <Disc className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white font-mono">SonicLab 3D</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                v1.2 · ORBIT
              </span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Simulador de Cimática y Acústica Física en Tiempo Real
            </span>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <nav aria-label="Laboratorios" className="order-3 lg:order-none flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full lg:w-auto max-w-full scrollbar-none">
          <button
            id="nav-tab-cymatics"
            onClick={() => setActiveModule('cymatics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeModule === 'cymatics'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Box className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cimática (Chladni)</span>
          </button>

          <button
            id="nav-tab-acoustics"
            onClick={() => setActiveModule('acoustics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeModule === 'acoustics'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-purple-400" />
            <span>Ondas de Sonido</span>
          </button>

          <button
            id="nav-tab-resonators"
            onClick={() => setActiveModule('resonators')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeModule === 'resonators'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            <span>Resonadores (Kundt/Helmholtz)</span>
          </button>

          <button
            id="nav-tab-beamforming"
            onClick={() => setActiveModule('beamforming')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeModule === 'beamforming'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>Beamforming & ANC</span>
          </button>

          <button
            id="nav-tab-report"
            onClick={() => setActiveModule('report')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeModule === 'report'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Informe de Laboratorio</span>
          </button>

          <button
            id="nav-tab-optimization"
            onClick={() => setActiveModule('optimization')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeModule === 'optimization'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Optimización Código</span>
          </button>

          <button
            id="nav-tab-academic"
            onClick={() => setActiveModule('academic')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeModule === 'academic'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Guías Académicas</span>
          </button>
        </nav>

        {/* Global Audio Synthesizer, PWA/APK Install & GitHub Link */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">

          <button
            id="header-audio-toggle-btn"
            onClick={handleToggleAudio}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all shadow-md ${
              audioActive
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-500/10'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Sintetizador de audio Web Audio API en tiempo real"
          >
            {audioActive ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Audio Activo</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Audio Silenciado</span>
              </>
            )}
          </button>

          <a
            href="https://github.com/aaronfonmej-boop/SonicLab"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-1 text-xs"
            title="Ver repositorio original en GitHub"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-2.5 sm:p-4 lg:p-6 flex flex-col gap-6">
        {/* 1. Laboratorio de Cimática */}
        {activeModule === 'cymatics' && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
            {/* 3D Visualizer Canvas (Left/Top) */}
            <div className="w-full lg:col-span-7 xl:col-span-8 h-[72svh] min-h-[460px] max-h-[620px] lg:sticky lg:top-20">
              <Cymatics3DView
                state={cymaticsState}
                bank={cymaticsBank}
                metrics={cymaticsMetrics}
                onUpdateState={(patch) => setCymaticsState((prev) => ({ ...prev, ...patch }))}
                onToggleAudio={handleToggleAudio}
                audioActive={audioActive}
              />
            </div>

            {/* Physics & Visualization Controls (Right) */}
            <div className="w-full lg:col-span-5 xl:col-span-4">
              <CymaticsControls
                state={cymaticsState}
                bank={cymaticsBank}
                metrics={cymaticsMetrics}
                onUpdateState={(patch) => setCymaticsState((prev) => ({ ...prev, ...patch }))}
                onLockToNaturalFrequency={handleLockToNaturalFrequency}
              />
            </div>
          </div>
        )}

        {/* 2. Laboratorio de Sonido & Ondas de Aire */}
        {activeModule === 'acoustics' && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
            {/* Visual Chamber (Left) */}
            <div className="w-full min-w-0 lg:col-span-7 xl:col-span-8">
              <Acoustics3DView
                state={acousticsState}
                calcs={acousticCalcs}
                onUpdateState={(patch) => setAcousticsState((prev) => ({ ...prev, ...patch }))}
                onToggleAudio={handleToggleAudio}
                audioActive={audioActive}
                oscilloscopeData={oscilloscopeBuffer}
              />
            </div>

            {/* Acoustic Medium Controls (Right) */}
            <div className="w-full lg:col-span-5 xl:col-span-4">
              <AcousticsControls
                state={acousticsState}
                calcs={acousticCalcs}
                onUpdateState={(patch) => setAcousticsState((prev) => ({ ...prev, ...patch }))}
              />
            </div>
          </div>
        )}

        {/* 3. Laboratorio de Resonadores Clásicos (Kundt & Helmholtz) */}
        {activeModule === 'resonators' && <ResonatorsView />}

        {/* 4. Laboratorio de Beamforming & Cancelación Activa de Ruido (ANC) */}
        {activeModule === 'beamforming' && <BeamformingView />}

        {/* 5. Generador de Informes de Laboratorio */}
        {activeModule === 'report' && (
          <LabReportModal
            metrics={cymaticsMetrics}
            cymaticsState={cymaticsState}
            acousticCalcs={acousticCalcs}
          />
        )}

        {/* 6. Auditoría de Optimización de Código */}
        {activeModule === 'optimization' && <CodeOptimizationAudit />}

        {/* 7. Guías Académicas & Prácticas Guiadas */}
        {activeModule === 'academic' && <AcademicGuide onLoadExperiment={handleLoadExperiment} />}
      </main>

      {/* Footer Status Bar */}
      <footer className="bg-slate-950 border-t border-slate-900 py-3 px-6 text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>SonicLab Physics Core: Kirchhoff-Love Plates & ISO 9613-1 Acoustics</span>
        </div>
        <div>
          <span>SonicLab 1.2 · ORBIT · Simulación educativa</span>
        </div>
      </footer>
    </div>
  );
}
