/**
 * SonicLab 3D - Acoustics & Air Wave Parameters Control Panel
 */

import React from 'react';
import { AcousticCalculations, AcousticsState, WaveformType } from '../../types/soniclab';
import {
  Activity,
  Compass,
  Flame,
  Radio,
  Sliders,
  SlidersHorizontal,
  Thermometer,
  Volume2,
  Waves,
  Zap,
} from 'lucide-react';

interface AcousticsControlsProps {
  state: AcousticsState;
  calcs: AcousticCalculations;
  onUpdateState: (patch: Partial<AcousticsState>) => void;
}

export const AcousticsControls: React.FC<AcousticsControlsProps> = ({
  state,
  calcs,
  onUpdateState,
}) => {
  const waveforms: { id: WaveformType; label: string }[] = [
    { id: 'sine', label: 'Senoidal' },
    { id: 'triangle', label: 'Triangular' },
    { id: 'square', label: 'Cuadrada' },
    { id: 'pulse', label: 'Pulso' },
  ];

  const presets = [
    { name: '120 Hz (Grave)', freq: 120 },
    { name: '440 Hz (Nota La4)', freq: 440 },
    { name: '1000 Hz (Estándar ISO)', freq: 1000 },
    { name: '2000 Hz (Sensibilidad Oído)', freq: 2000 },
  ];

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-6 text-slate-200">
      {/* Frecuencia y Presets */}
      <div className="flex flex-col gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Frecuencia Fundamental (Hz)</span>
          </label>
          <span className="font-mono text-base font-bold text-cyan-300">
            {state.frequencyHz.toFixed(1)} <span className="text-xs font-normal text-slate-400">Hz</span>
          </span>
        </div>

        <input
          id="acoustics-frequency-slider"
          type="range"
          min="20"
          max="3000"
          step="1"
          value={state.frequencyHz}
          onChange={(e) => onUpdateState({ frequencyHz: parseFloat(e.target.value) })}
          className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
        />

        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>20 Hz</span>
          <span>500 Hz</span>
          <span>1,500 Hz</span>
          <span>3,000 Hz</span>
        </div>

        {/* Benchmarks / Presets */}
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {presets.map((p) => (
            <button
              key={p.name}
              id={`preset-btn-${p.freq}`}
              onClick={() => onUpdateState({ frequencyHz: p.freq })}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-medium border text-center transition-all ${
                Math.abs(state.frequencyHz - p.freq) < 1
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {p.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Presión Sonora y Temperatura del Medio */}
      <div className="grid grid-cols-2 gap-4">
        {/* Nivel SPL */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Nivel SPL (dB)</span>
            </span>
            <span className="font-mono text-amber-300 font-semibold">{state.levelDbSpl} dB</span>
          </div>
          <input
            id="acoustics-spl-slider"
            type="range"
            min="30"
            max="110"
            step="1"
            value={state.levelDbSpl}
            onChange={(e) => onUpdateState({ levelDbSpl: parseInt(e.target.value, 10) })}
            className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 font-mono">
            {state.levelDbSpl < 50 ? 'Susurro suave' : state.levelDbSpl < 80 ? 'Conversación normal' : 'Tráfico / Concierto'}
          </span>
        </div>

        {/* Temperatura */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              <span>Temperatura (°C)</span>
            </span>
            <span className="font-mono text-rose-300 font-semibold">{state.temperatureC.toFixed(1)} °C</span>
          </div>
          <input
            id="acoustics-temp-slider"
            type="range"
            min="-10"
            max="45"
            step="0.5"
            value={state.temperatureC}
            onChange={(e) => onUpdateState({ temperatureC: parseFloat(e.target.value) })}
            className="w-full accent-rose-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 font-mono">
            c = {calcs.soundSpeedMps.toFixed(1)} m/s (Velocidad del sonido)
          </span>
        </div>
      </div>

      {/* Forma de Onda y Armónicos */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-purple-400" />
            <span>Forma de Onda y Síntesis Armónica</span>
          </label>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {waveforms.map((w) => (
            <button
              key={w.id}
              id={`waveform-btn-${w.id}`}
              onClick={() => onUpdateState({ waveform: w.id })}
              className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                state.waveform === w.id
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 shadow-lg shadow-purple-500/10'
                  : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        {/* Harmonics toggle & sliders */}
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-950/40 border border-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={state.harmonicMode}
              onChange={(e) => onUpdateState({ harmonicMode: e.target.checked })}
              className="rounded border-slate-700 text-purple-500 focus:ring-0 cursor-pointer"
            />
            <span className="font-medium">Modo Armónicos Múltiples (Serie de Fourier)</span>
          </label>

          {state.harmonicMode && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[0, 1, 2, 3].map((hIdx) => (
                <div key={hIdx} className="flex flex-col gap-1 text-[10px]">
                  <span className="text-slate-400 font-mono">f{hIdx + 1} ({state.frequencyHz * (hIdx + 1)}Hz)</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.harmonics[hIdx]}
                    onChange={(e) => {
                      const newH = [...state.harmonics] as [number, number, number, number];
                      newH[hIdx] = parseFloat(e.target.value);
                      onUpdateState({ harmonics: newH });
                    }}
                    className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                  />
                  <span className="font-mono text-purple-300">{(state.harmonics[hIdx] * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Exageración Visual y Fuente Secundaria */}
      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Exageración Visual</span>
            <span className="font-mono text-cyan-300 font-medium">{state.visualExaggeration}x</span>
          </div>
          <input
            id="acoustics-visual-scale-slider"
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={state.visualExaggeration}
            onChange={(e) => onUpdateState({ visualExaggeration: parseFloat(e.target.value) })}
            className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 font-mono">Magnifica el desplazamiento de micrones a escala visible</span>
        </div>

        {/* Fuente Secundaria / Interferencia */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={state.secondarySourceEnabled}
              onChange={(e) => onUpdateState({ secondarySourceEnabled: e.target.checked })}
              className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
            />
            <span className="font-medium">Fuente Secundaria (Batimiento)</span>
          </label>

          {state.secondarySourceEnabled && (
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">f₂: {state.secondaryFrequencyHz} Hz</span>
                <span className="text-amber-300 font-mono">
                  Δf = {Math.abs(state.frequencyHz - state.secondaryFrequencyHz).toFixed(1)} Hz (Batimiento)
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="1000"
                step="1"
                value={state.secondaryFrequencyHz}
                onChange={(e) => onUpdateState({ secondaryFrequencyHz: parseFloat(e.target.value) })}
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
