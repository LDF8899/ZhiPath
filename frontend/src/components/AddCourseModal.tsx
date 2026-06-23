import { useState } from 'react';
import { addSkill } from '../api/user';
import '../styles/hand-draw.css';

interface AddCourseModalProps {
  planId: number;
  onClose: () => void;
  onAdded: () => void;
}

const RECOMMENDED_SKILLS = [
  'React', 'Vue', 'Angular', 'Node.js', 'TypeScript', 'Python',
  'Docker', 'Kubernetes', 'AWS', 'GraphQL', 'Redis', 'MongoDB',
  'Git', 'Linux', 'CI/CD', 'Testing', 'Design Patterns', 'System Design',
];

/**
 * 添加课程弹窗 — 搜索或推荐方式添加技能到计划
 */
export default function AddCourseModal({ planId, onClose, onAdded }: AddCourseModalProps) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  const filtered = search.trim()
    ? RECOMMENDED_SKILLS.filter(s => s.toLowerCase().includes(search.toLowerCase()))
    : RECOMMENDED_SKILLS;

  const handleAdd = async (skillName: string) => {
    setAdding(skillName);
    try {
      await addSkill({ name: skillName, source: 'self_select', planId });
      onAdded();
    } catch {} finally {
      setAdding(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(43,38,32,0.3)',
      }}
      onClick={onClose}
    >
      <div
        className="hd-card-accent"
        style={{ maxWidth: 520, width: '90%', background: 'var(--paper)', padding: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ font: '800 22px/1 var(--serif)', margin: '0 0 16px' }}>
          添加课程
        </h3>

        {/* 搜索框 */}
        <input
          type="text"
          className="hd-input"
          placeholder="搜索技能，如 React、Python..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', marginBottom: 16, padding: '10px 14px', fontSize: 15 }}
        />

        {/* 推荐标签 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)', marginBottom: 8, letterSpacing: '0.12em' }}>
            {search.trim() ? '搜索结果' : '推荐技能'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {filtered.map(skill => (
              <button
                key={skill}
                className="hd-tag"
                style={{
                  cursor: 'pointer',
                  opacity: adding === skill ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
                disabled={!!adding}
                onClick={() => handleAdd(skill)}
              >
                {adding === skill ? '添加中...' : `+ ${skill}`}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && search.trim() && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--pencil)' }}>
            未找到匹配的技能
          </div>
        )}

        {/* 关闭按钮 */}
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <button className="hd-btn secondary small" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
