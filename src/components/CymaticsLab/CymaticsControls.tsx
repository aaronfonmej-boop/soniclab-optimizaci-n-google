/**
 * SonicLab 3D - Cymatics Controls & Physics Parameter Panel
 */

import React, { useState } from 'react';
import {
  CymaticsMetrics,
  CymaticsModeBank,
  CymaticsState,
  PlateBoundary,
  PlateGeometry,
  VisualPalette,
} from '../../types/soniclab';
import { PALETTES } from '../../utils/palette';
import { exportPlateOBJ, exportPlateSTL, exportTelemetryCSV } from '../../utils/exporters';
import { MicPitchService } from '../../services/MicPitchService';
import { CymaticsBankService } from '../../services/CymaticsBankService';
import {
  Activity,
  Box,
  Circle,
  Disc,
  Download,
  Hexagon,
  Layers,
  Lock,
  Mic,
  MicOff,
  Pause,
  Play,
  Settings2,
  Sliders,
  Sparkles,
  Triangle,
  Zap,
} from 'lucide-react';

interface CymaticsControlsProps {
  state: CymaticsState;
  bank: CymaticsModeBank | null;
  metrics: CymaticsMetrics;
  onUpdateState: (patch: Partial<CymaticsState>) => void;
  onLockToNaturalFrequency: () => void;
}

