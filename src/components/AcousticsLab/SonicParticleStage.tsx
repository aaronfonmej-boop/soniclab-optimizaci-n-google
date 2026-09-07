import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AcousticCalculations, AcousticsState } from "../../types/soniclab";
import { fieldSample } from "../../physics/ParticleField";

export interface Selection {
  index: number;
  x: number;
  y: number;
  z: number;
  pressure: number;
  displacement: number;
}
interface Props {
  state: AcousticsState;
  calcs: AcousticCalculations;
  quality: number;
  onStats: (
    fps: number,
    count: number,
    time: number,
    selection: Selection | null,
  ) => void;
}
const vertexShader = `
uniform float uTime,uFrequency,uSpeed,uPeak,uDensity,uAbsorption,uScale,uDpr;
uniform float uFrequencyB,uDistanceB,uPhaseB;
uniform int uSecondary,uWaveform,uHarmonic,uSelected,uReference,uFronts;
uniform vec4 uHarmonics;
varying vec3 vColor; varying float vAlpha;
const float TAU=6.28318530718;
vec2 wave(float phase) {
  if(uHarmonic==0 && uWaveform==0)return vec2(sin(phase),cos(phase));
  vec2 result=vec2(0.0);
  for(int i=0;i<4;i++){
    float n=uHarmonic==1?float(i+1):float(2*i+1);
    float gain=uHarmonics[i];
    if(uHarmonic==0)gain=uWaveform==1?(i%2==0?1.0:-1.0)*8.0/(3.14159265*3.14159265*n*n)
      :uWaveform==2?4.0/(3.14159265*n):0.25;
    result+=gain*vec2(sin(n*phase),cos(n*phase)/n);
  }
  return result;
}
float envelope(float r){return sqrt(1.04)/sqrt(r*r+0.04)*exp(-uAbsorption/8.685889638*max(r-1.0,0.0));}
void main(){
  float r=length(position),omega=TAU*uFrequency;
  vec3 direction=r>0.00001?position/r:vec3(0.0);
  vec2 values=wave(omega/uSpeed*r-omega*uTime);
  float pressure=uPeak*envelope(r)*values.x;
  vec3 displacement=direction*uPeak*envelope(r)*values.y/max(uDensity*uSpeed*omega,0.000001);
  if(uSecondary==1){
    vec3 offset=position-vec3(uDistanceB,0.0,0.0);
    float br=length(offset),bw=TAU*uFrequencyB;
    float phase=bw/uSpeed*br-bw*uTime+uPhaseB;
    pressure+=uPeak*envelope(br)*sin(phase);
    if(br>0.00001)displacement+=offset/br*uPeak*envelope(br)*cos(phase)/max(uDensity*uSpeed*bw,0.000001);
  }
  vec3 visual=displacement*uScale;
  float amplitude=length(visual);if(amplitude>0.25)visual*=0.25/amplitude;
  vec4 view=modelViewMatrix*vec4(position+visual,1.0);
  gl_Position=projectionMatrix*view;
  float normalized=clamp(pressure/max(uPeak,0.000001),-1.0,1.0);
  vec3 neutral=vec3(0.27,0.50,0.64);
  vColor=normalized>0.0?mix(neutral,vec3(1.0,0.12,0.34),normalized):mix(neutral,vec3(0.025,0.48,1.0),-normalized);
  float front=pow(abs(normalized),3.0);
  vAlpha=uFronts==1?0.12+0.70*front:0.35+0.40*abs(normalized);
  gl_PointSize=clamp((1.4+1.8*front)*uDpr*8.0/max(-view.z,1.0),1.0,12.0);
  if(gl_VertexID==uSelected && uReference==1){vColor=vec3(1.0,0.88,0.18);vAlpha=1.0;gl_PointSize=14.0*uDpr;}
}`;
const fragmentShader = `
varying vec3 vColor; varying float vAlpha;
void main(){
  float r=length(gl_PointCoord*2.0-1.0);if(r>1.0)discard;
  float core=1.0-smoothstep(0.10,0.90,r);
  gl_FragColor=vec4(vColor*(0.8+0.4*core),core*vAlpha);
}`;
function cloud(count: number) {
  const geometry = new THREE.BufferGeometry(),
    data = new Float32Array(count * 3);
  let seed = 0x6d2b79f5;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const radius = 4 * Math.cbrt(random()),
      z = 2 * random() - 1,
      angle = 2 * Math.PI * random(),
      ring = Math.sqrt(1 - z * z);
    data[i * 3] = radius * ring * Math.cos(angle);
    data[i * 3 + 1] = radius * z;
    data[i * 3 + 2] = radius * ring * Math.sin(angle);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(data, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4.3);
  geometry.setDrawRange(0, count);
  return geometry;
}
export const SonicParticleStage: React.FC<Props> = ({
  state,
  calcs,
  quality,
  onStats,
}) => {
  const hostRef = useRef<HTMLDivElement>(null),
    live = useRef({ state, calcs, onStats });
  live.current = { state, calcs, onStats };
  const commands = useRef<{
    zoom: (factor: number) => void;
    reset: () => void;
    focus: () => void;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch {
      setError(
        "No se pudo iniciar WebGL 2. Cierra otras aplicaciones y vuelve a abrir SonicLab.",
      );
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020711);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.02, 150),
      canvas = renderer.domElement;
    host.appendChild(canvas);
    canvas.setAttribute(
      "aria-label",
      "Nube 3D: arrastra para girar, pellizca para acercar, toca para seleccionar",
    );
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 0.3;
    controls.maxDistance = 35;
    controls.zoomSpeed = 0.8;
    controls.rotateSpeed = 0.65;
    controls.screenSpacePanning = true;
    const reset = () => {
      controls.target.set(0, 0, 0);
      camera.position.set(7, 4.5, 9);
      controls.update();
    };
    reset();
    const geometry = cloud(quality),
      positions = geometry.attributes.position.array as Float32Array;
    const u = {
      uTime: { value: 0 },
      uFrequency: { value: 343 },
      uSpeed: { value: 343 },
      uPeak: { value: 0.1 },
      uDensity: { value: 1.2 },
      uAbsorption: { value: 0 },
      uScale: { value: 80000 },
      uDpr: { value: 1 },
      uFrequencyB: { value: 347 },
      uDistanceB: { value: 1.5 },
      uPhaseB: { value: 0 },
      uSecondary: { value: 0 },
      uWaveform: { value: 0 },
      uHarmonic: { value: 0 },
      uHarmonics: { value: new THREE.Vector4(1, 0, 0, 0) },
      uSelected: { value: -1 },
      uReference: { value: 1 },
      uFronts: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Points(geometry, material));
    const sourceGeometry = new THREE.SphereGeometry(0.045, 16, 12),
      sourceMaterial = new THREE.MeshBasicMaterial({ color: 0xffca52 });
    scene.add(new THREE.Mesh(sourceGeometry, sourceMaterial));
    const sourceB = new THREE.Mesh(
      sourceGeometry,
      new THREE.MeshBasicMaterial({ color: 0x41f4b0 }),
    );
    scene.add(sourceB);
    const grid = new THREE.GridHelper(10, 20, 0x18394b, 0x0c1b2a);
    grid.position.y = -4.1;
    scene.add(grid);
    let dpr = Math.min(devicePixelRatio, 1.75),
      selected = -1,
      simTime = 0,
      visible = true;
    let frame = 0,
      previous = performance.now(),
      lastDraw = previous,
      statsAt = previous,
      frames = 0;
    const resize = () => {
      const w = Math.max(1, host.clientWidth),
        h = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      u.uDpr.value = dpr;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const intersection = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    intersection.observe(host);
    const world = new THREE.Vector3(),
      projected = new THREE.Vector3();
    // CPU picking mirrors the GPU displacement on tap only, without GPU readback.
    const currentPosition = (i: number) => {
      const s = live.current.state,
        c = live.current.calcs,
        x = positions[3 * i],
        y = positions[3 * i + 1],
        z = positions[3 * i + 2];
      const sample = fieldSample(x, y, z, simTime, s, c),
        scale = s.visualExaggeration * 20000;
      let dx = sample.dx * scale,
        dy = sample.dy * scale,
        dz = sample.dz * scale;
      const length = Math.hypot(dx, dy, dz);
      if (length > 0.25) {
        dx *= 0.25 / length;
        dy *= 0.25 / length;
        dz *= 0.25 / length;
      }
      return world.set(x + dx, y + dy, z + dz);
    };
    commands.current = {
      reset,
      zoom: (factor) => {
        camera.position
          .sub(controls.target)
          .multiplyScalar(factor)
          .add(controls.target);
        controls.update();
      },
      focus: () => {
        if (selected >= 0) {
          const target = currentPosition(selected).clone();
          camera.position.copy(target).add(new THREE.Vector3(0.4, 0.3, 0.7));
          controls.target.copy(target);
          controls.update();
        }
      },
    };
    const publish = (now: number) => {
      let selection: Selection | null = null;
      if (selected >= 0) {
        const x = positions[selected * 3],
          y = positions[selected * 3 + 1],
          z = positions[selected * 3 + 2];
        const p = fieldSample(
          x,
          y,
          z,
          simTime,
          live.current.state,
          live.current.calcs,
        );
        selection = {
          index: selected,
          x,
          y,
          z,
          pressure: p.pressure,
          displacement: Math.hypot(p.dx, p.dy, p.dz) * 1e6,
        };
      }
      live.current.onStats(
        Math.round((frames * 1000) / Math.max(now - statsAt, 1)),
        quality,
        simTime,
        selection,
      );
      frames = 0;
      statsAt = now;
    };
    const touches = new Set<number>();
    let startX = 0,
      startY = 0,
      moved = false;
    const down = (e: PointerEvent) => {
      touches.add(e.pointerId);
      if (touches.size === 1) {
        startX = e.clientX;
        startY = e.clientY;
        moved = false;
      } else moved = true;
    };
    const move = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 7) moved = true;
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (e.type === "pointercancel" || moved || touches.size) return;
      const rect = canvas.getBoundingClientRect();
      let best = 22 * 22,
        bestDepth = Infinity,
        index = -1;
      camera.updateMatrixWorld();
      for (let i = 0; i < quality; i++) {
        projected.copy(currentPosition(i)).project(camera);
        if (projected.z < -1 || projected.z > 1) continue;
        const dx =
            (projected.x * 0.5 + 0.5) * rect.width - (e.clientX - rect.left),
          dy =
            (-projected.y * 0.5 + 0.5) * rect.height - (e.clientY - rect.top);
        const distance = dx * dx + dy * dy;
        if (
          distance < best - 1 ||
          (Math.abs(distance - best) < 1 && projected.z < bestDepth)
        ) {
          best = distance;
          bestDepth = projected.z;
          index = i;
        }
      }
      selected = index;
      u.uSelected.value = index;
      publish(performance.now());
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      if (document.hidden || !visible) {
        previous = now;
        lastDraw = now;
        statsAt = now;
        frames = 0;
        return;
      }
      // 60 Hz render budget; reduce fill rate under load and keep telemetry at 2 Hz.
      if (now - lastDraw < 15.5) return;
      lastDraw = now;
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const s = live.current.state,
        c = live.current.calcs;
      if (!s.paused)
        simTime +=
          (dt * 1.2) /
          Math.max(
            s.frequencyHz,
            s.secondarySourceEnabled ? s.secondaryFrequencyHz : 0,
            20,
          );
      u.uTime.value = simTime;
      u.uFrequency.value = s.frequencyHz;
      u.uSpeed.value = c.soundSpeedMps;
      u.uPeak.value = c.pressurePeakPa;
      u.uDensity.value = c.airDensityKgM3;
      u.uAbsorption.value = c.attenuationDbPerM;
      u.uScale.value = s.visualExaggeration * 20000;
      u.uFrequencyB.value = s.secondaryFrequencyHz;
      u.uDistanceB.value = s.secondaryDistanceM;
      u.uPhaseB.value = s.secondaryPhaseRad;
      u.uSecondary.value = s.secondarySourceEnabled ? 1 : 0;
      u.uReference.value = s.showReferenceParticle ? 1 : 0;
      u.uFronts.value = s.showWavefronts ? 1 : 0;
      u.uWaveform.value = ["sine", "triangle", "square", "pulse"].indexOf(
        s.waveform,
      );
      u.uHarmonic.value = s.harmonicMode ? 1 : 0;
      u.uHarmonics.value.fromArray(s.harmonics);
      sourceB.visible = s.secondarySourceEnabled;
      sourceB.position.x = s.secondaryDistanceM;
      controls.update();
      renderer.render(scene, camera);
      frames++;
      if (now - statsAt >= 500) {
        const fps = (frames * 1000) / (now - statsAt);
        if (fps < 42 && dpr > 1) {
          dpr = Math.max(1, dpr - 0.15);
          resize();
        }
        publish(now);
      }
    };
    frame = requestAnimationFrame(render);
    const lost = (e: Event) => {
      e.preventDefault();
      setError(
        "Se interrumpió el renderizado. Pulsa Recargar para recuperar la vista.",
      );
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      controls.dispose();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("webglcontextlost", lost);
      geometry.dispose();
      material.dispose();
      sourceGeometry.dispose();
      sourceMaterial.dispose();
      (sourceB.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      canvas.remove();
      commands.current = null;
    };
  }, [quality]);
  return (
    <div className="particle-viewport">
      <div ref={hostRef} className="particle-host" />
      <div className="particle-legend">
        <span>● Compresión</span>
        <span>● Rarefacción</span>
      </div>
      {error && (
        <div role="alert" className="render-error">
          {error}
          <button onClick={() => location.reload()}>Recargar</button>
        </div>
      )}
      <div className="camera-tools" aria-label="Cámara 3D">
        <button
          onClick={() => commands.current?.zoom(0.8)}
          aria-label="Acercar"
        >
          ＋
        </button>
        <button
          onClick={() => commands.current?.zoom(1.25)}
          aria-label="Alejar"
        >
          −
        </button>
        <button onClick={() => commands.current?.reset()}>Centrar</button>
        <button onClick={() => commands.current?.focus()}>
          Enfocar selección
        </button>
      </div>
    </div>
  );
};
