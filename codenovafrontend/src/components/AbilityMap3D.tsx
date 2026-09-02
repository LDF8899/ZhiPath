import { useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCcw } from 'lucide-react';

/**
 * 能力画像 3D —— 移植自老前端用户中心的 AbilityMap3D。
 *
 * 中心球代表"个人能力"，四个来源枢纽（自评/对话识别/GitHub/考试认证）呈环形分布，
 * 技能节点按来源分组挂在枢纽上：颜色区分证据来源，球体大小随掌握度缩放，
 * 点击节点查看详情，OrbitControls 拖拽旋转。
 *
 * 相比老版本的调整：配色对齐新前端的浅色主题（原为米黄纸色），
 * effectiveSkills 兼容 { name } 与 { skillName } 两种字段名。
 */

type SkillSource = 'self_report' | 'conversation' | 'github' | 'exam';

interface ProfileSkill {
  name: string;
  level?: string;
  source?: string;
}

interface EffectiveSkill {
  skillName?: string;
  name?: string;
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
  self_report: { label: '自评', color: '#64748b' },
  conversation: { label: '对话识别', color: '#8b5cf6' },
  github: { label: 'GitHub', color: '#0ea5e9' },
  exam: { label: '考试认证', color: '#10b981' },
};

const CANVAS_BG = '#eef1f8';
const INK = '#12141f';
const RULE = '#c8cde0';

const LEVEL_MASTERY: Record<string, number> = { 了解: 30, 熟悉: 60, 精通: 90 };
const SOURCE_ORDER: SkillSource[] = ['self_report', 'conversation', 'github', 'exam'];

function normalizeSource(value?: string): SkillSource {
  const text = String(value || '').toLowerCase();
  if (SOURCE_ORDER.includes(text as SkillSource)) return text as SkillSource;
  // 新前端技能来源的宽松匹配：quiz/exam 都是"考试认证"，git 类都归 GitHub
  if (text.includes('exam') || text.includes('quiz')) return 'exam';
  if (text.includes('git')) return 'github';
  if (text.includes('chat') || text.includes('conversation')) return 'conversation';
  return 'self_report';
}

function skillNameOf(skill: EffectiveSkill): string {
  return String(skill.skillName ?? skill.name ?? '').toLowerCase();
}

function buildSkills(profileSkills: ProfileSkill[], effectiveSkills: EffectiveSkill[]): AbilitySkill[] {
  const effectiveByName = new Map(effectiveSkills.map((skill) => [skillNameOf(skill), skill]));
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

function labelStyle(selected: boolean, color: string): React.CSSProperties {
  return {
    whiteSpace: 'nowrap',
    padding: '3px 7px',
    border: `1px solid ${selected ? color : RULE}`,
    borderRadius: 6,
    background: 'rgba(255,255,255,.94)',
    color: INK,
    font: '11px/1.4 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    pointerEvents: 'none',
  };
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
        <div style={labelStyle(selected, meta.color)}>
          {skill.name} <span style={{ color: meta.color, fontWeight: 700 }}>{Math.round(skill.mastery)}%</span>
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
        <span style={{ whiteSpace: 'nowrap', color: meta.color, fontWeight: 700, font: '11px/1 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif' }}>{meta.label}</span>
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
      <color attach="background" args={[CANVAS_BG]} />
      <fog attach="fog" args={[CANVAS_BG, 13, 26]} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[6, 8, 10]} intensity={1.25} color="#ffffff" />
      <pointLight position={[-7, -5, 5]} intensity={0.5} color="#8b93f8" />
      <CameraFraming />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={7} maxDistance={19} enablePan={false} />

      <mesh onClick={() => undefined}>
        <sphereGeometry args={[0.78, 32, 32]} />
        <meshStandardMaterial color="#5453ea" emissive="#5453ea" emissiveIntensity={0.2} roughness={0.5} metalness={0.08} />
      </mesh>
      <Html center position={[0, 0, 0.82]} distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{ ...labelStyle(true, '#5453ea'), fontWeight: 700 }}>个人能力</div>
      </Html>

      {hubs.map((hub) => (
        <group key={hub.source}>
          <Line points={[[0, 0, 0], hub.position]} color="#9aa0b4" transparent opacity={0.45} lineWidth={1} />
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
      <div style={{ position: 'relative', height: 'clamp(320px, 38vw, 440px)', overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', background: CANVAS_BG }}>
        <Canvas key={viewKey} camera={{ position: [0, 1.2, 12], fov: 48, near: 0.1, far: 60 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}>
          <Scene skills={skills} selected={selected} onSelect={setSelected} />
        </Canvas>
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          onClick={() => setViewKey((value) => value + 1)}
          title="重置视角"
          aria-label="重置视角"
          style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, padding: 0, display: 'grid', placeItems: 'center', borderRadius: 8 }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="row wrap" style={{ gap: 10, paddingTop: 10 }}>
        {SOURCE_ORDER.map((source) => (
          <span key={source} className="row tiny faint" style={{ gap: 5 }}>
            <i style={{ width: 9, height: 9, borderRadius: 2, background: SOURCE_META[source].color }} />
            {SOURCE_META[source].label}
          </span>
        ))}
        <span className="tiny faint" style={{ marginLeft: 'auto' }}>{skills.length} 项技能 · 平均 {average}%</span>
      </div>

      {selected && (
        <div className="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 12, alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
          <strong style={{ fontSize: 15, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</strong>
          <span className="tiny" style={{ color: SOURCE_META[selected.source].color, fontWeight: 700 }}>{SOURCE_META[selected.source].label}</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--brand-600)' }}>{Math.round(selected.mastery)}%</span>
        </div>
      )}
    </div>
  );
}