export const CymaticsControls: React.FC<CymaticsControlsProps> = ({
  state,
  bank,
  metrics,
  onUpdateState,
  onLockToNaturalFrequency,
}) => {
  const [micActive, setMicActive] = useState(false);
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);

  const handleToggleMic = async () => {
    const mic = MicPitchService.getInstance();
    if (micActive) {
      mic.stopMicrophone();
      setMicActive(false);
      setDetectedPitch(null);
    } else {
      mic.setPitchCallback((freqHz) => {
        setDetectedPitch(freqHz);
        onUpdateState({ driveFrequencyHz: Math.round(freqHz) });
      });
      const success = await mic.startMicrophone();
      if (success) {
        setMicActive(true);
      } else {
        alert('No se pudo acceder al micrófono. Por favor verifica los permisos del navegador.');
      }
    }
  };

  const handleApplyCustomChladni = (m: number, n: number, a: number, b: number) => {
    if (!bank) return;
    const customField = CymaticsBankService.generateCustomChladniField(
      m,
      n,
      a,
      b,
      state.geometry,
      bank.mask,
      bank.gridSize
    );
    // Replace active mode field with custom Chladni field
    const activeMode = state.modeIndex;
    bank.fields[activeMode] = customField;
    onUpdateState({
      customChladniMode: true,
      chladniM: m,
      chladniN: n,
      chladniA: a,
      chladniB: b,
    });
  };
  const geometries: { id: PlateGeometry; name: string; icon: React.ReactNode }[] = [
    { id: 'square', name: 'Cuadrada', icon: <Box className="w-4 h-4" /> },
    { id: 'circle', name: 'Circular', icon: <Circle className="w-4 h-4" /> },
    { id: 'triangle', name: 'Triangular', icon: <Triangle className="w-4 h-4" /> },
    { id: 'hexagon', name: 'Hexagonal', icon: <Hexagon className="w-4 h-4" /> },
  ];

  const boundaries: { id: PlateBoundary; name: string; desc: string }[] = [
    { id: 'simply_supported', name: 'Borde Apoyado', desc: 'Desplazamiento nulo en borde, giro libre' },
    { id: 'clamped', name: 'Borde Sujeto', desc: 'Desplazamiento y pendiente angular nulos' },
  ];

  const materials = [
    { name: 'Aluminio', E: 70e9, rho: 2700, nu: 0.33 },
    { name: 'Acero', E: 210e9, rho: 7850, nu: 0.30 },
    { name: 'Latón', E: 105e9, rho: 8500, nu: 0.35 },
    { name: 'Vidrio', E: 65e9, rho: 2500, nu: 0.22 },
  ];

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-6 text-slate-200">
      {/* Geometría y Condiciones de Borde */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Geometría y Fijación de la Placa</span>
          </label>
          <span className="text-[11px] font-mono text-cyan-300">
            {state.geometry.toUpperCase()} • {state.boundary === 'simply_supported' ? 'APOYADO' : 'SUJETO'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {geometries.map((g) => (
            <button
              key={g.id}
              id={`geom-btn-${g.id}`}
              onClick={() => onUpdateState({ geometry: g.id })}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-medium border transition-all ${
                state.geometry === g.id
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {g.icon}
              <span>{g.name}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          {boundaries.map((b) => (
            <button
              key={b.id}
              id={`boundary-btn-${b.id}`}
              onClick={() => onUpdateState({ boundary: b.id })}
              className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                state.boundary === b.id
                  ? 'bg-purple-500/20 border-purple-500/60 text-purple-200 shadow-lg shadow-purple-500/10'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="text-xs font-semibold text-slate-200">{b.name}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{b.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Frecuencia de Excitación y Acople Resonante */}
      <div className="flex flex-col gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Frecuencia Excitadora (Hz)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-amber-300">
              {state.driveFrequencyHz.toFixed(1)} <span className="text-xs font-normal text-slate-400">Hz</span>
            </span>
            <button
              id="cymatics-lock-frequency-btn"
              onClick={onLockToNaturalFrequency}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all flex items-center gap-1 shadow-sm"
              title="Ajustar la frecuencia exactamente a la frecuencia natural del modo activo para máxima resonancia"
            >
              <Lock className="w-3 h-3" />
              <span>Sintonizar {metrics.naturalFrequencyHz.toFixed(0)} Hz</span>
            </button>
          </div>
        </div>

        {/* Live Microphone Tone Detector */}
        <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <button
              id="cymatics-mic-toggle-btn"
              onClick={handleToggleMic}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                micActive
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {micActive ? (
                <>
                  <MicOff className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  <span>Detener Micrófono</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-slate-400" />
                  <span>Excitar con Micrófono</span>
                </>
              )}
            </button>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {micActive ? (
              detectedPitch ? (
                <span className="text-emerald-400 font-bold">Detectado: {detectedPitch.toFixed(0)} Hz</span>
              ) : (
                <span>Escuchando voz...</span>
              )
            ) : (
              'Voz o instrumento en vivo'
            )}
          </span>
        </div>

        {/* Frequency Slider */}
        <input
          id="cymatics-frequency-slider"
          type="range"
          min="20"
          max="3000"
          step="0.5"
          value={state.driveFrequencyHz}
          onChange={(e) => onUpdateState({ driveFrequencyHz: parseFloat(e.target.value) })}
          className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
        />

        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>20 Hz</span>
          <span>500 Hz</span>
          <span>1,500 Hz</span>
          <span>3,000 Hz</span>
        </div>

        {/* Selector de Modo y Resonancia */}
        <div className="mt-2 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium">Modo Propio / Armónico Chladni</span>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-400 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.automaticMode}
                  onChange={(e) => onUpdateState({ automaticMode: e.target.checked })}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                />
                <span>Auto-sintonizar modo por frecuencia</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max={bank ? bank.modeCount - 1 : 23}
              value={metrics.modeIndex}
              disabled={state.automaticMode}
              onChange={(e) => onUpdateState({ modeIndex: parseInt(e.target.value, 10), automaticMode: false })}
              className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
            />
            <span className="font-mono text-xs text-cyan-300 w-16 text-right font-semibold">
              Modo {metrics.modeIndex + 1}/24
            </span>
          </div>
        </div>

        {/* Superposición Libre de Chladni (m, n) */}
        <div className="mt-2 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-300 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generador Libre de Chladni (m, n)</span>
            </span>
            <button
              onClick={() => handleApplyCustomChladni(state.chladniM || 3, state.chladniN || 5, 1.0, 1.0)}
              className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30"
            >
              Aplicar Superposición
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-slate-400">
                <span>Onda m:</span>
                <span className="font-mono text-purple-300 font-bold">{state.chladniM || 3}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={state.chladniM || 3}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10);
                  handleApplyCustomChladni(m, state.chladniN || 5, 1.0, 1.0);
                }}
                className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-slate-400">
                <span>Onda n:</span>
                <span className="font-mono text-purple-300 font-bold">{state.chladniN || 5}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={state.chladniN || 5}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  handleApplyCustomChladni(state.chladniM || 3, n, 1.0, 1.0);
                }}
                className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Partículas de Arena y Dinámica Física */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cantidad de Arena */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Granos de Arena</span>
            <span className="font-mono text-cyan-300 font-medium">{state.sandParticleCount.toLocaleString()}</span>
          </div>
          <input
            id="cymatics-sand-count-slider"
            type="range"
            min="2000"
            max="20000"
            step="1000"
            value={state.sandParticleCount}
            onChange={(e) => onUpdateState({ sandParticleCount: parseInt(e.target.value, 10) })}
            className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Fluidez / Relajación */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Fluidez de Asentamiento</span>
            <span className="font-mono text-purple-300 font-medium">{(state.sandFlowIntensity * 100).toFixed(0)}%</span>
          </div>
          <input
            id="cymatics-sand-flow-slider"
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={state.sandFlowIntensity}
            onChange={(e) => onUpdateState({ sandFlowIntensity: parseFloat(e.target.value) })}
            className="w-full accent-purple-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Selector de Paletas Visuales */}
      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Disc className="w-3.5 h-3.5 text-cyan-400" />
          <span>Paleta Visual y Renderizado Estético</span>
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {Object.values(PALETTES).map((p) => (
            <button
              key={p.id}
              id={`palette-btn-${p.id}`}
              onClick={() => onUpdateState({ palette: p.id })}
              className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                state.palette === p.id
                  ? 'border-cyan-400 bg-slate-800/90 shadow-md shadow-cyan-500/10'
                  : 'border-slate-800 bg-slate-900/50 hover:bg-slate-800/60'
              }`}
              title={p.description}
            >
              <div
                className="w-4 h-4 rounded-full shadow-inner"
                style={{ backgroundColor: `#${p.nodalLineHex.toString(16).padStart(6, '0')}` }}
              />
              <span className="text-[10px] font-medium leading-tight text-slate-300 truncate w-full">
                {p.name.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Capas y Efectos Visuales */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-all">
          <input
            type="checkbox"
            checked={state.showNodalStreams}
            onChange={(e) => onUpdateState({ showNodalStreams: e.target.checked })}
            className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
          />
          <span>Corrientes nodales</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-all">
          <input
            type="checkbox"
            checked={state.showExciterPulses}
            onChange={(e) => onUpdateState({ showExciterPulses: e.target.checked })}
            className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
          />
          <span>Ondas de actuador</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-all">
          <input
            type="checkbox"
            checked={state.showWireframe}
            onChange={(e) => onUpdateState({ showWireframe: e.target.checked })}
            className="rounded border-slate-700 text-purple-500 focus:ring-0 cursor-pointer"
          />
          <span>Malla 3D alambre</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-all">
          <input
            type="checkbox"
            checked={state.paused}
            onChange={(e) => onUpdateState({ paused: e.target.checked })}
            className="rounded border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
          />
          <span>{state.paused ? 'Reanudar oscilación' : 'Pausar oscilación'}</span>
        </label>
      </div>

      {/* Presets Rápidos de Material */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Material de la Placa</span>
        <div className="grid grid-cols-4 gap-1.5">
          {materials.map((m) => (
            <button
              key={m.name}
              id={`material-btn-${m.name.toLowerCase()}`}
              onClick={() => onUpdateState({ youngModulusPa: m.E, densityKgM3: m.rho, poissonRatio: m.nu })}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                Math.abs(state.youngModulusPa - m.E) < 1e7
                  ? 'bg-slate-800 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Exportación 3D CAD & Datos Científicos */}
      <div className="flex flex-col gap-2 pt-3 border-t border-slate-800">
        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Exportar Modelo 3D y Datos</span>
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            id="export-stl-btn"
            onClick={() => exportPlateSTL(bank, metrics.modeIndex, state)}
            className="py-2 px-2 rounded-xl text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 flex flex-col items-center gap-0.5 transition-all"
            title="Exportar archivo STL para impresión 3D o CAD (Fusion 360, Blender)"
          >
            <span className="font-bold">Modelo .STL</span>
            <span className="text-[9px] text-cyan-400/80 font-normal">Impresión 3D</span>
          </button>

          <button
            id="export-obj-btn"
            onClick={() => exportPlateOBJ(bank, metrics.modeIndex, state)}
            className="py-2 px-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 flex flex-col items-center gap-0.5 transition-all"
            title="Exportar archivo Wavefront OBJ con malla deformada"
          >
            <span className="font-bold">Modelo .OBJ</span>
            <span className="text-[9px] text-slate-400 font-normal">Malla 3D</span>
          </button>

          <button
            id="export-csv-btn"
            onClick={() => {
              // Export CSV with current calculations
              exportTelemetryCSV(metrics, state, {
                soundSpeedMps: 343.4,
                wavelengthM: 343.4 / state.driveFrequencyHz,
                periodMs: 1000 / state.driveFrequencyHz,
                waveNumberK: (2 * Math.PI * state.driveFrequencyHz) / 343.4,
                angularFrequencyOmega: 2 * Math.PI * state.driveFrequencyHz,
                pressureRmsPa: 0.02,
                pressurePeakPa: 0.028,
                airDensityKgM3: 1.204,
                attenuationDbPerM: 0.0005,
              });
            }}
            className="py-2 px-2 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 flex flex-col items-center gap-0.5 transition-all"
            title="Descargar telemetría y mediciones para Excel / MATLAB"
          >
            <span className="font-bold">Datos .CSV</span>
            <span className="text-[9px] text-emerald-400/80 font-normal">Excel / MATLAB</span>
          </button>
        </div>
      </div>
    </div>
  );
};
