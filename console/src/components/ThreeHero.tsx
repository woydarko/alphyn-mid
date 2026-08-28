import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Icosahedron, Environment } from '@react-three/drei';
import * as THREE from 'three';

// A floating cluster of privacy "crystals" — the Midnight aesthetic — that gently
// drifts and reacts to the pointer. Purely decorative; safe to fail silently.

function Crystal({ position, scale, color, speed, distort }: {
  position: [number, number, number]; scale: number; color: string; speed: number; distort: number;
}) {
  return (
    <Float speed={speed} rotationIntensity={1.2} floatIntensity={1.6}>
      <Icosahedron args={[1, 1]} position={position} scale={scale}>
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.15}
          metalness={0.6}
          distort={distort}
          speed={1.5}
          transparent
          opacity={0.92}
        />
      </Icosahedron>
    </Float>
  );
}

function Particles({ count = 140 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.03;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#A78BFA" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

function Scene() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    // Ease the whole cluster toward the pointer for a parallax feel.
    const tx = state.pointer.x * 0.5;
    const ty = state.pointer.y * 0.4;
    group.current.rotation.y += (tx - group.current.rotation.y) * 0.05;
    group.current.rotation.x += (-ty - group.current.rotation.x) * 0.05;
  });
  return (
    <group ref={group}>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1.4} color="#C4B5FD" />
      <pointLight position={[-5, -3, 2]} intensity={0.8} color="#7C3AED" />
      <Crystal position={[0, 0.2, 0]} scale={1.5} color="#8B5CF6" speed={1.4} distort={0.35} />
      <Crystal position={[2.2, 1.1, -1]} scale={0.7} color="#A78BFA" speed={2} distort={0.45} />
      <Crystal position={[-2.3, -0.9, -0.5]} scale={0.85} color="#6D28D9" speed={1.7} distort={0.4} />
      <Crystal position={[1.4, -1.6, 0.5]} scale={0.5} color="#C4B5FD" speed={2.4} distort={0.5} />
      <Particles />
      <Environment preset="night" />
    </group>
  );
}

export default function ThreeHero() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <Scene />
    </Canvas>
  );
}
