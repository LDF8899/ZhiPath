import { useState } from 'react';
import { mockProfile } from '../../mock/data';
import '../../styles/hand-draw.css';
import {
  IconPlus,
  IconCode,
  IconExternalLink,
  IconX,
  IconCheck,
} from '../../components/icons';

/** Toast helper */
function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `hd-message ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

export default function Projects() {
  const [projects, setProjects] = useState(mockProfile.projects);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', role: '', tech: '', time: '', githubUrl: '',
  });

  const handleSave = () => {
    if (!form.name) return;
    const newProject = {
      name: form.name,
      description: form.description,
      role: form.role,
      tech: form.tech.split(',').map((t) => t.trim()).filter(Boolean),
      time: form.time,
      githubUrl: form.githubUrl,
      highlights: [],
    };
    setProjects((prev) => [...prev, newProject]);
    setShowForm(false);
    setForm({ name: '', description: '', role: '', tech: '', time: '', githubUrl: '' });
    showToast('项目已保存');
  };

  const handleCancel = () => {
    setShowForm(false);
    setForm({ name: '', description: '', role: '', tech: '', time: '', githubUrl: '' });
  };

  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        {/* Header */}
        <div className="hd-header">
          <div>
            <h1>项目经历</h1>
            <p style={{ font: '15px/1.3 var(--hand)', color: 'var(--pencil)', margin: '4px 0 0' }}>
              展示你的项目经验，提升岗位匹配度
            </p>
          </div>
          <button className="hd-btn" onClick={() => setShowForm(true)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IconPlus size={18} /> 添加项目
            </span>
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="hd-canvas" style={{ marginBottom: 20 }}>
            <h3 style={{ font: '800 20px/1 var(--serif)', margin: '0 0 16px' }}>新项目</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', display: 'block', marginBottom: 6 }}>项目名称</label>
                <input className="hd-input" placeholder="项目名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', display: 'block', marginBottom: 6 }}>你的角色</label>
                <input className="hd-input" placeholder="你的角色" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </div>
              <div>
                <label style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', display: 'block', marginBottom: 6 }}>技术栈</label>
                <input className="hd-input" placeholder="逗号分隔，如 React, TypeScript" value={form.tech} onChange={(e) => setForm({ ...form, tech: e.target.value })} />
              </div>
              <div>
                <label style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', display: 'block', marginBottom: 6 }}>时间</label>
                <input className="hd-input" placeholder="如 2025.09 - 2025.12" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', display: 'block', marginBottom: 6 }}>GitHub 链接</label>
                <input className="hd-input" placeholder="https://github.com/..." value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', display: 'block', marginBottom: 6 }}>项目描述</label>
                <textarea className="hd-textarea" placeholder="项目描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="hd-btn small" onClick={handleSave}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={15} /> 保存
                </span>
              </button>
              <button className="hd-btn small secondary" onClick={handleCancel}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconX size={15} /> 取消
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Project list */}
        {projects.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {projects.map((proj, i) => (
              <div key={i} className="hd-card">
                <div className="hd-flex-between" style={{ marginBottom: 8 }}>
                  <div>
                    <h3 style={{ font: '800 20px/1 var(--serif)', margin: '0 0 4px' }}>{proj.name}</h3>
                    <p style={{ font: '14px/1.3 var(--hand)', color: 'var(--pencil)' }}>
                      {proj.role} · {proj.time}
                    </p>
                  </div>
                  {proj.githubUrl && (
                    <a
                      href={proj.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hd-link"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '14px/1 var(--hand)' }}
                    >
                      <IconExternalLink size={16} /> GitHub
                    </a>
                  )}
                </div>

                <p style={{ font: '15px/1.5 var(--hand)', color: 'var(--ink)', margin: '0 0 12px' }}>
                  {proj.description}
                </p>

                {/* Tech stack tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {proj.tech.map((t) => (
                    <span key={t} className="hd-tag">{t}</span>
                  ))}
                </div>

                {proj.highlights.length > 0 && (
                  <div className="hd-dashed" style={{ marginTop: 10, font: '13px/1.4 var(--hand)', color: 'var(--pencil)' }}>
                    亮点：{proj.highlights.join('、')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          !showForm && (
            <div className="hd-canvas">
              <div className="hd-empty">
                <IconCode size={48} />
                <div style={{ marginTop: 12 }}>还没有项目经历</div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
