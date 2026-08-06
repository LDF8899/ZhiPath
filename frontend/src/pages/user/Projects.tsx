import { useEffect, useState } from 'react';
import { getProfile, saveProject } from '../../api/user';
import EmptyState from '../../components/EmptyState';
import '../../styles/hand-draw.css';
import {
  IconCheck,
  IconDocument,
  IconExternalLink,
  IconPlus,
  IconRefresh,
  IconX,
} from '../../components/icons';

type ProjectEvidence = {
  name: string;
  description?: string;
  role?: string;
  tech?: string[];
  techStack?: string[];
  time?: string;
  github_url?: string;
  githubUrl?: string;
  highlights?: string[];
  source?: string;
  evidenceType?: string;
  fileName?: string;
  contentPreview?: string;
  question?: string;
};

const emptyForm = {
  name: '',
  description: '',
  role: '',
  tech: '',
  time: '',
  githubUrl: '',
};

function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `hd-message ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

export default function Projects() {
  const [projects, setProjects] = useState<ProjectEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await getProfile();
      setProjects(Array.isArray(res.data?.projects) ? res.data.projects : []);
    } catch (err: any) {
      showToast(err?.message || '项目经历加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleSave = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        role: form.role.trim(),
        tech: parseTech(form.tech),
        time: form.time.trim(),
        github_url: form.githubUrl.trim(),
        highlights: buildHighlights(form.description),
        source: 'manual',
        evidence_type: 'project',
      };
      const res = await saveProject(payload);
      setProjects((prev) => [...prev, res.data || payload]);
      setShowForm(false);
      setForm(emptyForm);
      showToast('项目已保存，并沉淀为技能证据');
    } catch (err: any) {
      showToast(err?.message || '项目保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setForm(emptyForm);
  };

  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        <div className="hd-header">
          <div>
            <h1>项目经历</h1>
            <p style={{ font: '15px/1.3 var(--hand)', color: 'var(--pencil)', margin: '4px 0 0' }}>
              把做过的项目沉淀成技能证据，支撑匹配度和岗位版简历建议。
            </p>
          </div>
          <div className="hd-flex" style={{ gap: 8 }}>
            <button className="hd-btn secondary" onClick={loadProjects} disabled={loading}>
              <IconRefresh size={16} /> 刷新
            </button>
            <button className="hd-btn" onClick={() => setShowForm(true)}>
              <IconPlus size={18} /> 添加项目
            </button>
          </div>
        </div>

        {showForm && (
          <section className="hd-canvas" style={{ marginBottom: 20 }}>
            <h3 style={{ font: '800 20px/1 var(--serif)', margin: '0 0 16px' }}>新项目证据</h3>
            <div className="hd-grid-2" style={{ gap: 12 }}>
              <Field label="项目名称">
                <input className="hd-input" placeholder="如：就业数据分析看板" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="你的角色">
                <input className="hd-input" placeholder="如：前端开发 / 数据分析" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </Field>
              <Field label="技术栈">
                <input className="hd-input" placeholder="逗号分隔，如 React, TypeScript, NestJS" value={form.tech} onChange={(e) => setForm({ ...form, tech: e.target.value })} />
              </Field>
              <Field label="时间">
                <input className="hd-input" placeholder="如 2025.09 - 2025.12" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </Field>
              <Field label="GitHub 链接" full>
                <input className="hd-input" placeholder="https://github.com/..." value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} />
              </Field>
              <Field label="项目描述" full>
                <textarea className="hd-textarea" placeholder="写清楚做了什么、用了什么技术、解决了什么问题、结果如何。" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
              </Field>
            </div>
            <div className="hd-flex" style={{ gap: 10, marginTop: 16 }}>
              <button className="hd-btn small" onClick={handleSave} disabled={!form.name.trim() || saving}>
                <IconCheck size={15} /> {saving ? '保存中...' : '保存为证据'}
              </button>
              <button className="hd-btn small secondary" onClick={handleCancel}>
                <IconX size={15} /> 取消
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <div className="hd-canvas">
            <div className="hd-loading">项目经历加载中...</div>
          </div>
        ) : projects.length > 0 ? (
          <div className="hd-flex-col" style={{ gap: 14 }}>
            {projects.map((project, index) => (
              <ProjectCard key={`${project.name}-${index}`} project={project} />
            ))}
          </div>
        ) : (
          !showForm && (
            <EmptyState
              icon="book"
              title="还没有项目证据"
              description="先添加一个课程项目、实训项目或 GitHub 项目，它会进入技能证据链，并被简历建议引用。"
              actionLabel="添加项目"
              onAction={() => setShowForm(true)}
            />
          )
        )}
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', display: 'block', marginBottom: 6 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ProjectCard({ project }: { project: ProjectEvidence }) {
  const tech = Array.isArray(project.tech) && project.tech.length ? project.tech : project.techStack || [];
  const githubUrl = project.githubUrl || project.github_url;
  const isFileEvidence = project.source === 'uploaded_file' || project.evidenceType === 'file_qa';

  return (
    <article className="hd-card">
      <div className="hd-flex-between" style={{ marginBottom: 8, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ font: '800 20px/1.15 var(--serif)', margin: '0 0 4px', color: 'var(--ink)' }}>
            {project.name}
          </h3>
          <p style={{ font: '14px/1.3 var(--hand)', color: 'var(--pencil)', margin: 0 }}>
            {project.role || '项目经历'}{project.time ? ` · ${project.time}` : ''}
          </p>
        </div>
        <div className="hd-flex" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isFileEvidence && <span className="hd-badge green"><IconDocument size={12} /> 文件证据</span>}
          {githubUrl && (
            <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="hd-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '14px/1 var(--hand)' }}>
              <IconExternalLink size={16} /> GitHub
            </a>
          )}
        </div>
      </div>

      <p style={{ font: '15px/1.5 var(--hand)', color: 'var(--ink)', margin: '0 0 12px' }}>
        {project.description || project.contentPreview || '暂无项目描述'}
      </p>

      {tech.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tech.map((item) => (
            <span key={item} className="hd-tag">{item}</span>
          ))}
        </div>
      )}

      {project.highlights?.length ? (
        <div className="hd-dashed" style={{ marginTop: 10, font: '13px/1.4 var(--hand)', color: 'var(--pencil)' }}>
          亮点：{project.highlights.join('；')}
        </div>
      ) : null}

      {project.fileName && (
        <div className="hd-dashed" style={{ marginTop: 10, font: '12px/1.4 var(--mono)', color: 'var(--pencil)' }}>
          来源文件：{project.fileName}
        </div>
      )}
    </article>
  );
}

function parseTech(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function buildHighlights(description: string) {
  const text = description.trim();
  if (!text) return [];
  return text
    .split(/[。；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}
