import { useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { IconRefresh } from './icons';

type SkillSource = 'self_report' | 'conversation' | 'github' | 'exam';

interface ProfileSkill {
  name: string;
  level?: string;
  source?: string;
}

interface EffectiveSkill {
  skillName: string;
  masteryPct?: number;
  trustWeight?: number;
  source?: string;
}

interface AbilitySkill {
  id: string;
  name: string;
  level: string;
  mastery: number;
  trustWeight: number;
  source: SkillSource;
  position: [number, number, number];
}

const SOURCE_META: Record<SkillSource, { label: string; color: string }> = {
  self_report: { label: '自评', color: '#7b8f67' },
  conversation: { label: '对话识别', color: '#b36a78' },
  github: { label: 'GitHub', color: '#3b6e8e' },
  exam: { label: '考试认证', color: '#d8482b' },
};

const LEVEL_MASTERY: Record<string, number> = { 了解: 30, 熟悉: 60, 精通: 90 };
const SOURCE_ORDER: SkillSource[] = ['self_report', 'conversation', 'github', 'exam'];

function normalizeSource(value?: string): SkillSource {
  return SOURCE_ORDER.includes(value as SkillSource) ? value as SkillSource : 'self_report';
}

function buildSkills(profileSkills: ProfileSkill[], effectiveSkills: EffectiveSkill[]): AbilitySkill[] {
  const effectiveByName = new Map(effectiveSkills.map((skill) => [skill.skillName.toLowerCase(), skill]));
  const sourceCounts = new Map<SkillSource, number>();
  profileSkills.slice(0, 16).forEach((skill) => {
    const source = normalizeSource(effectiveByName.get(skill.name.toLowerCase())?.source || skill.source);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  });
  return profileSkills.slice(0, 16).map((skill, index) => {
    const effective = effectiveByName.get(skill.name.toLowerCase());
    const source = normalizeSource(effective?.source || skill.source);
    const groupIndex = SOURCE_ORDER.indexOf(source);
    const sameSource = profileSkills.slice(0, index).filter((item) => normalizeSource(
      effectiveByName.get(item.name.toLowerCase())?.source || item.source,
    ) === source).length;
    const groupCount = sourceCounts.get(source) || 1;
    const angle = groupIndex * (Math.PI / 2) + (sameSource - (groupCount - 1) / 2) * 0.42;
    const radius = 3.8;
    const mastery = Math.max(0, Math.min(100, Number(effective?.masteryPct) || LEVEL_MASTERY[skill.level || ''] || 25));
    return {
      id: `skill-${index}`,
      name: skill.name,
      level: skill.level || '未评级',
      mastery,
      trustWeight: Math.max(0, Math.min(1, Number(effective?.trustWeight) || 0.3)),
      source,
      position: [
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.68,
        ((sameSource % 3) - 1) * 1.25 + (index % 2 ? 0.45 : -0.45),
      ],
    };
  });
}

function AbilityNode({
  skill,
  selected,
  onSelect,
}: {
  skill: AbilitySkill;
  selected: boolean;
  onSelect: (skill: AbilitySkill) => void;
}) {
  const meta = SOURCE_META[skill.source];
  const radius = 0.24 + skill.mastery * 0.0042;
  return (
    <group position={skill.position}>
      <mesh
        scale={selected ? 1.16 : 1}
        onClick={(event) => { event.stopPropagation(); onSelect(skill); }}
        onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[radius, 28, 28]} />
        <meshStandardMaterial
          color={meta.color}
          emissive={meta.color}
          emissiveIntensity={selected ? 0.34 : 0.12}
          roughness={0.58}
          metalness={0.05}
        />
      </mesh>
      <mesh scale={selected ? 1.55 : 1.3}>
        <sphereGeometry args={[radius, 18, 18]} />
        <meshBasicMaterial color={meta.color} transparent opacity={selected ? 0.1 : 0.045} side={THREE.BackSide} />
      </mesh>
      <Html center position={[0, radius + 0.42, 0]} distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{ whiteSpace: 'nowrap', padding: '3px 7px', border: `1px solid ${selected ? meta.color : '#c8bfa9'}`, borderRadius: 4, background: 'rgba(251,246,236,.92)', color: '#2b2620', font: '11px/1.2 "IBM Plex Mono",monospace' }}>
          {skill.name} <span style={{ color: meta.color }}>{Math.round(skill.mastery)}%</span>
        </div>
      </Html>
    </group>
  );
}

function SourceHub({ source, position }: { source: SkillSource; position: [number, number, number] }) {
  const meta = SOURCE_META[source];
  return (
    <group position={position}>
      <mesh>
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color={meta.color} roughness={0.72} />
      </mesh>
      <Html center position={[0, 0.68, 0]} distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <span style={{ whiteSpace: 'nowrap', color: meta.color, font: '700 11px/1 "IBM Plex Mono",monospace' }}>{meta.label}</span>
      </Html>
    </group>
  );
}

