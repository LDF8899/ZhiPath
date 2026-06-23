import React, { useState, useEffect, useCallback } from 'react';
import { makeAnimalSVG } from './AnimalSVG';
import type { AgentProfile, AnimalType } from './types';

/* ═══════════════════════════════════════════════
   常量
   ═══════════════════════════════════════════════ */

const ANIMAL_TYPES: { type: AnimalType; label: string }[] = [
  { type: 'cat', label: '猫咪' },
  { type: 'dog', label: '柴犬' },
  { type: 'rabbit', label: '兔叽' },
  { type: 'panda', label: '熊猫' },
  { type: 'fox', label: '狐狸' },
  { type: 'bear', label: '棕熊' },
  { type: 'owl', label: '猫头鹰' },
  { type: 'penguin', label: '企鹅' },
  { type: 'hamster', label: '仓鼠' },
  { type: 'hedgehog', label: '刺猬' },
  { type: 'raccoon', label: '浣熊' },
  { type: 'deer', label: '小鹿' },
];

const COLOR_SCHEMES = [
  { color: '#f9d27c', label: '暖橙' },
  { color: '#c9daf5', label: '天蓝' },
  { color: '#ffd5c9', label: '樱粉' },
  { color: '#c9f5c0', label: '嫩绿' },
  { color: '#e5d5f5', label: '薰紫' },
  { color: '#f5b8a8', label: '珊瑚' },
  { color: '#b8f0e0', label: '薄荷' },
  { color: '#f5f0a8', label: '柠檬' },
  { color: '#d0c0f0', label: '淡紫' },
  { color: '#fdd8b8', label: '蜜桃' },
  { color: '#a8d8f0', label: '晴空' },
  { color: '#f0c0d0', label: '玫瑰' },
];

const DISPLAY_ROLES = [
  '讲义专家', '阅读向导', '代码大师', '路径规划', '评估官',
  '前端开发', '后端开发', 'UI 设计', '数据分析', 'AI 训练',
];

const DEFAULT_ANIMALS: AnimalType[] = ['cat', 'dog', 'rabbit', 'panda', 'fox', 'bear', 'owl', 'penguin', 'hamster', 'hedgehog', 'raccoon', 'deer'];
const CUTE_NAMES = ['豆豆','糖糖','奶茶','小柚','芒果','芋圆','麻薯','布丁','年糕','汤圆','糯米','雪糕','椰果','草莓','蜜桃','蓝莓'];

/* ═══════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════ */

interface OfficeModalsProps {
  modalType: 'hire' | 'edit' | 'direct-use' | 'fire' | null;
  editingProfile: AgentProfile | null;
  agentTypes: Record<string, { label: string; defaultRole: string }>;
  onClose: () => void;
  onHire: (data: { agentType: string; animalType: string; color: string; nickname: string; displayRole: string }) => Promise<void>;
  onSaveProfile: (profileId: number, data: { animalType: string; color: string; nickname: string; displayRole: string }) => Promise<void>;
  onFireAgent: (profileId: number) => Promise<void>;
  onDirectUse: (profileId: number, prompt: string) => Promise<void>;
}

/**
 * 办公室弹窗组件 — 统一管理招聘/编辑/直接使用/解雇弹窗
 */
