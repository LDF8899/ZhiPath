import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';
import '../styles/hand-draw.css';

export interface ThreeScene {
  type: 'three';
  scene?: any[];
  camera?: { position: [number, number, number]; target: [number, number, number] };
  axes?: boolean;
  width?: number;
  height?: number;
}

function Arrow({ from, to, color }: { from: any; to: any; color?: string }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const head = b.clone().sub(dir.clone().normalize().multiplyScalar(Math.min(0.2, len * 0.2)));
  return (
    <group>
      <Line points={[a, b]} color={color || '#d8482b'} lineWidth={3} />
      <mesh position={head} quaternion={q}>
        <coneGeometry args={[0.12, 0.3, 12]} />
        <meshStandardMaterial color={color || '#d8482b'} />
      </mesh>
    </group>
  );
}

function Obj({ o }: { o: any }) {
  const color = o.color || '#5b7c99';
  const pos = o.position || [0, 0, 0];
  switch (o.kind) {
    case 'box': return <mesh position={pos} rotation={o.rotation || [0, 0, 0]}><boxGeometry args={o.size} /><meshStandardMaterial color={color} transparent opacity={0.92} /></mesh>;
    case 'sphere': return <mesh position={pos}><sphereGeometry args={[o.radius, 32, 32]} /><meshStandardMaterial color={color} transparent opacity={0.92} /></mesh>;
    case 'cylinder': return <mesh position={pos}><cylinderGeometry args={[o.radius, o.radius, o.height, 32]} /><meshStandardMaterial color={color} transparent opacity={0.92} /></mesh>;
    case 'cone': return <mesh position={pos}><coneGeometry args={[o.radius, o.height, 32]} /><meshStandardMaterial color={color} /></mesh>;
    case 'grid': return <gridHelper args={[o.size || 24, o.divisions || 12, o.color || '#bbb', o.color || '#e0e0e0']} position={[0, -0.01, 0]} />;
    case 'arrow': return <Arrow from={o.from} to={o.to} color={o.color} />;
    case 'edge': return <Line points={o.points} color={o.color || '#333'} lineWidth={o.linewidth || 3} />;
    case 'text': return (
      <Html position={pos} center>
        <div style={{ color: o.color || '#111', fontWeight: 700, fontSize: 13, background: 'rgba(255,255,255,.7)', padding: '2px 6px', borderRadius: 4 }}>{o.text}</div>
      </Html>
    );
    default: return null;
  }
}

export default function ThreeFigure({ scene, camera, axes = true, width = 640, height = 420 }: ThreeScene & { width?: number; height?: number }) {
  const cam = camera || { position: [8, 7, 8] as any, target: [0, 0, 0] as any };
  const items = scene || [];
  return (
    <div className="hd-card" style={{ margin: '8px 0', padding: 8 }}>
      <Canvas camera={{ position: cam.position, fov: 45 }} style={{ width, height, borderRadius: 8, background: '#fff', border: '1px solid var(--rule)' }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 12, 8]} intensity={0.9} />
        <OrbitControls target={cam.target} makeDefault />
        {axes && <axesHelper args={[4]} />}
        {items.map((o: any, i: number) => <Obj key={i} o={o} />)}
      </Canvas>
      <div style={{ fontSize: 12, color: 'var(--pencil)', marginTop: 4 }}>three.js 3D 视图（可拖动旋转/缩放）</div>
    </div>
  );
}
