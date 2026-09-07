/**
 * SonicLab 3D - Acoustics & Air Wave Visualizer
 * Simulates longitudinal wave propagation in a gas medium where particles
 * oscillate strictly about their equilibrium positions (compression and rarefaction).
 */

import React, { useEffect, useRef, useState } from 'react';
import { AcousticCalculations, AcousticsState } from '../../types/soniclab';
import { AcousticPhysics } from '../../physics/AcousticPhysics';
import { Eye, Info, Volume2, VolumeX, Sparkles, Activity } from 'lucide-react';

interface Acoustics3DViewProps {
  state: AcousticsState;
  calcs: AcousticCalculations;
  onUpdateState: (patch: Partial<AcousticsState>) => void;
  onToggleAudio: () => void;
  audioActive: boolean;
  oscilloscopeData?: Uint8Array;
}

export const Acoustics3DView: React.FC<Acoustics3DViewProps> = ({
  state,
  calcs,
  onUpdateState,
  onToggleAudio,
  audioActive,
  oscilloscopeData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animId = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const [fps, setFps] = useState<number>(60);
  const frameCount = useRef<number>(0);
  const lastFpsTime = useRef<number>(performance.now());

  // Probes measurement values
  const [probeReadings, setProbeReadings] = useState<{ id: string; pressurePa: number; dispUm: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTimestamp = performance.now();

    const render = (now: number) => {
      animId.current = requestAnimationFrame(render);

      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      // Update time if not paused
      if (!state.paused) {
        timeRef.current += dt;
      }
      const t = timeRef.current;

      // FPS tracking
      frameCount.current++;
      if (now - lastFpsTime.current >= 600) {
        setFps(Math.round((frameCount.current * 1000) / (now - lastFpsTime.current)));
        frameCount.current = 0;
        lastFpsTime.current = now;
      }

      // Handle canvas resolution
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // Clear with dark deep navy background
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, width, height);

      // Draw acoustic chamber grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const gridSpacing = 40;
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Wavefront guidelines (compression wavefronts propagating rightward)
      if (state.showWavefronts) {
        const lambdaPx = (calcs.wavelengthM / 4.0) * width; // 4 meters total view
        const waveSpeedPx = (calcs.soundSpeedMps / 4.0) * width;
        const offset = (t * waveSpeedPx) % lambdaPx;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        for (let x = offset; x < width; x += lambdaPx) {
          ctx.beginPath();
          ctx.moveTo(x, 40);
          ctx.lineTo(x, height - 40);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // Air molecules matrix simulation
      // Total chamber width represents 4.0 meters
      const chamberMeters = 4.0;
      const cols = 55;
      const rows = 16;
      const marginX = 50;
      const marginY = 60;
      const availableW = width - marginX * 2;
      const availableH = height - marginY * 2;

      // Precompute column-invariant physical quantities (55 physics samples instead of 880)
      interface ColSample {
        currentXPx: number;
        radius: number;
        colorStyle: string;
      }
      const colSamples: ColSample[] = [];

      for (let col = 0; col < cols; col++) {
        const normX = col / (cols - 1);
        const xEquilibriumMeters = normX * chamberMeters;
        const x0Px = marginX + normX * availableW;

        // Physical longitudinal displacement
        const displacementMeters = AcousticPhysics.sampleDisplacement(xEquilibriumMeters, t, state, calcs);
        const displacementPx = (displacementMeters / chamberMeters) * availableW * 2.8;

        // Acoustic pressure perturbation
        const pressurePerturbation = AcousticPhysics.samplePressurePerturbation(xEquilibriumMeters, t, state, calcs);
        const isCompressed = pressurePerturbation > 0;
        const intensity = Math.min(Math.abs(pressurePerturbation) * 1.6, 1.0);

        let colorStyle = '#38bdf8';
        if (isCompressed) {
          const r = Math.floor(120 + intensity * 135);
          const g = Math.floor(220 + intensity * 35);
          colorStyle = `rgba(${r}, ${g}, 255, ${(0.7 + intensity * 0.3).toFixed(2)})`;
        } else {
          colorStyle = `rgba(168, 85, 247, ${(0.45 + (1 - intensity) * 0.35).toFixed(2)})`;
        }

        colSamples.push({
          currentXPx: x0Px + displacementPx,
          radius: 3.2 + intensity * 1.5,
          colorStyle,
        });
      }

      // High-performance batched column rendering (55 draw batches instead of 880)
      for (let col = 0; col < cols; col++) {
        const sample = colSamples[col];
        const px = sample.currentXPx;
        const rad = sample.radius;

        ctx.fillStyle = sample.colorStyle;
        ctx.beginPath();
        for (let row = 0; row < rows; row++) {
          const y0 = marginY + (row / (rows - 1)) * availableH;
          const jitterY = Math.sin(row * 77 + 12) * 4;
          const currentYPx = y0 + jitterY;
          ctx.moveTo(px + rad, currentYPx);
          ctx.arc(px, currentYPx, rad, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Tagged Reference Particle (Highlights that the particle oscillates about its equilibrium!)
      if (state.showReferenceParticle) {
        const refEquilibriumMeters = 1.6; // placed at 1.6 meters
        const refNormX = refEquilibriumMeters / chamberMeters;
        const refX0Px = marginX + refNormX * availableW;
        const refY0Px = height / 2;

        const refDispMeters = AcousticPhysics.sampleDisplacement(refEquilibriumMeters, t, state, calcs);
        const refDispPx = (refDispMeters / chamberMeters) * availableW * 2.8;
        const currentRefXPx = refX0Px + refDispPx;

        // Equilibrium crosshair & boundary range
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(refX0Px, refY0Px - 28);
        ctx.lineTo(refX0Px, refY0Px + 28);
        ctx.stroke();

        // Trace of oscillation range
        const maxAmpPx = (0.05 * state.visualExaggeration / chamberMeters) * availableW * 2.8;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.beginPath();
        ctx.moveTo(refX0Px - maxAmpPx, refY0Px);
        ctx.lineTo(refX0Px + maxAmpPx, refY0Px);
        ctx.stroke();

        // Glowing Reference Particle (Red / Coral)
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(currentRefXPx, refY0Px, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Label above reference particle
        ctx.font = '11px monospace';
        ctx.fillStyle = '#fca5a5';
        ctx.textAlign = 'center';
        ctx.fillText('PARTÍCULA DE REFERENCIA (x0 = 1.60 m)', currentRefXPx, refY0Px - 16);
        ctx.fillText(`Desplazamiento: ${(refDispMeters * 1000).toFixed(2)} mm`, currentRefXPx, refY0Px + 26);
      }

      // Acoustic Probes (A, B, C)
      const currentReadings: { id: string; pressurePa: number; dispUm: number }[] = [];
      state.probes.forEach((probe) => {
        const pNorm = probe.distanceM / chamberMeters;
        const pXPx = marginX + pNorm * availableW;

        if (pXPx >= marginX && pXPx <= width - marginX) {
          // Draw probe line
          ctx.strokeStyle = probe.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pXPx, 30);
          ctx.lineTo(pXPx, height - 30);
          ctx.stroke();

          // Probe head marker
          ctx.fillStyle = probe.color;
          ctx.beginPath();
          ctx.arc(pXPx, 30, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = probe.color;
          ctx.textAlign = 'center';
          ctx.fillText(`SONDA ${probe.name} (${probe.distanceM}m)`, pXPx, 20);

          const pPressure = AcousticPhysics.samplePressurePerturbation(probe.distanceM, t, state, calcs);
          const pDisp = AcousticPhysics.sampleDisplacement(probe.distanceM, t, state, calcs);
          currentReadings.push({
            id: probe.id,
            pressurePa: calcs.pressureRmsPa * (1 + pPressure * 0.4),
            dispUm: pDisp * 1e6,
          });
        }
      });
      setProbeReadings(currentReadings);

      // Acoustic Speaker Transducer on the left
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, marginY - 10);
      ctx.lineTo(marginX - 5, marginY + 20);
      ctx.lineTo(marginX - 5, height - marginY - 20);
      ctx.lineTo(12, height - marginY + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Speaker membrane oscillation
      const membraneDisp = Math.sin(calcs.angularFrequencyOmega * t) * 8 * (state.paused ? 0 : 1);
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(marginX - 5 + membraneDisp, height / 2, 24, -Math.PI / 2, Math.PI / 2);
      ctx.fill();

      // Mini Oscilloscope waveform overlay at bottom right
      if (oscilloscopeData && oscilloscopeData.length > 0) {
        const oscW = 160;
        const oscH = 50;
        const oscX = width - oscW - 20;
        const oscY = height - oscH - 20;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 1;
        ctx.fillRect(oscX, oscY, oscW, oscH);
        ctx.strokeRect(oscX, oscY, oscW, oscH);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const sliceW = oscW / oscilloscopeData.length;
        for (let i = 0; i < oscilloscopeData.length; i++) {
          const v = oscilloscopeData[i] / 128.0;
          const y = oscY + (v * oscH) / 2;
          const x = oscX + i * sliceW;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.font = '9px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText('OSCILOSCOPIO', oscX + 6, oscY + 12);
      }
    };

    animId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId.current);
  }, [state, calcs, oscilloscopeData]);

  return (
    <div className="relative w-full h-full min-h-[480px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 select-none flex flex-col">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Top Header Controls Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        {/* Metric Badges */}
        <div className="flex flex-wrap gap-2 pointer-events-auto">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs font-mono text-cyan-300 flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>LONGITUD DE ONDA (λ):</span>
            <span className="text-white font-semibold">{calcs.wavelengthM.toFixed(3)} m</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs font-mono text-emerald-300 flex items-center gap-1.5 shadow-lg">
            <span className="text-slate-400">c:</span>
            <span className="font-semibold text-white">{calcs.soundSpeedMps.toFixed(1)} m/s</span>
            <span className="text-slate-400 text-[10px]">({state.temperatureC}°C)</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs font-mono text-purple-300 flex items-center gap-1.5 shadow-lg">
            <span className="text-slate-400">Presión RMS:</span>
            <span className="font-semibold text-white">{calcs.pressureRmsPa.toFixed(3)} Pa</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Audio Synthesizer Button */}
          <button
            id="acoustics-audio-toggle-btn"
            onClick={onToggleAudio}
            className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-lg backdrop-blur-md border ${
              audioActive
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-500/20'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
            title="Activar tono de audio acústico"
          >
            {audioActive ? <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span>{audioActive ? 'Audio ON' : 'Audio OFF'}</span>
          </button>

          {/* Reference Particle Toggle */}
          <button
            id="acoustics-ref-particle-btn"
            onClick={() => onUpdateState({ showReferenceParticle: !state.showReferenceParticle })}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all backdrop-blur-md flex items-center gap-1.5 ${
              state.showReferenceParticle
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
            title="Mostrar la partícula de equilibrio de referencia"
          >
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>Partícula Referencia</span>
          </button>

          {/* Pause / Resume */}
          <button
            id="acoustics-pause-btn"
            onClick={() => onUpdateState({ paused: !state.paused })}
            className="p-2 rounded-xl text-xs bg-slate-900/80 text-slate-300 border border-slate-700/60 hover:bg-slate-800 transition-all backdrop-blur-md"
            title={state.paused ? 'Reanudar propagación' : 'Congelar onda'}
          >
            <Activity className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Floating Probe Telemetry */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none">
        {/* Sondas A, B, C */}
        <div className="flex gap-2 pointer-events-auto">
          {probeReadings.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 shadow-xl flex flex-col gap-0.5"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: state.probes.find(x => x.id === p.id)?.color || '#38bdf8' }} />
                <strong className="text-white font-semibold">Sonda {p.id}</strong>
              </div>
              <div className="text-[11px] text-slate-400">
                P: <span className="text-cyan-300">{p.pressurePa.toFixed(3)} Pa</span> | ξ: <span className="text-purple-300">{p.dispUm.toFixed(1)} µm</span>
              </div>
            </div>
          ))}
        </div>

        {/* Performance badge */}
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-400 shadow-xl pointer-events-auto flex items-center gap-2">
          <span>FPS: <strong className={fps >= 55 ? 'text-emerald-400' : 'text-amber-400'}>{fps}</strong></span>
          <span>•</span>
          <span>Onda Longitudinal P</span>
        </div>
      </div>
    </div>
  );
};