export default function OfficeModals({
  modalType, editingProfile, agentTypes, onClose,
  onHire, onSaveProfile, onFireAgent, onDirectUse,
}: OfficeModalsProps) {
  if (!modalType) return null;

  return (
    <>
      {modalType === 'hire' && (
        <HireModal agentTypes={agentTypes} onClose={onClose} onHire={onHire} />
      )}
      {modalType === 'edit' && editingProfile && (
        <EditModal profile={editingProfile} onClose={onClose} onSave={onSaveProfile} onFire={onFireAgent} />
      )}
      {modalType === 'direct-use' && editingProfile && (
        <DirectUseModal profile={editingProfile} onClose={onClose} onUse={onDirectUse} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════
   招聘弹窗
   ═══════════════════════════════════════════════ */

function HireModal({ agentTypes, onClose, onHire }: {
  agentTypes: Record<string, { label: string; defaultRole: string }>;
  onClose: () => void;
  onHire: (data: any) => Promise<void>;
}) {
  const [agentType, setAgentType] = useState(() => {
    const types = Object.keys(agentTypes);
    return types[Math.floor(Math.random() * types.length)] || 'lecture';
  });
  const [animal, setAnimal] = useState<AnimalType>(DEFAULT_ANIMALS[Math.floor(Math.random() * DEFAULT_ANIMALS.length)]);
  const [color, setColor] = useState(COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)].color);
  const [name, setName] = useState(CUTE_NAMES[Math.floor(Math.random() * CUTE_NAMES.length)]);
  const [role, setRole] = useState(agentTypes[agentType]?.defaultRole || '讲义专家');
  const [submitting, setSubmitting] = useState(false);

  // agentType 变化时更新 role
  useEffect(() => {
    setRole(agentTypes[agentType]?.defaultRole || '讲义专家');
  }, [agentType, agentTypes]);

  const handleRandomize = () => {
    setAnimal(DEFAULT_ANIMALS[Math.floor(Math.random() * DEFAULT_ANIMALS.length)]);
    setColor(COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)].color);
    setName(CUTE_NAMES[Math.floor(Math.random() * CUTE_NAMES.length)]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onHire({ agentType, animalType: animal, color, nickname: name.trim(), displayRole: role });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="office-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="office-modal">
        <div className="office-modal-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
          招聘新员工
        </div>
        <div className="office-modal-sub">选择智能体类型、形象和配色，为办公室添加新伙伴</div>

        <div className="office-modal-section">
          <div className="office-preview">
            <div className="office-preview-avatar" dangerouslySetInnerHTML={{ __html: makeAnimalSVG(animal, color) }} />
            <div className="preview-info">
              <div className="office-preview-name">{name || '???'}</div>
              <div className="office-preview-role">{role}</div>
            </div>
            <button className="office-btn ghost" style={{ marginLeft: 'auto', fontSize: 12, padding: '7px 12px' }} onClick={handleRandomize}>随机生成</button>
          </div>
        </div>

        <div className="office-modal-section">
          <label className="office-modal-label">智能体类型</label>
          <div className="role-grid">
            {Object.entries(agentTypes).map(([key, val]) => (
              <div key={key} className={`role-pick ${agentType === key ? 'selected' : ''}`} onClick={() => setAgentType(key)}>
                {val.label}
              </div>
            ))}
          </div>
        </div>

        <div className="office-modal-section">
          <label className="office-modal-label">选择形象</label>
          <div className="office-animal-grid">
            {ANIMAL_TYPES.map(a => (
              <div key={a.type} className={`office-animal-pick ${animal === a.type ? 'selected' : ''}`} onClick={() => setAnimal(a.type)}>
                <div className="pick-avatar" dangerouslySetInnerHTML={{ __html: makeAnimalSVG(a.type, color) }} />
                <div className="pick-name">{a.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="office-modal-section">
          <label className="office-modal-label">配色方案</label>
          <div className="office-color-grid">
            {COLOR_SCHEMES.map(s => (
              <div key={s.color} className={`office-color-pick ${color === s.color ? 'selected' : ''}`} style={{ background: s.color }} onClick={() => setColor(s.color)} title={s.label} />
            ))}
          </div>
        </div>

        <div className="office-modal-section">
          <label className="office-modal-label">员工昵称</label>
          <input className="office-name-input" value={name} onChange={e => setName(e.target.value)} placeholder="给新伙伴起个名字" maxLength={8} />
        </div>

        <div className="office-modal-section">
          <label className="office-modal-label">显示岗位</label>
          <input className="office-name-input" value={role} onChange={e => setRole(e.target.value)} placeholder="如：讲义专家" maxLength={20} />
        </div>

        <div className="office-modal-actions">
          <button className="office-btn ghost" onClick={onClose}>取消</button>
          <button className="office-btn primary" onClick={handleSubmit} disabled={submitting}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            确认招聘
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   编辑弹窗
   ═══════════════════════════════════════════════ */

function EditModal({ profile, onClose, onSave, onFire }: {
  profile: AgentProfile;
  onClose: () => void;
  onSave: (id: number, data: any) => Promise<void>;
  onFire: (id: number) => Promise<void>;
}) {
  const [animal, setAnimal] = useState<AnimalType>(profile.animalType as AnimalType);
  const [color, setColor] = useState(profile.color);
  const [name, setName] = useState(profile.nickname);
  const [role, setRole] = useState(profile.displayRole);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSave(profile.id, { animalType: animal, color, nickname: name.trim(), displayRole: role });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFire = async () => {
    if (!confirm(`确定要让 ${profile.nickname} 离职吗？`)) return;
    await onFire(profile.id);
  };

  return (
    <div className="office-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="office-modal">
        <div className="office-modal-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>
          编辑员工
        </div>
        <div className="office-modal-sub">修改 {name} 的形象和配置</div>

        <div className="office-modal-section">
          <div className="office-preview">
            <div className="office-preview-avatar" dangerouslySetInnerHTML={{ __html: makeAnimalSVG(animal, color) }} />
            <div className="preview-info">
              <div className="office-preview-name">{name || '???'}</div>
              <div className="office-preview-role">{role}</div>
            </div>
          </div>
        </div>

        <div className="office-modal-section">
          <label className="office-modal-label">选择形象</label>
          <div className="office-animal-grid">
            {ANIMAL_TYPES.map(a => (
              <div key={a.type} className={`office-animal-pick ${animal === a.type ? 'selected' : ''}`} onClick={() => setAnimal(a.type)}>
                <div className="pick-avatar" dangerouslySetInnerHTML={{ __html: makeAnimalSVG(a.type, color) }} />
                <div className="pick-name">{a.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="office-modal-section">
          <label className="office-modal-label">配色方案</label>
          <div className="office-color-grid">
            {COLOR_SCHEMES.map(s => (
              <div key={s.color} className={`office-color-pick ${color === s.color ? 'selected' : ''}`} style={{ background: s.color }} onClick={() => setColor(s.color)} title={s.label} />
            ))}
          </div>
        </div>

        <div className="office-modal-section">
          <label className="office-modal-label">员工昵称</label>
          <input className="office-name-input" value={name} onChange={e => setName(e.target.value)} placeholder="给你的小伙伴起个名字" maxLength={8} />
        </div>

        <div className="office-modal-section">
          <label className="office-modal-label">岗位角色</label>
          <div className="role-grid">
            {DISPLAY_ROLES.map(r => (
              <div key={r} className={`role-pick ${role === r ? 'selected' : ''}`} onClick={() => setRole(r)}>{r}</div>
            ))}
          </div>
        </div>

        <div className="office-modal-actions">
          <button className="office-btn ghost" style={{ color: 'var(--accent)', marginRight: 'auto' }} onClick={handleFire}>
            解雇
          </button>
          <button className="office-btn ghost" onClick={onClose}>取消</button>
          <button className="office-btn primary" onClick={handleSave} disabled={submitting}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   直接使用弹窗
   ═══════════════════════════════════════════════ */

function DirectUseModal({ profile, onClose, onUse }: {
  profile: AgentProfile;
  onClose: () => void;
  onUse: (profileId: number, prompt: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      await onUse(profile.id, prompt.trim());
    } finally {
      setLoading(false);
    }
  };

  const AGENT_LABELS: Record<string, string> = {
    lecture: '讲义生成', reading: '拓展阅读', code: '代码案例', path: '学习路径',
    assess: '学习评估', exam: '考试出题', skillgap: '技能差距', resume: '简历生成',
    profile: '画像分析', news: '资讯推荐',
  };

  return (
    <div className="office-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="office-modal" style={{ width: 420 }}>
        <div className="office-modal-title">
          <div style={{ width: 40, height: 40 }} dangerouslySetInnerHTML={{ __html: makeAnimalSVG(profile.animalType, profile.color) }} />
          直接使用 {profile.nickname}
        </div>
        <div className="office-modal-sub">{profile.displayRole} · {AGENT_LABELS[profile.agentType] || profile.agentType}</div>

        <div className="office-modal-section">
          <label className="office-modal-label">输入指令</label>
          <textarea
            className="office-name-input"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={`给 ${profile.nickname} 派发任务...\n例如：生成 React Hooks 讲义`}
            rows={3}
            style={{ resize: 'vertical', minHeight: 80 }}
          />
        </div>

        <div className="office-modal-actions">
          <button className="office-btn ghost" onClick={onClose}>取消</button>
          <button className="office-btn primary" onClick={handleSubmit} disabled={loading || !prompt.trim()}>
            {loading ? '派发中...' : '派发任务'}
          </button>
        </div>
      </div>
    </div>
  );
}
