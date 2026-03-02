import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { SimulationResult } from '@/lib/simulation-engine';

function colorFromValue(value: number, min: number, max: number): THREE.Color {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  if (t < 0.25) return new THREE.Color().setHSL(0.66 - t * 0.8, 0.9, 0.3 + t * 1.2);
  if (t < 0.5) return new THREE.Color().setHSL(0.46 - (t - 0.25) * 1.2, 0.95, 0.45 + (t - 0.25) * 0.4);
  if (t < 0.75) return new THREE.Color().setHSL(0.16 - (t - 0.5) * 0.4, 1, 0.5);
  return new THREE.Color().setHSL(0.06 - (t - 0.75) * 0.24, 1, 0.55 - (t - 0.75) * 0.1);
}

const VOID_COLOR = new THREE.Color(0.06, 0.08, 0.12);

function HeatmapMesh({ result, timeIndex }: { result: SimulationResult; timeIndex: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const nx = result.mesh.x.length;
  const ny = result.mesh.y.length;

  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(2, 1.2, nx - 1, ny - 1);
  }, [nx, ny]);

  useEffect(() => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;
    const colors = new Float32Array(nx * ny * 3);
    const positions = geo.attributes.position;
    const frame = result.field[Math.min(timeIndex, result.field.length - 1)];
    const mask = result.mask;

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = j * nx + i;
        const value = frame[idx];
        const isVoid = mask[idx] === 0 || isNaN(value);

        const color = isVoid ? VOID_COLOR : colorFromValue(value, result.min, result.max);
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;

        const t = isVoid ? -0.05 : (result.max === result.min ? 0 : (value - result.min) / (result.max - result.min));
        const posArray = positions.array as Float32Array;
        posArray[idx * 3 + 2] = isVoid ? -0.05 : t * 0.3;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    positions.needsUpdate = true;
    geo.computeVertexNormals();
  }, [timeIndex, result, nx, ny]);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 6, 0, 0]} position={[0, -0.1, 0]}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

function ColorBar({ min, max, label }: { min: number; max: number; label: string }) {
  const barGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.08, 1.2, 1, 64);
    const colors = new Float32Array(2 * 65 * 3);
    for (let j = 0; j < 65; j++) {
      const t = j / 64;
      const c = colorFromValue(min + t * (max - min), min, max);
      colors[j * 2 * 3] = c.r;
      colors[j * 2 * 3 + 1] = c.g;
      colors[j * 2 * 3 + 2] = c.b;
      colors[(j * 2 + 1) * 3] = c.r;
      colors[(j * 2 + 1) * 3 + 1] = c.g;
      colors[(j * 2 + 1) * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [min, max]);

  const formatVal = (v: number) => {
    if (Math.abs(v) > 1e6) return v.toExponential(1);
    if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1);
    return v.toFixed(1);
  };

  return (
    <group position={[1.4, 0, 0]}>
      <mesh geometry={barGeo}>
        <meshBasicMaterial vertexColors />
      </mesh>
      <Text position={[0.15, -0.6, 0]} fontSize={0.06} color="#7dd3e8" anchorX="left">
        {formatVal(min)}
      </Text>
      <Text position={[0.15, 0.6, 0]} fontSize={0.06} color="#7dd3e8" anchorX="left">
        {formatVal(max)}
      </Text>
      <Text position={[0.15, 0, 0]} fontSize={0.05} color="#8899aa" anchorX="left">
        {label}
      </Text>
    </group>
  );
}

interface SimulationViewerProps {
  result: SimulationResult;
}

export default function SimulationViewer({ result }: SimulationViewerProps) {
  const [timeIndex, setTimeIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setTimeIndex(prev => {
        if (prev >= result.field.length - 1) return 0;
        return prev + 1;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [playing, result.field.length]);

  useEffect(() => {
    setTimeIndex(0);
    setPlaying(true);
  }, [result]);

  const unit = result.config.type === 'heat_transfer' ? 'K' : 'Pa';
  const progress = result.field.length > 1 ? (timeIndex / (result.field.length - 1)) * 100 : 100;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border bg-card">
        <Canvas camera={{ position: [0, 0.8, 2.5], fov: 45 }} gl={{ antialias: true }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 3, 4]} intensity={0.8} />
          <pointLight position={[-2, 2, 2]} intensity={0.3} color="#44ccee" />
          <HeatmapMesh result={result} timeIndex={timeIndex} />
          <ColorBar min={result.min} max={result.max} label={unit} />
          <OrbitControls enableDamping dampingFactor={0.08} minDistance={1} maxDistance={6} />
          <gridHelper args={[4, 20, '#1a2a3a', '#1a2a3a']} position={[0, -0.8, 0]} />
        </Canvas>
      </div>

      <div className="flex items-center gap-3 mt-3 px-2">
        <button
          onClick={() => setPlaying(!playing)}
          className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
        >
          {playing ? (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
              <rect x="1" y="1" width="3" height="12" rx="1" />
              <rect x="8" y="1" width="3" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
              <polygon points="2,1 11,7 2,13" />
            </svg>
          )}
        </button>

        <div className="flex-1 relative h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="text-xs font-mono text-muted-foreground min-w-[60px] text-right">
          t={result.timeSteps[timeIndex]?.toExponential(1) ?? '0'}s
        </span>
      </div>
    </div>
  );
}