/**
 * SonicLab 3D - Cymatics 3D Visualizer
 * High-performance WebGL renderer for vibrating Chladni plates and particle dynamics.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { CymaticsMetrics, CymaticsModeBank, CymaticsState } from '../../types/soniclab';
import { CymaticsPhysics } from '../../physics/CymaticsPhysics';
import { PALETTES } from '../../utils/palette';
import { Eye, RotateCcw, Sparkles, Video, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface Cymatics3DViewProps {
  state: CymaticsState;
  bank: CymaticsModeBank | null;
  metrics: CymaticsMetrics;
  onUpdateState: (patch: Partial<CymaticsState>) => void;
  onToggleAudio: () => void;
  audioActive: boolean;
}

export const Cymatics3DView: React.FC<Cymatics3DViewProps> = ({
  state,
  bank,
  metrics,
  onUpdateState,
  onToggleAudio,
  audioActive,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState<number>(60);
  const [probeData, setProbeData] = useState<{ x: number; y: number; val: number } | null>(null);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const plateMeshRef = useRef<THREE.Mesh | null>(null);
  const plateGeometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const sandParticlesRef = useRef<THREE.Points | null>(null);
  const sandPositionsRef = useRef<Float32Array | null>(null);
  const sandVelocitiesRef = useRef<Float32Array | null>(null);
  const nodalStreamsRef = useRef<THREE.Points | null>(null);
  const exciterRingsRef = useRef<THREE.Group | null>(null);

  // Mouse interaction state
  const mouseState = useRef({
    isDragging: false,
    previousMousePosition: { x: 0, y: 0 },
    rotation: { x: 0.78, y: 0.65 },
    distance: 12.0,
    targetDistance: 12.0,
  });

  const animFrameId = useRef<number>(0);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const frameCount = useRef<number>(0);
  const lastFpsUpdate = useRef<number>(performance.now());

  // Reusable raycasting objects (zero GC allocations on mouse move)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const planeRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersectPointRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const pointerVecRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Palette config
  const palette = PALETTES[state.palette] || PALETTES.aurora_electrica;

  // Initialize sand particles buffer
  const initSand = useCallback(
    (count: number, activeBank: CymaticsModeBank) => {
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 2);

      let placed = 0;
      let attempts = 0;
      while (placed < count && attempts < count * 4) {
        attempts++;
        const nx = (Math.random() * 2 - 1) * 0.95;
        const ny = (Math.random() * 2 - 1) * 0.95;
        if (CymaticsPhysics.isInside(activeBank, nx, ny)) {
          const idx = placed * 3;
          positions[idx] = nx * 4.0; // X
          positions[idx + 1] = 0.05 + Math.random() * 0.02; // Y (height above plate)
          positions[idx + 2] = ny * 4.0; // Z
          velocities[placed * 2] = (Math.random() - 0.5) * 0.005;
          velocities[placed * 2 + 1] = (Math.random() - 0.5) * 0.005;
          placed++;
        }
      }

      // If any remains, place near center
      for (let i = placed; i < count; i++) {
        const idx = i * 3;
        positions[idx] = (Math.random() - 0.5) * 2.0;
        positions[idx + 1] = 0.05;
        positions[idx + 2] = (Math.random() - 0.5) * 2.0;
      }

      sandPositionsRef.current = positions;
      sandVelocitiesRef.current = velocities;

      if (sandParticlesRef.current) {
        const geom = sandParticlesRef.current.geometry;
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.attributes.position.needsUpdate = true;
      }
    },
    []
  );

  // Re-scatter sand particles
  const handleScatterSand = () => {
    if (bank) {
      initSand(state.sandParticleCount, bank);
    }
  };

  // Reset camera view
  const handleResetCamera = (mode: 'orbit' | 'top_down') => {
    if (mode === 'top_down') {
      mouseState.current.rotation.x = Math.PI / 2;
      mouseState.current.rotation.y = 0;
      mouseState.current.targetDistance = 11.0;
      onUpdateState({ cameraMode: 'top_down' });
    } else {
      mouseState.current.rotation.x = 0.78;
      mouseState.current.rotation.y = 0.65;
      mouseState.current.targetDistance = 12.0;
      onUpdateState({ cameraMode: 'interactive' });
    }
  };

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.plateBaseHex).multiplyScalar(0.25);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 8, 10);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(6, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const accentLight = new THREE.PointLight(palette.nodalLineHex, 3.0, 20);
    accentLight.position.set(0, 4, 0);
    scene.add(accentLight);

    // Grid Floor
    const grid = new THREE.GridHelper(16, 32, palette.nodalLineHex, 0x1e293b);
    grid.position.y = -1.2;
    scene.add(grid);

    // Exciter Actuator Rings
    const exciterGroup = new THREE.Group();
    const ringGeom = new THREE.RingGeometry(0.12, 0.18, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: palette.nodalLineHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    exciterGroup.add(ringMesh);
    scene.add(exciterGroup);
    exciterRingsRef.current = exciterGroup;

    // Plate Mesh (96x96 segments for high precision modal displacement)
    const plateGeom = new THREE.PlaneGeometry(8, 8, 96, 96);
    plateGeom.rotateX(-Math.PI / 2);
    plateGeometryRef.current = plateGeom;

    const plateMat = new THREE.MeshStandardMaterial({
      color: palette.plateBaseHex,
      emissive: palette.plateEmissiveHex,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.25,
      side: THREE.DoubleSide,
      wireframe: state.showWireframe,
    });

    const plateMesh = new THREE.Mesh(plateGeom, plateMat);
    plateMesh.receiveShadow = true;
    plateMesh.castShadow = true;
    scene.add(plateMesh);
    plateMeshRef.current = plateMesh;

    // Sand Particles
    const sandCount = state.sandParticleCount;
    const sandGeom = new THREE.BufferGeometry();
    const sandPositions = new Float32Array(sandCount * 3);
    sandGeom.setAttribute('position', new THREE.BufferAttribute(sandPositions, 3));

    const sandMat = new THREE.PointsMaterial({
      color: palette.sandParticleHex,
      size: 0.085,
      transparent: true,
      opacity: 0.9,
      blending: THREE.NormalBlending,
    });

    const sandPoints = new THREE.Points(sandGeom, sandMat);
    scene.add(sandPoints);
    sandParticlesRef.current = sandPoints;

    // Nodal Streams (luminescent grains gliding along nodal lines)
    const streamCount = 2048;
    const streamGeom = new THREE.BufferGeometry();
    const streamPositions = new Float32Array(streamCount * 3);
    streamGeom.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));

    const streamMat = new THREE.PointsMaterial({
      color: palette.streamParticleHex,
      size: 0.11,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const streamPoints = new THREE.Points(streamGeom, streamMat);
    scene.add(streamPoints);
    nodalStreamsRef.current = streamPoints;

    // Initialize sand
    if (bank) {
      initSand(sandCount, bank);
    }

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animFrameId.current);
      resizeObserver.disconnect();
      renderer.dispose();
      plateGeom.dispose();
      plateMat.dispose();
      sandGeom.dispose();
      sandMat.dispose();
      streamGeom.dispose();
      streamMat.dispose();
    };
  }, []);

  // Update bank or sand particle count
  useEffect(() => {
    if (bank) {
      initSand(state.sandParticleCount, bank);
    }
  }, [bank, state.sandParticleCount, state.geometry, state.boundary, initSand]);

  // Update palette colors
  useEffect(() => {
    if (plateMeshRef.current) {
      const mat = plateMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.color.setHex(palette.plateBaseHex);
      mat.emissive.setHex(palette.plateEmissiveHex);
      mat.wireframe = state.showWireframe;
    }
    if (sandParticlesRef.current) {
      const mat = sandParticlesRef.current.material as THREE.PointsMaterial;
      mat.color.setHex(palette.sandParticleHex);
    }
    if (nodalStreamsRef.current) {
      const mat = nodalStreamsRef.current.material as THREE.PointsMaterial;
      mat.color.setHex(palette.streamParticleHex);
      nodalStreamsRef.current.visible = state.showNodalStreams;
    }
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(palette.plateBaseHex).multiplyScalar(0.25);
    }
  }, [palette, state.showWireframe, state.showNodalStreams]);

  // Animation Loop (Render & Physics)
  useEffect(() => {
    const clock = clockRef.current;

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // FPS calculation
      frameCount.current++;
      const now = performance.now();
      if (now - lastFpsUpdate.current >= 600) {
        setFps(Math.round((frameCount.current * 1000) / (now - lastFpsUpdate.current)));
        frameCount.current = 0;
        lastFpsUpdate.current = now;
      }

      // Smooth camera position
      const camera = cameraRef.current;
      const ms = mouseState.current;

      // Handle cinematic show mode rotation
      if (state.cameraMode === 'cinematic_show') {
        ms.rotation.y += delta * 0.25;
      }

      ms.distance += (ms.targetDistance - ms.distance) * 0.1;

      if (camera) {
        const phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, ms.rotation.x));
        const theta = ms.rotation.y;
        camera.position.x = ms.distance * Math.sin(phi) * Math.sin(theta);
        camera.position.y = ms.distance * Math.cos(phi);
        camera.position.z = ms.distance * Math.sin(phi) * Math.cos(theta);
        camera.lookAt(0, 0, 0);
      }

      // Exciter Actuator Pulse animation
      if (exciterRingsRef.current) {
        const exciterX = state.driveX * 4.0;
        const exciterZ = state.driveY * 4.0;
        exciterRingsRef.current.position.set(exciterX, 0.05, exciterZ);
        const pulseScale = 1.0 + 0.35 * Math.sin(elapsed * 6.0);
        exciterRingsRef.current.scale.set(pulseScale, pulseScale, pulseScale);
        exciterRingsRef.current.visible = state.showExciterPulses;
      }

      // Plate Modal Surface Deformation
      if (plateGeometryRef.current && bank) {
        const geom = plateGeometryRef.current;
        const posAttr = geom.attributes.position;
        const posArr = posAttr.array as Float32Array;
        const activeMode = metrics.modeIndex;

        // Decoupled perceptual oscillation phase (smooth, aesthetic, anti-aliased)
        const cyclesPerSec = CymaticsPhysics.visualCyclesPerSecond(state.driveFrequencyHz);
        const visualPhase = state.paused ? 0 : elapsed * cyclesPerSec * 2 * Math.PI;
        const amp = state.paused ? 0 : metrics.normalizedAmplitude * state.visualScale * 0.8;
        const sinPhaseAmp = Math.sin(visualPhase) * amp;

        const count = posAttr.count;
        for (let i = 0; i < count; i++) {
          const baseIdx = i * 3;
          const px = posArr[baseIdx];
          const pz = posArr[baseIdx + 2];

          const nx = px * 0.25;
          const nz = pz * 0.25;

          if (CymaticsPhysics.isInside(bank, nx, nz)) {
            const modalDisp = CymaticsPhysics.sampleMode(bank, activeMode, nx, nz);
            posArr[baseIdx + 1] = modalDisp * sinPhaseAmp;
          } else {
            posArr[baseIdx + 1] = -0.4; // Dropped outside boundary
          }
        }
        posAttr.needsUpdate = true;
        if (!state.paused && amp > 0.005) {
          geom.computeVertexNormals();
        }
      }

      // Sand Particles Physics & Nodal Settling
      if (sandParticlesRef.current && sandPositionsRef.current && sandVelocitiesRef.current && bank) {
        const positions = sandPositionsRef.current;
        const velocities = sandVelocitiesRef.current;
        const count = state.sandParticleCount;
        const activeMode = metrics.modeIndex;
        const activeAmp = metrics.normalizedAmplitude;
        const flow = state.sandFlowIntensity;

        const posAttr = sandParticlesRef.current.geometry.attributes.position;
        const gradOut = { val: 0, gradX: 0, gradY: 0 };
        const accel = -1.2 * activeAmp * flow;

        for (let i = 0; i < count; i++) {
          const idx = i * 3;
          const vIdx = i * 2;

          let px = positions[idx];
          let pz = positions[idx + 2];

          const nx = px * 0.25;
          const nz = pz * 0.25;

          if (CymaticsPhysics.isInside(bank, nx, nz)) {
            // Unified fast bilinear sampling with spatial gradient (zero allocations)
            CymaticsPhysics.sampleModeWithGradient(bank, activeMode, nx, nz, gradOut);
            const phiCenter = Math.abs(gradOut.val);
            const gradX = gradOut.gradX;
            const gradZ = gradOut.gradY;

            velocities[vIdx] += gradX * accel + (Math.random() - 0.5) * 0.003 * activeAmp;
            velocities[vIdx + 1] += gradZ * accel + (Math.random() - 0.5) * 0.003 * activeAmp;

            // Damping / friction on plate
            velocities[vIdx] *= 0.88;
            velocities[vIdx + 1] *= 0.88;

            px += velocities[vIdx];
            pz += velocities[vIdx + 1];

            // Re-check boundaries
            const newNx = px * 0.25;
            const newNz = pz * 0.25;
            if (CymaticsPhysics.isInside(bank, newNx, newNz)) {
              positions[idx] = px;
              positions[idx + 2] = pz;
              // Granular hop based on vibration
              const hop = 0.04 + phiCenter * activeAmp * 0.15;
              positions[idx + 1] = hop;
            } else {
              velocities[vIdx] *= -0.5;
              velocities[vIdx + 1] *= -0.5;
            }
          } else {
            // Reset particle near center if it falls off
            positions[idx] = (Math.random() - 0.5) * 2.0;
            positions[idx + 1] = 0.04;
            positions[idx + 2] = (Math.random() - 0.5) * 2.0;
            velocities[vIdx] = 0;
            velocities[vIdx + 1] = 0;
          }
        }
        posAttr.needsUpdate = true;
      }

      // Nodal Streams Animation (luminescent particles moving along nodal lines)
      if (nodalStreamsRef.current && state.showNodalStreams && bank) {
        const streamAttr = nodalStreamsRef.current.geometry.attributes.position;
        const count = streamAttr.count;
        const activeMode = metrics.modeIndex;

        for (let i = 0; i < count; i++) {
          const t = elapsed * 0.4 + (i / count) * Math.PI * 2;
          const r = 1.0 + 1.8 * Math.abs(Math.sin(i * 13.7));
          const nx = (Math.cos(t) * r) / 4.0;
          const nz = (Math.sin(t) * r) / 4.0;

          const modalVal = Math.abs(CymaticsPhysics.sampleMode(bank, activeMode, nx, nz));
          const isNearNode = modalVal < 0.25;

          if (isNearNode && CymaticsPhysics.isInside(bank, nx, nz)) {
            streamAttr.setXYZ(i, nx * 4.0, 0.08 + Math.sin(t * 4.0) * 0.02, nz * 4.0);
          } else {
            streamAttr.setY(i, -10.0); // hide
          }
        }
        streamAttr.needsUpdate = true;
      }

      // Render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animFrameId.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId.current);
    };
  }, [state, bank, metrics]);

  // Multi-touch tracking for Android & mobile pinch-to-zoom and rotation
  const activeTouches = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartTargetDist = useRef<number>(12);

  // Pointer drag controls for 3D Camera Orbit
  const handlePointerDown = (e: React.PointerEvent) => {
    activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activeTouches.current.size === 1) {
      mouseState.current.isDragging = true;
      mouseState.current.previousMousePosition = { x: e.clientX, y: e.clientY };
    } else if (activeTouches.current.size === 2) {
      mouseState.current.isDragging = false;
      const pts: { x: number; y: number }[] = Array.from(activeTouches.current.values());
      pinchStartDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartTargetDist.current = mouseState.current.targetDistance;
    }

    if (state.cameraMode === 'cinematic_show') {
      onUpdateState({ cameraMode: 'interactive' });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activeTouches.current.has(e.pointerId)) {
      activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Android 2-finger pinch-to-zoom
    if (activeTouches.current.size === 2 && pinchStartDist.current !== null) {
      const pts: { x: number; y: number }[] = Array.from(activeTouches.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = pinchStartDist.current / Math.max(currentDist, 1);
      mouseState.current.targetDistance = Math.max(
        4.0,
        Math.min(24.0, pinchStartTargetDist.current * ratio)
      );
      return;
    }

    if (mouseState.current.isDragging && activeTouches.current.size <= 1) {
      const deltaX = e.clientX - mouseState.current.previousMousePosition.x;
      const deltaY = e.clientY - mouseState.current.previousMousePosition.y;

      mouseState.current.rotation.y -= deltaX * 0.008;
      mouseState.current.rotation.x += deltaY * 0.008;

      mouseState.current.previousMousePosition = { x: e.clientX, y: e.clientY };
    }

    // Interactive Probe on Plate Hover
    if (containerRef.current && bank) {
      const rect = containerRef.current.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast to plate plane (zero memory allocation)
      const camera = cameraRef.current;
      if (camera) {
        pointerVecRef.current.set(ndcX, ndcY);
        raycasterRef.current.setFromCamera(pointerVecRef.current, camera);
        if (raycasterRef.current.ray.intersectPlane(planeRef.current, intersectPointRef.current)) {
          const nx = intersectPointRef.current.x * 0.25;
          const nz = intersectPointRef.current.z * 0.25;
          if (CymaticsPhysics.isInside(bank, nx, nz)) {
            const val = CymaticsPhysics.sampleMode(bank, metrics.modeIndex, nx, nz);
            setProbeData({ x: nx, y: nz, val });
          } else {
            setProbeData(null);
          }
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activeTouches.current.delete(e.pointerId);
    if (activeTouches.current.size < 2) {
      pinchStartDist.current = null;
    }
    if (activeTouches.current.size === 0) {
      mouseState.current.isDragging = false;
    } else if (activeTouches.current.size === 1) {
      const remaining = activeTouches.current.values().next().value;
      if (remaining) {
        mouseState.current.previousMousePosition = { x: remaining.x, y: remaining.y };
        mouseState.current.isDragging = true;
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    mouseState.current.targetDistance = Math.max(
      4.0,
      Math.min(24.0, mouseState.current.targetDistance + e.deltaY * 0.01)
    );
  };

  return (
    <div
      className="relative w-full h-full min-h-[480px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 select-none flex flex-col touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Overlay Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        {/* Metric Badges */}
        <div className="flex flex-wrap gap-2 pointer-events-auto">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs font-mono text-cyan-300 flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>MODO #{metrics.modeIndex + 1}</span>
            <span className="text-slate-400">|</span>
            <span className="text-white font-semibold">{metrics.naturalFrequencyHz.toFixed(1)} Hz</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs font-mono text-emerald-300 flex items-center gap-1.5 shadow-lg">
            <span className="text-slate-400">Resonancia:</span>
            <span className="font-semibold text-white">{(metrics.response * 100).toFixed(0)}%</span>
            <span className="text-slate-400 text-[10px]">({metrics.relativeDetuning < 0.03 ? 'ACOPLE EXACTO' : 'DESINTONIZADO'})</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs font-mono text-purple-300 flex items-center gap-1.5 shadow-lg">
            <span className="text-slate-400">Granos:</span>
            <span className="font-semibold text-white">{state.sandParticleCount.toLocaleString()}</span>
          </div>
        </div>

        {/* View and Audio Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Audio Synthesizer Button */}
          <button
            id="cymatics-audio-toggle-btn"
            onClick={onToggleAudio}
            className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-lg backdrop-blur-md border ${
              audioActive
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-500/20'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
            title="Activar tono de audio puro con la frecuencia de la placa"
          >
            {audioActive ? <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span>{audioActive ? 'Audio ON' : 'Audio OFF'}</span>
          </button>

          {/* Scatter Sand Button */}
          <button
            id="cymatics-scatter-sand-btn"
            onClick={handleScatterSand}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-900/80 text-amber-300 border border-amber-500/30 hover:bg-amber-500/10 transition-all shadow-lg backdrop-blur-md flex items-center gap-1.5"
            title="Esparcir nuevamente granos de arena sobre la placa"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Esparcir Arena</span>
          </button>

          {/* Top-Down View */}
          <button
            id="cymatics-topdown-btn"
            onClick={() => handleResetCamera('top_down')}
            className={`p-2 rounded-xl text-xs transition-all backdrop-blur-md border ${
              state.cameraMode === 'top_down'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
            title="Vista cenital 2D (Patrón de Chladni clásico)"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Cinematic Show Mode */}
          <button
            id="cymatics-cinematic-btn"
            onClick={() => onUpdateState({ cameraMode: state.cameraMode === 'cinematic_show' ? 'interactive' : 'cinematic_show' })}
            className={`p-2 rounded-xl text-xs transition-all backdrop-blur-md border ${
              state.cameraMode === 'cinematic_show'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 animate-pulse'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
            title="Cámara cinemática orbital automática"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* Reset Orbit */}
          <button
            id="cymatics-reset-camera-btn"
            onClick={() => handleResetCamera('orbit')}
            className="p-2 rounded-xl text-xs bg-slate-900/80 text-slate-300 border border-slate-700/60 hover:bg-slate-800 transition-all backdrop-blur-md"
            title="Restablecer ángulo 3D"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Floating Stats and Probe Inspector */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none">
        {/* Sonda Modal Interactiva */}
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 shadow-xl pointer-events-auto flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          {probeData ? (
            <div className="flex items-center gap-3">
              <span>
                X: <strong className="text-white">{probeData.x.toFixed(2)}</strong>
              </span>
              <span>
                Y: <strong className="text-white">{probeData.y.toFixed(2)}</strong>
              </span>
              <span>
                Desplazamiento modal: <strong className="text-cyan-300">{(probeData.val * 100).toFixed(1)}%</strong>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${Math.abs(probeData.val) < 0.15 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                {Math.abs(probeData.val) < 0.15 ? 'LÍNEA NODAL (SEDIMENTACIÓN)' : 'ZONA ANTINODAL'}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 italic">Pasa el cursor sobre la placa para sondear valores de deformación</span>
          )}
        </div>

        {/* Engine Performance Telemetry */}
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-400 shadow-xl pointer-events-auto flex items-center gap-3">
          <span>
            FPS: <strong className={fps >= 55 ? 'text-emerald-400' : 'text-amber-400'}>{fps}</strong>
          </span>
          <span>•</span>
          <span>WebGL 2 / Three.js</span>
          <span>•</span>
          <span className="text-cyan-400">Zero-GC Loop</span>
        </div>
      </div>
    </div>
  );
};
