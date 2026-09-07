/**
 * SonicLab 3D - Phased Array Beamforming & Active Noise Cancellation (ANC)
 * Visualizes 2D wave interference fields, acoustic directivity lobes, and quiet zones.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BeamformingState } from '../../types/soniclab';
import { BeamformingField, BeamformingPhysics } from '../../physics/BeamformingPhysics';
import { AudioEngine } from '../../audio/AudioEngine';
import {
  Compass,
  MicOff,
  Pause,
  Play,
  Radio,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  Zap,
} from 'lucide-react';

export function BeamformingView() {
  const [state, setState] = useState<BeamformingState>(() => {
    const defaultElements = BeamformingPhysics.updateElements(5, 0.35, 600, 0);
    return {
      elementCount: 5,
      spacingM: 0.35,
      frequencyHz: 600,
      steeringAngleDeg: 0,
      ancMode: false,
      noiseSourceDistanceM: 2.0,
      noiseSourceAngleDeg: 25,
      antiNoiseGain: 1.0,
      antiNoisePhaseDeg: 0,
      elements: defaultElements,
      paused: false,
      showFieldGrid: true,
      showIsobars: true,
    };
  });

  const [audioActive, setAudioActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const polarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<BeamformingField | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);

  // Sync speaker element positions and phase steering
  useEffect(() => {
    if (!state.ancMode) {
      const updated = BeamformingPhysics.updateElements(
        state.elementCount,
        state.spacingM,
        state.frequencyHz,
        state.steeringAngleDeg
      );
      setState((prev) => ({ ...prev, elements: updated }));
    }
  }, [state.elementCount, state.spacingM, state.frequencyHz, state.steeringAngleDeg, state.ancMode]);

  // Audio tone
  useEffect(() => {
    const audio = AudioEngine.getInstance();
    if (!audioActive) {
      audio.stopTone();
      return;
    }
    audio.setFrequency(state.frequencyHz);
    audio.setWaveform('sine');
  }, [audioActive, state.frequencyHz]);

  const handleToggleAudio = async () => {
    const audio = AudioEngine.getInstance();
    if (audioActive) {
      audio.stopTone();
      setAudioActive(false);
    } else {
      await audio.startTone(state.frequencyHz, 'sine');
      setAudioActive(true);
    }
  };

  // Main 2D Wavefield Animation Loop
  useEffect(() => {
    let animId: number;
    let time = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (!state.paused) {
        time += 0.03;
      }

      const w = canvas.width;
      const h = canvas.height;

      // Compute field (using cached buffers)
      const field = BeamformingPhysics.computeField(state, time, 70, 50);
      fieldRef.current = field;

      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Hardware-accelerated offscreen canvas & ImageData direct pixel buffer blitting
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const offscreen = offscreenCanvasRef.current;
      if (offscreen.width !== field.gridWidth || offscreen.height !== field.gridHeight) {
        offscreen.width = field.gridWidth;
        offscreen.height = field.gridHeight;
        offscreenCtxRef.current = offscreen.getContext('2d');
        imageDataRef.current = offscreenCtxRef.current?.createImageData(field.gridWidth, field.gridHeight) || null;
      }

      const imgData = imageDataRef.current;
      const offCtx = offscreenCtxRef.current;
      if (imgData && offCtx) {
        const data32 = new Uint32Array(imgData.data.buffer);
        const gw = field.gridWidth;
        const gh = field.gridHeight;
        const pData = field.pressureData;

        // Render direct 32-bit little-endian ABGR pixels (zero string allocations, zero fillRect)
        for (let gy = 0; gy < gh; gy++) {
          const srcRow = gy * gw;
          const dstRow = (gh - 1 - gy) * gw; // invert so y=0 is at bottom

          for (let gx = 0; gx < gw; gx++) {
            const p = pData[srcRow + gx];
            const mag = Math.min(Math.abs(p), 1.0);

            let r = 0;
            let g = 0;
            let b = 0;
            if (p > 0) {
              r = (mag * 240) | 0;
              g = (mag * 80) | 0;
              b = (mag * 90) | 0;
            } else {
              r = (mag * 30) | 0;
              g = (mag * 120) | 0;
              b = (mag * 240) | 0;
            }

            data32[dstRow + gx] = (0xff << 24) | (b << 16) | (g << 8) | r;
          }
        }
        offCtx.putImageData(imgData, 0, 0);

        // Hardware-accelerated GPU blit with bilinear smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offscreen, 0, 0, w, h);
      }

      // Draw Loudspeakers / Emitters at y = bottom
      const mapXToCanvas = (xm: number) => {
        return ((xm - field.minX) / (field.maxX - field.minX)) * w;
      };
      const mapYToCanvas = (ym: number) => {
        return h - ((ym - field.minY) / (field.maxY - field.minY)) * h;
      };

      if (state.ancMode) {
        // Draw Primary Noise Source (Red Speaker)
        const noiseRad = (state.noiseSourceAngleDeg * Math.PI) / 180;
        const nx = state.noiseSourceDistanceM * Math.sin(noiseRad);
        const ny = state.noiseSourceDistanceM * Math.cos(noiseRad);
        const cx = mapXToCanvas(nx);
        const cy = mapYToCanvas(ny);

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#f87171';
        ctx.font = '11px monospace';
        ctx.fillText('Fuente de Ruido Primario', cx - 70, cy - 14);

        // Draw Anti-Noise Speaker at (0, 0)
        const ax = mapXToCanvas(0);
        const ay = mapYToCanvas(0.2);
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(ax, ay, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#67e8f9';
        ctx.fillText('Altavoz Anti-Ruido (Fase Invertida 180°)', ax - 110, ay + 22);

        // Highlight Quiet Zone (Destructive Cancellation)
        const qx = mapXToCanvas(0);
        const qy = mapYToCanvas(1.5);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(qx, qy, 50, 35, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#34d399';
        ctx.fillText('Zona de Silencio (ANC)', qx - 60, qy + 4);
      } else {
        // Draw Phased Array Speakers
        state.elements.forEach((el) => {
          if (!el.active) return;
          const cx = mapXToCanvas(el.posX);
          const cy = h - 16;

          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });

        // Draw Steering Vector Line
        const steerRad = (state.steeringAngleDeg * Math.PI) / 180;
        const arrayCenterPx = mapXToCanvas(0);
        const vectorLen = 140;
        const endX = arrayCenterPx + vectorLen * Math.sin(steerRad);
        const endY = h - 20 - vectorLen * Math.cos(steerRad);

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(arrayCenterPx, h - 20);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#fbbf24';
        ctx.font = '11px monospace';
        ctx.fillText(`Dirección del Haz: ${state.steeringAngleDeg}°`, endX + 8, endY);
      }

      // Polar Directivity Pattern
      const polarCanvas = polarCanvasRef.current;
      if (polarCanvas && field.directivityAnglesDeg.length > 0) {
        const pctx = polarCanvas.getContext('2d');
        if (pctx) {
          const pw = polarCanvas.width;
          const ph = polarCanvas.height;
          pctx.fillStyle = '#020617';
          pctx.fillRect(0, 0, pw, ph);

          const pcx = pw * 0.5;
          const pcy = ph * 0.85;
          const maxRadius = Math.min(pw * 0.42, ph * 0.7);

          // Draw polar concentric circles (dB rings)
          pctx.strokeStyle = '#1e293b';
          pctx.lineWidth = 1;
          for (const db of [-10, -20, -30]) {
            const rad = maxRadius * (1 + db / 35);
            pctx.beginPath();
            pctx.arc(pcx, pcy, rad, Math.PI, 0);
            pctx.stroke();
          }

          // Angle rays
          for (let a = -60; a <= 60; a += 30) {
            const rad = ((a - 90) * Math.PI) / 180;
            pctx.beginPath();
            pctx.moveTo(pcx, pcy);
            pctx.lineTo(pcx + maxRadius * Math.cos(rad), pcy + maxRadius * Math.sin(rad));
            pctx.stroke();
          }

          // Draw Directivity Lobe
          pctx.strokeStyle = '#38bdf8';
          pctx.lineWidth = 2.5;
          pctx.beginPath();

          for (let i = 0; i < field.directivityAnglesDeg.length; i++) {
            const deg = field.directivityAnglesDeg[i];
            const db = field.directivityDb[i];
            const normRad = Math.max((35 + db) / 35, 0.02) * maxRadius;
            const rad = ((deg - 90) * Math.PI) / 180;
            const px = pcx + normRad * Math.cos(rad);
            const py = pcy + normRad * Math.sin(rad);

            if (i === 0) pctx.moveTo(px, py);
            else pctx.lineTo(px, py);
          }
          pctx.stroke();

          pctx.fillStyle = '#94a3b8';
          pctx.font = '9px monospace';
          pctx.fillText('Lóbulo de Radiación (dB)', 10, 16);
          pctx.fillText('0 dB', pcx - 12, pcy - maxRadius - 4);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [state]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Selector: Phased Array vs ANC */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            id="beamforming-mode-btn"
            onClick={() => setState((p) => ({ ...p, ancMode: false }))}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              !state.ancMode
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Arreglo en Fase (Beamforming)</span>
          </button>

          <button
            id="anc-mode-btn"
            onClick={() => setState((p) => ({ ...p, ancMode: true }))}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              state.ancMode
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <MicOff className="w-4 h-4 text-emerald-400" />
            <span>Cancelación Activa de Ruido (ANC)</span>
          </button>
        </div>

        {/* Global Sound Tone */}
        <button
          id="beamforming-audio-toggle"
          onClick={handleToggleAudio}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition-all ${
            audioActive
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
          }`}
        >
          {audioActive ? (
            <>
              <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>Sintetizador Sonando</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-slate-500" />
              <span>Escuchar Tono</span>
            </>
          )}
        </button>
      </div>

      {/* Main Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 2D Interference Map */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-[480px]">
            <canvas ref={canvasRef} width={800} height={480} className="w-full h-full object-cover" />

            {/* Overlaid polar directivity pattern */}
            {!state.ancMode && (
              <div className="absolute top-4 right-4 bg-slate-950/90 border border-slate-800 p-2 rounded-xl shadow-lg">
                <canvas ref={polarCanvasRef} width={180} height={140} className="w-[180px] h-[140px]" />
              </div>
            )}

            {/* Status indicator */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-900/90 text-cyan-300 border border-slate-800">
                {state.ancMode ? 'MODO CANCELACIÓN ACTIVA' : `HAZ DIRIGIDO A ${state.steeringAngleDeg}°`}
              </span>
              <span className="text-xs text-slate-400 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
                f = {state.frequencyHz} Hz (λ = {(343 / state.frequencyHz).toFixed(2)} m)
              </span>
            </div>

            {/* Color Map Legend */}
            <div className="absolute bottom-4 left-4 flex items-center gap-3 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-[11px]">
              <span className="text-rose-400">+ Compresión</span>
              <span className="w-16 h-2 rounded bg-gradient-to-r from-blue-500 via-slate-900 to-rose-500 inline-block" />
              <span className="text-blue-400">- Rarefacción</span>
            </div>
          </div>
        </div>

        {/* Right: Controls & Adjustments */}
        <div className="lg:col-span-4 flex flex-col gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>{state.ancMode ? 'Control Anti-Ruido' : 'Parámetros del Arreglo'}</span>
          </h3>

          {/* Frecuencia común */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Frecuencia Acústica</span>
              <span className="font-mono text-cyan-300 font-bold">{state.frequencyHz} Hz</span>
            </div>
            <input
              type="range"
              min="200"
              max="1500"
              step="10"
              value={state.frequencyHz}
              onChange={(e) => setState((p) => ({ ...p, frequencyHz: parseInt(e.target.value) }))}
              className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {!state.ancMode ? (
            <>
              {/* Ángulo de direccionamiento (Steering Angle) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Ángulo de Apuntamiento (θ)</span>
                  <span className="font-mono text-amber-300 font-bold">{state.steeringAngleDeg}°</span>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  step="1"
                  value={state.steeringAngleDeg}
                  onChange={(e) => setState((p) => ({ ...p, steeringAngleDeg: parseInt(e.target.value) }))}
                  className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>-60° (Izquierda)</span>
                  <span>0° (Frente)</span>
                  <span>+60° (Derecha)</span>
                </div>
              </div>

              {/* Número de Altavoces */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Número de Emisores (N)</span>
                  <span className="font-mono text-white font-bold">{state.elementCount}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="1"
                  value={state.elementCount}
                  onChange={(e) => setState((p) => ({ ...p, elementCount: parseInt(e.target.value) }))}
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Espaciado d */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Espaciado entre Emisores (d)</span>
                  <span className="font-mono text-white font-bold">{state.spacingM.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={state.spacingM}
                  onChange={(e) => setState((p) => ({ ...p, spacingM: parseFloat(e.target.value) }))}
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="text-[11px] text-slate-500 font-mono">
                  Relación d/λ = {(state.spacingM / (343 / state.frequencyHz)).toFixed(2)}
                </span>
              </div>
            </>
          ) : (
            <>
              {/* ANC Controls */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col gap-2">
                <span className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Principio de Interferencia Destructiva</span>
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  El altavoz secundario emite una onda invertida de presión P_anti = -P_ruido (desfasada
                  180°). En la zona de cancelación, la suma neta de presión se anula (P_total ≈ 0).
                </p>
              </div>

              {/* Distancia del Ruido */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Distancia Fuente de Ruido</span>
                  <span className="font-mono text-white">{state.noiseSourceDistanceM.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.5"
                  step="0.1"
                  value={state.noiseSourceDistanceM}
                  onChange={(e) =>
                    setState((p) => ({ ...p, noiseSourceDistanceM: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-rose-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Ajuste Fino de Fase */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Ajuste Fino de Fase Anti-Ruido</span>
                  <span className="font-mono text-emerald-300">
                    180° + {state.antiNoisePhaseDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="1"
                  value={state.antiNoisePhaseDeg}
                  onChange={(e) =>
                    setState((p) => ({ ...p, antiNoisePhaseDeg: parseInt(e.target.value) }))
                  }
                  className="w-full accent-emerald-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Ganancia Anti-Ruido */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Ganancia Anti-Ruido</span>
                  <span className="font-mono text-emerald-300 font-bold">
                    {(state.antiNoiseGain * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  value={state.antiNoiseGain}
                  onChange={(e) =>
                    setState((p) => ({ ...p, antiNoiseGain: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-emerald-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
