/**
 * SonicLab 3D - Classic Resonators View (Kundt's Tube & Helmholtz Resonator)
 * Features real-time particle dynamics, standing wave envelope, and acoustic impedance.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HelmholtzState, KundtState } from '../../types/soniclab';
import { ResonatorsPhysics, KundtCalculations, HelmholtzCalculations } from '../../physics/ResonatorsPhysics';
import { AudioEngine } from '../../audio/AudioEngine';
import {
  Activity,
  Gauge,
  Info,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  Zap,
} from 'lucide-react';

export function ResonatorsView() {
  const [activeTab, setActiveTab] = useState<'kundt' | 'helmholtz'>('kundt');
  const [audioActive, setAudioActive] = useState(false);

  // Kundt state
  const [kundtState, setKundtState] = useState<KundtState>({
    lengthM: 1.0,
    tubeBoundary: 'open_closed',
    frequencyHz: 343,
    temperatureC: 20,
    gasType: 'air',
    corkParticleCount: 1500,
    amplitude: 0.8,
    paused: false,
    showPressureWave: true,
    showVelocityWave: true,
  });

  // Helmholtz state
  const [helmholtzState, setHelmholtzState] = useState<HelmholtzState>({
    cavityVolumeLiters: 1.2,
    neckLengthCm: 4.5,
    neckRadiusCm: 1.4,
    temperatureC: 20,
    damping: 0.04,
    driveFrequencyHz: 215,
    excitationLevel: 0.8,
    paused: false,
  });

  // Physics calculations
  const kundtCalcs: KundtCalculations = useMemo(
    () => ResonatorsPhysics.calculateKundt(kundtState),
    [kundtState]
  );

  const helmholtzCalcs: HelmholtzCalculations = useMemo(
    () => ResonatorsPhysics.calculateHelmholtz(helmholtzState),
    [helmholtzState]
  );

  // Canvas refs
  const kundtCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const helmholtzCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cork particles for Kundt's tube
  const particlesRef = useRef<Float32Array | null>(null); // [x0, y0, vx, vy, ...]
  useEffect(() => {
    const count = kundtState.corkParticleCount;
    const arr = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      arr[i * 4 + 0] = Math.random(); // normalized x [0, 1]
      arr[i * 4 + 1] = 0.5 + (Math.random() - 0.5) * 0.7; // normalized y [0.15, 0.85]
      arr[i * 4 + 2] = 0; // vx
      arr[i * 4 + 3] = 0; // vy
    }
    particlesRef.current = arr;
  }, [kundtState.corkParticleCount]);

  // Audio tone synchronization
  useEffect(() => {
    const audio = AudioEngine.getInstance();
    if (!audioActive) {
      audio.stopTone();
      return;
    }
    const freq = activeTab === 'kundt' ? kundtState.frequencyHz : helmholtzState.driveFrequencyHz;
    audio.setFrequency(freq);
    audio.setWaveform('sine');
  }, [audioActive, activeTab, kundtState.frequencyHz, helmholtzState.driveFrequencyHz]);

  const handleToggleAudio = async () => {
    const audio = AudioEngine.getInstance();
    if (audioActive) {
      audio.stopTone();
      setAudioActive(false);
    } else {
      const freq = activeTab === 'kundt' ? kundtState.frequencyHz : helmholtzState.driveFrequencyHz;
      await audio.startTone(freq, 'sine');
      setAudioActive(true);
    }
  };

  // Kundt Canvas Animation Loop
  useEffect(() => {
    if (activeTab !== 'kundt') return;
    let animId: number;
    let time = 0;

    const render = () => {
      const canvas = kundtCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      if (!kundtState.paused) {
        time += 0.035;
      }

      // Background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Tube parameters in pixels
      const tubeLeft = 60;
      const tubeRight = w - 60;
      const tubeTop = 90;
      const tubeHeight = h - 220;
      const tubeBottom = tubeTop + tubeHeight;
      const tubeWidth = tubeRight - tubeLeft;

      // Draw Glass Tube Frame
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(tubeLeft, tubeTop, tubeWidth, tubeHeight, 12);
      ctx.fill();
      ctx.stroke();

      // Draw Stopper caps based on boundary condition
      ctx.fillStyle = '#64748b';
      if (kundtState.tubeBoundary === 'closed_closed' || kundtState.tubeBoundary === 'open_closed') {
        // Right end closed
        ctx.fillRect(tubeRight - 8, tubeTop - 4, 12, tubeHeight + 8);
      }
      if (kundtState.tubeBoundary === 'closed_closed') {
        // Left end closed
        ctx.fillRect(tubeLeft - 4, tubeTop - 4, 12, tubeHeight + 8);
      } else {
        // Left end speaker exciter
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.moveTo(tubeLeft - 25, tubeTop - 10);
        ctx.lineTo(tubeLeft, tubeTop + 20);
        ctx.lineTo(tubeLeft, tubeBottom - 20);
        ctx.lineTo(tubeLeft - 25, tubeBottom + 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
      }
      ctx.restore();

      // Physics variables
      const L = kundtState.lengthM;
      const f = kundtState.frequencyHz;
      const c = kundtCalcs.soundSpeedMps;
      const k = (2 * Math.PI * f) / c;
      const omega = 2 * Math.PI * f;

      // Particle dynamics: Acoustic radiation force pushes cork dust towards velocity nodes
      const particles = particlesRef.current;
      if (particles) {
        const count = particles.length / 4;
        const resonanceFactor = kundtCalcs.isNearResonance ? 1.0 : 0.15;
        const forceMag = 0.002 * kundtState.amplitude * resonanceFactor;

        ctx.fillStyle = '#fbbf24'; // Cork dust color
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          let x = particles[i * 4 + 0];
          let y = particles[i * 4 + 1];

          if (!kundtState.paused) {
            const posX = x * L;
            // Particle velocity u(x) ~ sin(kx)
            let uSpatial = 0;
            if (kundtState.tubeBoundary === 'open_closed') {
              uSpatial = Math.sin(k * (L - posX));
            } else {
              uSpatial = Math.sin(k * posX);
            }

            // Acoustic radiation drift force towards velocity nodes (where uSpatial is zero)
            const drift = -forceMag * Math.sin(2 * k * posX);
            const brownian = (Math.random() - 0.5) * 0.001;
            x += drift + brownian;

            // Constrain inside tube [0.01, 0.99]
            if (x < 0.01) x = 0.01;
            if (x > 0.99) x = 0.99;

            // Gravity sedimentation: particles settle towards bottom when at node
            const atNode = Math.abs(uSpatial) < 0.25;
            if (atNode && y < 0.88) {
              y += 0.002;
            } else if (!atNode) {
              y += (Math.random() - 0.5) * 0.01;
            }
            if (y > 0.92) y = 0.92;
            if (y < 0.12) y = 0.12;

            particles[i * 4 + 0] = x;
            particles[i * 4 + 1] = y;
          }

          // Batch particle arc into unified path
          const px = tubeLeft + x * tubeWidth;
          const py = tubeTop + y * tubeHeight;
          ctx.moveTo(px + 1.8, py);
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Draw Standing Wave Curves (Pressure & Velocity envelopes)
      const centerY = tubeTop + tubeHeight * 0.5;
      const waveAmpPx = tubeHeight * 0.35 * (kundtCalcs.isNearResonance ? 1.0 : 0.3);

      if (kundtState.showPressureWave) {
        // Red wave: Pressure P(x)
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let gx = 0; gx <= tubeWidth; gx += 4) {
          const xM = (gx / tubeWidth) * L;
          let pVal = 0;
          if (kundtState.tubeBoundary === 'open_closed') {
            pVal = Math.cos(k * (L - xM)) * Math.cos(omega * time);
          } else {
            pVal = Math.cos(k * xM) * Math.cos(omega * time);
          }
          const wy = centerY - pVal * waveAmpPx;
          if (gx === 0) ctx.moveTo(tubeLeft + gx, wy);
          else ctx.lineTo(tubeLeft + gx, wy);
        }
        ctx.stroke();
      }

      if (kundtState.showVelocityWave) {
        // Cyan wave: Particle Displacement/Velocity u(x)
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let gx = 0; gx <= tubeWidth; gx += 4) {
          const xM = (gx / tubeWidth) * L;
          let uVal = 0;
          if (kundtState.tubeBoundary === 'open_closed') {
            uVal = Math.sin(k * (L - xM)) * Math.sin(omega * time);
          } else {
            uVal = Math.sin(k * xM) * Math.sin(omega * time);
          }
          const wy = centerY - uVal * waveAmpPx;
          if (gx === 0) ctx.moveTo(tubeLeft + gx, wy);
          else ctx.lineTo(tubeLeft + gx, wy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Markers for Node piles
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px monospace';
      kundtCalcs.velocityNodesX.forEach((nx) => {
        if (nx >= 0 && nx <= L) {
          const px = tubeLeft + (nx / L) * tubeWidth;
          ctx.beginPath();
          ctx.arc(px, tubeBottom + 12, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(`Nodo ${nx.toFixed(2)}m`, px - 25, tubeBottom + 26);
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeTab, kundtState, kundtCalcs]);

  // Helmholtz Canvas Animation Loop
  useEffect(() => {
    if (activeTab !== 'helmholtz') return;
    let animId: number;
    let time = 0;

    const render = () => {
      const canvas = helmholtzCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      if (!helmholtzState.paused) {
        time += 0.05;
      }

      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Center geometry of the Helmholtz resonator
      const cx = w * 0.38;
      const cy = h * 0.52;
      const cavityRadiusPx = Math.min(Math.max(Math.cbrt(helmholtzState.cavityVolumeLiters) * 110, 80), 160);
      const neckWidthPx = Math.min(Math.max(helmholtzState.neckRadiusCm * 35, 20), 80);
      const neckHeightPx = Math.min(Math.max(helmholtzState.neckLengthCm * 12, 30), 120);

      // Draw Cavity Body (Flask)
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';

      // Cavity sphere/flask
      ctx.beginPath();
      ctx.arc(cx, cy + neckHeightPx * 0.5, cavityRadiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Neck channel
      ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
      ctx.fillRect(cx - neckWidthPx * 0.5, cy - neckHeightPx * 0.5, neckWidthPx, neckHeightPx);
      ctx.strokeRect(cx - neckWidthPx * 0.5, cy - neckHeightPx * 0.5, neckWidthPx, neckHeightPx);

      // Oscillating Air Slug inside neck (Acoustic Mass)
      const response = helmholtzCalcs.responseMagnitude;
      const dispPx = Math.min(response * 18 * helmholtzState.excitationLevel, neckHeightPx * 0.4);
      const slugY = cy + Math.sin(time * 3) * dispPx;

      ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.fillRect(cx - neckWidthPx * 0.5 + 4, slugY - 14, neckWidthPx - 8, 28);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - neckWidthPx * 0.5 + 4, slugY - 14, neckWidthPx - 8, 28);

      // Cavity Air Compression / Rarefaction Aura
      const cavityPressurePhase = Math.sin(time * 3 + Math.PI * 0.5);
      const auraAlpha = Math.max(0.1 + (cavityPressurePhase * 0.2 * response) / 10, 0.05);
      ctx.fillStyle = `rgba(244, 63, 94, ${auraAlpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy + neckHeightPx * 0.5, cavityRadiusPx - 6, 0, Math.PI * 2);
      ctx.fill();

      // Label on air slug
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Masa Acústica (Tapón)', cx, slugY + 4);

      // Sound Waves exiting the mouth
      for (let r = 1; r <= 3; r++) {
        const waveRadius = ((time * 40 + r * 30) % 100) + neckWidthPx * 0.5;
        const alpha = 1 - waveRadius / 140;
        if (alpha > 0) {
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.7})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy - neckHeightPx * 0.5, waveRadius, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        }
      }

      ctx.restore();

      // Draw Resonance Curve H(f) on Right Side (Frequency Response)
      const graphLeft = w * 0.68;
      const graphTop = 80;
      const graphW = w * 0.28;
      const graphH = h - 160;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.fillRect(graphLeft, graphTop, graphW, graphH);
      ctx.strokeRect(graphLeft, graphTop, graphW, graphH);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Curva de Resonancia |H(f)|', graphLeft + 10, graphTop + 20);

      // Draw peak curve
      const fRes = helmholtzCalcs.resonantFrequencyHz;
      const fMin = Math.max(fRes * 0.3, 20);
      const fMax = fRes * 1.8;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let px = 0; px <= graphW; px += 2) {
        const freq = fMin + (px / graphW) * (fMax - fMin);
        const r_ratio = freq / fRes;
        const zeta = helmholtzState.damping;
        const denom = Math.sqrt(Math.pow(1 - r_ratio * r_ratio, 2) + Math.pow(2 * zeta * r_ratio, 2));
        const resp = denom > 0 ? 1 / denom : 0;
        const normalizedResp = Math.min(resp / helmholtzCalcs.qualityFactorQ, 1.0);
        const py = graphTop + graphH - 10 - normalizedResp * (graphH - 45);

        if (px === 0) ctx.moveTo(graphLeft + px, py);
        else ctx.lineTo(graphLeft + px, py);
      }
      ctx.stroke();

      // Draw active frequency marker line
      const activeX =
        graphLeft +
        ((helmholtzState.driveFrequencyHz - fMin) / (fMax - fMin)) * graphW;
      if (activeX >= graphLeft && activeX <= graphLeft + graphW) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(activeX, graphTop);
        ctx.lineTo(activeX, graphTop + graphH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`${helmholtzState.driveFrequencyHz} Hz`, activeX - 18, graphTop + graphH + 18);
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeTab, helmholtzState, helmholtzCalcs]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            id="tab-kundt-btn"
            onClick={() => setActiveTab('kundt')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'kundt'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Tubo de Kundt (Ondas Estacionarias & Polvo de Corcho)</span>
          </button>

          <button
            id="tab-helmholtz-btn"
            onClick={() => setActiveTab('helmholtz')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'helmholtz'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Gauge className="w-4 h-4 text-amber-400" />
            <span>Resonador de Helmholtz (Masa-Resorte Acústico)</span>
          </button>
        </div>

        {/* Global Sound Tone Toggle */}
        <button
          id="resonator-audio-btn"
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

      {/* 1. VISTA DEL TUBO DE KUNDT */}
      {activeTab === 'kundt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Canvas Display (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-[480px]">
              <canvas
                ref={kundtCanvasRef}
                width={850}
                height={480}
                className="w-full h-full object-contain"
              />

              {/* Status Overlay */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                    kundtCalcs.isNearResonance
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900/90 text-slate-400 border-slate-800'
                  }`}
                >
                  {kundtCalcs.isNearResonance ? 'RESONANCIA ACTIVA' : 'FUERA DE RESONANCIA'}
                </span>
                <span className="text-xs text-slate-400 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800">
                  Armónico n={kundtCalcs.activeHarmonicN}
                </span>
              </div>

              {/* Legend Bottom */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[11px] bg-slate-950/80 p-2 rounded-xl border border-slate-800/80 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-3 h-0.5 bg-rose-400 inline-block" />
                    <span>Presión P(x)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <span className="w-3 h-0.5 border-b border-dashed border-cyan-400 inline-block" />
                    <span>Velocidad u(x)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    <span>Polvo de Corcho (Acumula en Nodos de Velocidad)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls Panel (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Parámetros del Tubo de Kundt</span>
            </h3>

            {/* Frecuencia */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Frecuencia Excitadora</span>
                <span className="font-mono text-cyan-300 font-bold">{kundtState.frequencyHz} Hz</span>
              </div>
              <input
                type="range"
                min="50"
                max="1200"
                step="1"
                value={kundtState.frequencyHz}
                onChange={(e) => setKundtState((p) => ({ ...p, frequencyHz: parseInt(e.target.value) }))}
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() =>
                    setKundtState((p) => ({
                      ...p,
                      frequencyHz: Math.round(kundtCalcs.nearestResonanceHz),
                    }))
                  }
                  className="px-2 py-1 rounded text-[11px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Sintonizar {kundtCalcs.nearestResonanceHz.toFixed(0)} Hz</span>
                </button>
              </div>
            </div>

            {/* Condiciones de Borde */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400">Condición de Extremos</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setKundtState((p) => ({ ...p, tubeBoundary: 'open_closed' }))}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border ${
                    kundtState.tubeBoundary === 'open_closed'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  Abierto - Cerrado (λ/4)
                </button>
                <button
                  onClick={() => setKundtState((p) => ({ ...p, tubeBoundary: 'closed_closed' }))}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border ${
                    kundtState.tubeBoundary === 'closed_closed'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  Cerrado - Cerrado (λ/2)
                </button>
              </div>
            </div>

            {/* Medio Gaseoso */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400">Gas en el Tubo</span>
              <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                {(['air', 'helium', 'co2', 'sf6'] as const).map((gas) => (
                  <button
                    key={gas}
                    onClick={() => setKundtState((p) => ({ ...p, gasType: gas }))}
                    className={`py-1 rounded border uppercase font-mono ${
                      kundtState.gasType === gas
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {gas}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Velocidad del sonido c: {kundtCalcs.soundSpeedMps.toFixed(1)} m/s
              </span>
            </div>

            {/* Longitud del Tubo */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Longitud del Tubo (L)</span>
                <span className="font-mono text-white">{kundtState.lengthM.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.0"
                step="0.05"
                value={kundtState.lengthM}
                onChange={(e) => setKundtState((p) => ({ ...p, lengthM: parseFloat(e.target.value) }))}
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. VISTA DEL RESONADOR DE HELMHOLTZ */}
      {activeTab === 'helmholtz' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Canvas Display (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-[480px]">
              <canvas
                ref={helmholtzCanvasRef}
                width={850}
                height={480}
                className="w-full h-full object-contain"
              />

              {/* Status Header */}
              <div className="absolute top-4 left-4 flex items-center gap-3">
                <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl flex items-center gap-2">
                  <span className="text-xs text-slate-400">Frecuencia de Resonancia:</span>
                  <span className="text-sm font-mono font-bold text-amber-300">
                    {helmholtzCalcs.resonantFrequencyHz.toFixed(1)} Hz
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl flex items-center gap-2">
                  <span className="text-xs text-slate-400">Factor de Calidad Q:</span>
                  <span className="text-sm font-mono font-bold text-cyan-300">
                    {helmholtzCalcs.qualityFactorQ.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls Panel (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Gauge className="w-4 h-4 text-amber-400" />
              <span>Geometría del Resonador</span>
            </h3>

            {/* Volumen Cavidad V */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Volumen de Cavidad (V)</span>
                <span className="font-mono text-amber-300 font-bold">
                  {helmholtzState.cavityVolumeLiters.toFixed(2)} Litros
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="5.0"
                step="0.1"
                value={helmholtzState.cavityVolumeLiters}
                onChange={(e) =>
                  setHelmholtzState((p) => ({ ...p, cavityVolumeLiters: parseFloat(e.target.value) }))
                }
                className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Longitud del Cuello L */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Longitud del Cuello (L)</span>
                <span className="font-mono text-amber-300 font-bold">
                  {helmholtzState.neckLengthCm.toFixed(1)} cm
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="15.0"
                step="0.5"
                value={helmholtzState.neckLengthCm}
                onChange={(e) =>
                  setHelmholtzState((p) => ({ ...p, neckLengthCm: parseFloat(e.target.value) }))
                }
                className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Radio del Cuello r */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Radio del Cuello (r)</span>
                <span className="font-mono text-amber-300 font-bold">
                  {helmholtzState.neckRadiusCm.toFixed(1)} cm
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.5"
                step="0.1"
                value={helmholtzState.neckRadiusCm}
                onChange={(e) =>
                  setHelmholtzState((p) => ({ ...p, neckRadiusCm: parseFloat(e.target.value) }))
                }
                className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Frecuencia Excitadora */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Frecuencia Excitadora</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {helmholtzState.driveFrequencyHz} Hz
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="800"
                step="1"
                value={helmholtzState.driveFrequencyHz}
                onChange={(e) =>
                  setHelmholtzState((p) => ({ ...p, driveFrequencyHz: parseInt(e.target.value) }))
                }
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              <button
                onClick={() =>
                  setHelmholtzState((p) => ({
                    ...p,
                    driveFrequencyHz: Math.round(helmholtzCalcs.resonantFrequencyHz),
                  }))
                }
                className="px-2.5 py-1 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all flex items-center justify-center gap-1.5 mt-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Sintonizar Frecuencia Resonante ({helmholtzCalcs.resonantFrequencyHz.toFixed(0)} Hz)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