function CameraFraming() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(0, 1.2, size.width < 420 ? 17 : 13.5);
    camera.lookAt(0, 0, 0);
    if ('updateProjectionMatrix' in camera) camera.updateProjectionMatrix();
  }, [camera, size.width]);
  return null;
}

function Scene({ skills, selected, onSelect }: { skills: AbilitySkill[]; selected: AbilitySkill | null; onSelect: (skill: AbilitySkill) => void }) {
  const hubs = useMemo(() => SOURCE_ORDER.map((source, index) => ({
    source,
    position: [Math.cos(index * Math.PI / 2) * 2.15, Math.sin(index * Math.PI / 2) * 1.45, 0] as [number, number, number],
  })), []);
  const hubMap = useMemo(() => new Map(hubs.map((hub) => [hub.source, hub.position])), [hubs]);
  return (
    <>
      <color attach="background" args={['#f5eedf']} />
      <fog attach="fog" args={['#f5eedf', 13, 26]} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[6, 8, 10]} intensity={1.25} color="#fff7e8" />
      <pointLight position={[-7, -5, 5]} intensity={0.5} color="#f0b85a" />
      <CameraFraming />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={7} maxDistance={19} enablePan={false} />

      <mesh onClick={() => undefined}>
        <sphereGeometry args={[0.78, 32, 32]} />
        <meshStandardMaterial color="#e3b655" emissive="#d8482b" emissiveIntensity={0.18} roughness={0.58} metalness={0.04} />
      </mesh>
      <Html center position={[0, 0, 0.82]} distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{ whiteSpace: 'nowrap', padding: '4px 7px', border: '1px solid #d8482b', borderRadius: 4, background: 'rgba(251,246,236,.94)', color: '#2b2620', font: '700 11px/1 "IBM Plex Mono",monospace' }}>个人能力</div>
      </Html>

      {hubs.map((hub) => (
        <group key={hub.source}>
          <Line points={[[0, 0, 0], hub.position]} color="#9f9682" transparent opacity={0.45} lineWidth={1} />
          <SourceHub source={hub.source} position={hub.position} />
        </group>
      ))}
      {skills.map((skill) => (
        <group key={skill.id}>
          <Line points={[hubMap.get(skill.source)!, skill.position]} color={SOURCE_META[skill.source].color} transparent opacity={selected?.id === skill.id ? 0.82 : 0.34} lineWidth={selected?.id === skill.id ? 2 : 1} />
          <AbilityNode skill={skill} selected={selected?.id === skill.id} onSelect={onSelect} />
        </group>
      ))}
    </>
  );
}

export default function AbilityMap3D({ profileSkills, effectiveSkills }: { profileSkills: ProfileSkill[]; effectiveSkills: EffectiveSkill[] }) {
  const skills = useMemo(() => buildSkills(profileSkills, effectiveSkills), [profileSkills, effectiveSkills]);
  const [selected, setSelected] = useState<AbilitySkill | null>(skills[0] || null);
  const [viewKey, setViewKey] = useState(0);
  const average = skills.length ? Math.round(skills.reduce((sum, skill) => sum + skill.mastery, 0) / skills.length) : 0;

  return (
    <div>
      <div style={{ position: 'relative', height: 'clamp(360px, 44vw, 480px)', overflow: 'hidden', borderTop: '1px dashed var(--rule)', borderBottom: '1px dashed var(--rule)', background: 'var(--paper-tint)' }}>
        <Canvas key={viewKey} camera={{ position: [0, 1.2, 12], fov: 48, near: 0.1, far: 60 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}>
          <Scene skills={skills} selected={selected} onSelect={setSelected} />
        </Canvas>
        <button
          type="button"
          className="hd-btn small secondary"
          onClick={() => setViewKey((value) => value + 1)}
          title="重置视角"
          aria-label="重置视角"
          style={{ position: 'absolute', top: 10, right: 10, width: 34, height: 34, padding: 0, display: 'grid', placeItems: 'center' }}
        >
          <IconRefresh size={15} />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 12 }}>
        {SOURCE_ORDER.map((source) => (
          <span key={source} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--pencil)', font: '11px/1 var(--mono)' }}>
            <i style={{ width: 9, height: 9, borderRadius: 2, background: SOURCE_META[source].color }} />
            {SOURCE_META[source].label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--pencil)', font: '11px/1 var(--mono)' }}>{skills.length} 项技能 · 平均 {average}%</span>
      </div>

      {selected && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 12, alignItems: 'center', marginTop: 12, padding: '10px 0 0', borderTop: '1px dashed var(--rule)' }}>
          <strong style={{ color: 'var(--ink)', font: '700 16px/1.2 var(--hand-bold)' }}>{selected.name}</strong>
          <span style={{ color: SOURCE_META[selected.source].color, font: '12px/1 var(--mono)' }}>{SOURCE_META[selected.source].label}</span>
          <span style={{ color: 'var(--accent)', font: '700 18px/1 var(--serif)' }}>{Math.round(selected.mastery)}%</span>
        </div>
      )}
    </div>
  );
}
