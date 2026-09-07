import React, { useState } from "react";
import { AcousticsState, AcousticCalculations } from "../../types/soniclab";
import { SonicParticleStage, Selection } from "./SonicParticleStage";
import { envelope, fieldSample } from "../../physics/ParticleField";

interface Props {
  state: AcousticsState;
  calcs: AcousticCalculations;
  onUpdateState: (patch: Partial<AcousticsState>) => void;
  onToggleAudio: () => void;
  audioActive: boolean;
  oscilloscopeData?: Uint8Array;
}
export const AcousticLab: React.FC<Props> = ({
  state,
  calcs,
  onUpdateState,
  onToggleAudio,
  audioActive,
}) => {
  const [quality, setQuality] = useState(120000);
  const [hold, setHold] = useState(false);
  const [stats, setStats] = useState({
    fps: 0,
    count: quality,
    time: 0,
    selection: null as Selection | null,
  });
  const [readings, setReadings] = useState<
    { id: string; pressure: number; displacement: number }[]
  >([]);
  const update = (
    fps: number,
    count: number,
    time: number,
    selection: Selection | null,
  ) => {
    if (hold) return;
    setStats({ fps, count, time, selection });
    // Windowed RMS/peak over 8 primary periods: stable, physical units, not visual displacement.
    setReadings(
      state.probes.map((probe) => {
        let squared = 0,
          peak = 0;
        for (let i = 0; i < 128; i++) {
          const p = fieldSample(
            probe.distanceM,
            0,
            0,
            time + (i * 8) / (128 * state.frequencyHz),
            state,
            calcs,
          );
          squared += p.pressure * p.pressure;
          peak = Math.max(peak, Math.hypot(p.dx, p.dy, p.dz));
        }
        return {
          id: probe.id,
          pressure: Math.sqrt(squared / 128),
          displacement: peak * 1e6,
        };
      }),
    );
  };
  return (
    <section className="acoustic-lab" aria-label="Laboratorio acústico 3D">
      <div className="acoustic-heading">
        <div>
          <span className="eyebrow">CAMPO VOLUMÉTRICO</span>
          <h2>Ondas de sonido · 3D</h2>
        </div>
        <span className="build-badge">1.2 · ORBIT</span>
      </div>
      <div className="metric-grid">
        <div>
          <span>Longitud de onda</span>
          <strong>
            {calcs.wavelengthM.toFixed(3)} <small>m</small>
          </strong>
        </div>
        <div>
          <span>Velocidad del sonido</span>
          <strong>
            {calcs.soundSpeedMps.toFixed(1)} <small>m/s</small>
          </strong>
        </div>
        <div>
          <span>Presión RMS a 1 m</span>
          <strong>
            {calcs.pressureRmsPa.toFixed(3)} <small>Pa</small>
          </strong>
        </div>
      </div>
      <div className="lab-toolbar">
        <button onClick={() => onUpdateState({ paused: !state.paused })}>
          {state.paused ? "▶ Reanudar" : "Ⅱ Pausar"}
        </button>
        <button onClick={onToggleAudio}>
          {audioActive ? "Silenciar audio" : "Activar audio"}
        </button>
        <button onClick={() => setHold(!hold)} aria-pressed={hold}>
          {hold ? "Actualizar lecturas" : "Fijar lecturas"}
        </button>
      </div>
      <SonicParticleStage
        state={state}
        calcs={calcs}
        quality={quality}
        onStats={update}
      />
      <p className="gesture-help">
        Arrastra: girar · Pellizca: zoom · Dos dedos: desplazar · Toca:
        seleccionar
      </p>
      <div className="quality-row">
        <label>
          Partículas{" "}
          <select
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          >
            <option value={30000}>30.000 · Ahorro</option>
            <option value={60000}>60.000 · Equilibrado</option>
            <option value={120000}>120.000 · Alta</option>
          </select>
        </label>
        <span>{stats.fps} FPS · Cámara lenta</span>
      </div>
      <div className="probe-grid">
        {state.probes.map((probe) => {
          const p = readings.find((r) => r.id === probe.id);
          return (
            <div key={probe.id}>
              <h3 style={{ color: probe.color }}>
                Sonda {probe.id} <small>{probe.distanceM.toFixed(1)} m</small>
              </h3>
              <span>Presión RMS</span>
              <strong>
                {(
                  p?.pressure ??
                  calcs.pressureRmsPa *
                    envelope(probe.distanceM, calcs.attenuationDbPerM)
                ).toFixed(3)}{" "}
                Pa
              </strong>
              <span>Desplazamiento pico</span>
              <strong>{p ? p.displacement.toFixed(3) : "—"} µm</strong>
            </div>
          );
        })}
      </div>
      <div className="selection-card" aria-label="Partícula seleccionada">
        {stats.selection ? (
          <>
            <strong>Partícula #{stats.selection.index}</strong>
            <span>
              Posición de equilibrio: ({stats.selection.x.toFixed(2)},{" "}
              {stats.selection.y.toFixed(2)}, {stats.selection.z.toFixed(2)}) m
            </span>
            <span>
              Presión instantánea: {stats.selection.pressure.toFixed(4)} Pa ·
              Desplazamiento: {stats.selection.displacement.toFixed(3)} µm
            </span>
          </>
        ) : (
          <span>
            Toca una partícula para inspeccionarla; «Enfocar selección» te
            acerca a ella.
          </span>
        )}
      </div>
      <p className="measurement-note">
        Lecturas cada 0,5 s · RMS y pico en ventana de 8 ciclos. La animación se
        ralentiza y amplifica; los valores físicos no.
      </p>
    </section>
  );
};
