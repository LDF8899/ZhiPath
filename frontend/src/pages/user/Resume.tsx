import { useState, useEffect } from 'react';
import { getResumes, getResume, generateResume, deleteResume, branchResume, getJobs, exportResumePdf, updateResume } from '../../api/user';
import '../../styles/hand-draw.css';
import {
  IconDocument,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconDownload,
  IconCheck,
  IconX,
  IconEdit,
} from '../../components/icons';

/** Toast helper */
function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `hd-message ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function isUsableResumeHtml(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const html = value.trim();
  if (html.length < 80 || /^```(?:html)?\s*$/i.test(html)) return false;
  return /<(?:body|main|section|article|div|h1)\b/i.test(html)
    && /[\p{L}\p{N}]{2,}/u.test(html.replace(/<[^>]*>/g, ' '));
}

function buildRecoveredResumeHtml(content: Record<string, any> | null | undefined): string {
  const data = content || {};
  const pi = data.personalInfo || {};
  const escapeHtml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const work = Array.isArray(data.workExperience) ? data.workExperience : [];
  const campus = Array.isArray(data.campusExperience) ? data.campusExperience : [];
  const job = data.targetJob;

  const contacts = [
    pi.phone && { label: '电话', value: pi.phone },
    pi.email && { label: '邮箱', value: pi.email },
    pi.github && { label: 'GitHub', value: pi.github },
  ].filter(Boolean) as { label: string; value: string }[];

  // 技能自动分类
  const skillGroups: Record<string, string[]> = {};
  for (const s of skills) {
    const name = String(s.name || '').toLowerCase();
    let cat = '其他技术';
    if (['llm','rag','pytorch','nlp','模型','大模型','ai'].some(k => name.includes(k))) cat = 'AI & 大模型';
    else if (['docker','k8s','git','linux','nginx'].some(k => name.includes(k))) cat = 'DevOps & 工具';
    else if (['esp32','mqtt','蓝牙','嵌入式','硬件'].some(k => name.includes(k))) cat = '嵌入式 & 硬件';
    else if (['java','spring','mysql','redis','python','go','node','nestjs','fastapi'].some(k => name.includes(k))) cat = '后端 & 数据库';
    else if (['vue','react','electron','html','css','typescript','javascript','小程序'].some(k => name.includes(k))) cat = '前端 & 跨端';
    (skillGroups[cat] ??= []).push(escapeHtml(s.name));
  }

  const skillCards = Object.entries(skillGroups).map(([cat, names]) =>
    `<div class="skill-card"><div class="skill-card-title">${escapeHtml(cat)}</div><div class="skill-card-body">熟练${names.join('、')}等技术</div></div>`
  ).join('\n');

  const projectCards = projects.map((p: any) => {
    const techTags = (p.techStack || p.tech || []).map((t: string) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    return `<div class="project"><div class="project-header"><span class="project-name">${escapeHtml(p.name || '项目')}</span>${p.role ? `<span class="project-role">${escapeHtml(p.role)}</span>` : ''}</div>${techTags ? `<div class="tech-tags">${techTags}</div>` : ''}<div class="project-desc">${escapeHtml(p.description || p.desc || '')}</div></div>`;
  }).join('\n');

  const campusItems = campus.map((c: any) =>
    `<div class="campus-item"><div class="campus-header"><span class="campus-title">${escapeHtml(c.title || c.name || '')}</span></div><div class="campus-desc">${escapeHtml(c.description || c.desc || '')}</div></div>`
  ).join('\n');

  const evalItems = pi.selfIntro ? `<ul class="eval-list"><li>${escapeHtml(pi.selfIntro)}</li></ul>` : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(pi.name || '个人简历')}</title>
<style>
  :root{--primary:#cc785c;--ink:#141413;--body-color:#3d3d3a;--muted:#6c6a64;--hairline:#e6dfd8;--canvas:#faf9f5;--surface-card:#efe9de;--surface-dark:#8a7f78;--surface-dark-elevated:#9a8f88;--on-dark:#2f2925;--on-dark-soft:#3d3835;--on-primary:#fff;--font-display:"Cormorant Garamond",Garamond,"Times New Roman",serif;--font-body:"Inter","PingFang SC","Microsoft YaHei",sans-serif}
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4;margin:0}
  body{font:13px/1.55 var(--font-body);color:var(--body-color);background:#e8e0d2;-webkit-font-smoothing:antialiased}
  .page{width:210mm;min-height:297mm;margin:20px auto;background:var(--canvas);box-shadow:0 1px 3px rgba(20,20,19,.08)}
  @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}html,body{background:#fff!important}body{font-size:13px}.page{margin:0!important;box-shadow:none!important;width:100%!important;min-height:auto!important}.header{padding:24px 36px 20px}.photo-area{width:90px;height:112px}.name{font-size:28px}.content{padding:18px 36px 24px}.section{margin-bottom:14px}.section-title{font-size:17px;padding-bottom:5px;margin-bottom:8px}.skill-card{padding:10px 12px}.skill-card-body{font-size:11px}.project{padding:10px 14px;margin-bottom:10px;break-inside:avoid}.project-name{font-size:14px}.project-role{font-size:9px}.tag{font-size:10px}.campus-item{padding:8px 12px;break-inside:avoid}}
  .header{background:var(--surface-dark);color:var(--on-dark);padding:36px 44px 32px;display:flex;align-items:center;gap:28px}
  .photo-area{flex-shrink:0;width:108px;height:136px;border:2px dashed var(--on-dark-soft);border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--surface-dark-elevated);font-size:26px;opacity:.4}
  .header-info{flex:1}.name{font:400 36px/1.1 var(--font-display);letter-spacing:-.5px;margin-bottom:6px}
  .job-intent{font-size:14px;color:var(--primary);margin-bottom:16px}
  .contact-row{display:flex;flex-wrap:wrap;gap:5px 18px;font-size:13px;color:var(--on-dark-soft)}
  .contact-item{display:flex;align-items:center;gap:6px}.contact-item .label{color:#5a5450;font-size:11px;letter-spacing:1px;font-weight:500}
  .content{padding:28px 44px 36px}.section{margin-bottom:22px}.section:last-child{margin-bottom:0}
  .section-title{font:500 20px/1 var(--font-display);color:var(--ink);padding-bottom:8px;border-bottom:1.5px solid var(--hairline);margin-bottom:14px;display:flex;align-items:center;gap:10px}
  .section-title::before{content:"";width:8px;height:8px;background:var(--primary);border-radius:2px;flex-shrink:0}
  .edu-row{display:flex;gap:16px;align-items:baseline;margin-bottom:5px}
  .edu-school{font:600 15px/1 var(--font-body);color:var(--ink)}
  .edu-major{font-size:13px;color:var(--muted)}
  .edu-courses{font-size:13px;color:var(--muted);line-height:1.7;margin-top:4px}
  .project{margin-bottom:16px;background:var(--surface-card);border-radius:12px;padding:16px 20px;break-inside:avoid}
  .project-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}
  .project-name{font:600 15px/1 var(--font-body);color:var(--ink)}
  .project-role{font-size:10px;color:var(--on-primary);background:var(--primary);padding:2px 10px;border-radius:9999px;font-weight:500}
  .tech-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
  .tag{font-size:11px;padding:2px 9px;background:var(--canvas);color:var(--muted);border-radius:9999px;border:1px solid var(--hairline)}
  .project-desc{font-size:13px;color:var(--body-color);line-height:1.6}
  .skill-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;break-inside:avoid}
  .skill-card{background:var(--surface-card);border-radius:12px;padding:14px 16px}
  .skill-card-title{font:600 13px/1 var(--font-body);color:var(--ink);margin-bottom:6px;display:flex;align-items:center;gap:6px}
  .skill-card-title::before{content:"";width:6px;height:6px;background:var(--primary);border-radius:2px;flex-shrink:0}
  .skill-card-body{font-size:12px;color:var(--body-color);line-height:1.7}
  .campus-item{margin-bottom:12px;padding:12px 16px;background:var(--surface-card);border-radius:12px;break-inside:avoid}
  .campus-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}
  .campus-title{font:600 14px/1 var(--font-body);color:var(--ink)}
  .campus-desc{font-size:13px;color:var(--body-color);line-height:1.65}
  .eval-list{list-style:none;padding:0}.eval-list li{font-size:13px;line-height:1.7;color:var(--body-color);padding-left:18px;position:relative;margin-bottom:5px}
  .eval-list li::before{content:"";position:absolute;left:1px;top:.65em;width:6px;height:6px;background:var(--primary);border-radius:2px}
  @media(max-width:800px){.header{padding:24px;flex-wrap:wrap;gap:18px}.content{padding:20px}.name{font-size:28px}.skill-grid{grid-template-columns:1fr}}
</style></head>
<body><div class="page">
<div class="header">
  <div class="photo-area"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="8" cy="9" r="2"/><path d="M21 16l-5-5-6 6-3-3-5 5"/></svg></div>
  <div class="header-info">
    <div class="name">${escapeHtml(pi.name || '未填写姓名')}</div>
    ${job ? `<div class="job-intent">求职方向：${escapeHtml(job.title || '')}${job.company ? ` · ${escapeHtml(job.company)}` : ''}</div>` : ''}
    ${contacts.length > 0 ? `<div class="contact-row">${contacts.map(c => `<div class="contact-item"><span class="label">${escapeHtml(c.label)}</span><span>${escapeHtml(c.value)}</span></div>`).join('')}</div>` : ''}
  </div>
</div>
<div class="content">
  ${pi.school ? `<div class="section"><div class="section-title">教育背景</div><div class="edu-row"><span class="edu-school">${escapeHtml(pi.school)}</span>${pi.major ? `<span class="edu-major">| ${escapeHtml(pi.major)}${pi.grade ? ` ${escapeHtml(pi.grade)}` : ''}</span>` : ''}</div></div>` : ''}
  ${campusItems ? `<div class="section"><div class="section-title">校园经历</div>${campusItems}</div>` : ''}
  ${skillCards ? `<div class="section"><div class="section-title">专业技能</div><div class="skill-grid">${skillCards}</div></div>` : ''}
  ${projectCards ? `<div class="section"><div class="section-title">项目经历</div>${projectCards}</div>` : ''}
  ${evalItems ? `<div class="section"><div class="section-title">自我评价</div>${evalItems}</div>` : ''}
  ${!skillCards && !projectCards ? '<div class="section"><div class="section-title">完善简历</div><p style="font-size:13px;color:var(--muted)">当前画像信息较少，请先在个人中心补充技能和项目经历。</p></div>' : ''}
</div></div></body></html>`;
}

export default function ResumePage() {
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Branch modal state
  const [branchModal, setBranchModal] = useState(false);
  const [branchBaseId, setBranchBaseId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [branchJobId, setBranchJobId] = useState<number | null>(null);

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Exporting state
  const [exportingId, setExportingId] = useState<number | null>(null);

  // Detail view state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [resumeDetail, setResumeDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedHtml, setEditedHtml] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchResumes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getResumes();
      setResumes(res.data || []);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResumes(); }, []);

  const handleGenerate = async (targetJobId?: number) => {
    setGenerating(true);
    try {
      await generateResume(targetJobId);
      showToast('简历生成成功');
      fetchResumes();
    } catch (e: any) {
      showToast(e?.message || '生成失败', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteResume(id);
      showToast('已删除');
      setDeleteConfirmId(null);
      fetchResumes();
    } catch (e: any) {
      showToast(e?.message || '删除失败', 'error');
    }
  };

  const handleExportPdf = async (id: number) => {
    setExportingId(id);
    try {
      const url = await exportResumePdf(id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('PDF 导出成功');
    } catch (e: any) {
      showToast(e?.message || '导出失败', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const handleViewDetail = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setResumeDetail(null);
      setEditMode(false);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    setEditMode(false);
    try {
      const res = await getResume(id);
      setResumeDetail(res.data);
    } catch {
      showToast('加载详情失败', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStartEdit = (initialHtml?: string) => {
    setEditedHtml(initialHtml || resumeDetail?.htmlContent || '');
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedHtml('');
  };

  const handleSaveEdit = async () => {
    if (!expandedId) return;
    setSaving(true);
    try {
      await updateResume(expandedId, { htmlContent: editedHtml });
      setResumeDetail({ ...resumeDetail, htmlContent: editedHtml });
      setEditMode(false);
      showToast('保存成功');
    } catch (e: any) {
      showToast(e?.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openBranch = async (baseId: number) => {
    setBranchBaseId(baseId);
    setBranchJobId(null);
    setBranchModal(true);
    try {
      const res = await getJobs({ pageSize: 50 });
      setJobs(res.data || []);
    } catch {}
  };

  const handleBranch = async () => {
    if (!branchBaseId || !branchJobId) return;
    try {
      await branchResume(branchBaseId, branchJobId);
      showToast('版本创建成功');
      setBranchModal(false);
      fetchResumes();
    } catch (e: any) {
      showToast(e?.message || '创建失败', 'error');
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-canvas">
            <div className="hd-loading">
              <IconDocument size={32} />
              <div style={{ marginTop: 8 }}>正在加载简历...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-canvas">
            <div className="hd-empty">
              <div style={{ marginBottom: 12 }}>{error}</div>
              <button className="hd-btn small" onClick={fetchResumes}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconRefresh size={16} /> 重试
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        {/* Header */}
        <div className="hd-header">
          <h1>简历管理</h1>
          <button
            className="hd-btn"
            disabled={generating}
            onClick={() => handleGenerate()}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IconPlus size={18} />
              {generating ? '生成中...' : '生成通用简历'}
            </span>
          </button>
        </div>

        {/* Resume list */}
        {resumes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {resumes.map((resume) => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                exporting={exportingId === resume.id}
                deleting={deleteConfirmId === resume.id}
                onDelete={() => setDeleteConfirmId(resume.id)}
                onDeleteConfirm={() => handleDelete(resume.id)}
                onDeleteCancel={() => setDeleteConfirmId(null)}
                onBranch={() => openBranch(resume.id)}
                onExportPdf={() => handleExportPdf(resume.id)}
                onViewDetail={() => handleViewDetail(resume.id)}
                isExpanded={expandedId === resume.id}
                detailLoading={detailLoading && expandedId === resume.id}
                resumeDetail={expandedId === resume.id ? resumeDetail : null}
                editMode={editMode}
                editedHtml={editedHtml}
                saving={saving}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={handleSaveEdit}
                onEditHtmlChange={setEditedHtml}
              />
            ))}
          </div>
        ) : (
          <div className="hd-canvas">
            <div className="hd-empty">
              <IconDocument size={48} />
              <div style={{ marginTop: 12, marginBottom: 16 }}>还没有简历</div>
              <button className="hd-btn" disabled={generating} onClick={() => handleGenerate()}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <IconPlus size={18} />
                  {generating ? '生成中...' : '生成第一份简历'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Branch modal */}
        {branchModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(43,38,32,0.3)' }} onClick={() => setBranchModal(false)} />
            <div className="hd-canvas" style={{ position: 'relative', zIndex: 1, width: 440, maxWidth: '90vw' }}>
              <div className="hd-flex-between" style={{ marginBottom: 16 }}>
                <h3 style={{ font: '800 22px/1 var(--serif)', margin: 0 }}>创建岗位版本</h3>
                <button onClick={() => setBranchModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pencil)' }}>
                  <IconX size={20} />
                </button>
              </div>
              <p style={{ font: '15px/1.4 var(--hand)', color: 'var(--pencil)', marginBottom: 16 }}>
                选择目标岗位，系统会根据岗位要求优化简历内容。
              </p>
              <select
                className="hd-select"
                value={branchJobId ?? ''}
                onChange={(e) => setBranchJobId(Number(e.target.value) || null)}
              >
                <option value="">选择目标岗位</option>
                {jobs.map((j: any) => (
                  <option key={j.id} value={j.id}>{j.title} - {j.company || '未知公司'}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="hd-btn small" disabled={!branchJobId} onClick={handleBranch}>创建</button>
                <button className="hd-btn small secondary" onClick={() => setBranchModal(false)}>取消</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Resume card */
function ResumeCard({
  resume,
  exporting,
  deleting,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
  onBranch,
  onExportPdf,
  onViewDetail,
  isExpanded,
  detailLoading,
  resumeDetail,
  editMode,
  editedHtml,
  saving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditHtmlChange,
}: {
  resume: any;
  exporting: boolean;
  deleting: boolean;
  onDelete: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onBranch: () => void;
  onExportPdf: () => void;
  onViewDetail: () => void;
  isExpanded: boolean;
  detailLoading: boolean;
  resumeDetail: any;
  editMode: boolean;
  editedHtml: string;
  saving: boolean;
  onStartEdit: (initialHtml?: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditHtmlChange: (v: string) => void;
}) {
  const isBase = resume.isBase === 1;
  const hasJob = !!resume.targetJobId;
  const skills: any[] = resume.content?.skills || [];
  const advice = resume.content?.resumeAdvice || null;
  const storedHtml = resumeDetail?.htmlContent ?? resume.htmlContent;
  const recoveredPreview = !isUsableResumeHtml(storedHtml);
  const displayHtml = recoveredPreview
    ? buildRecoveredResumeHtml(resumeDetail?.content || resume.content)
    : storedHtml;

  return (
    <div className="hd-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="hd-flex-between resume-card-header">
        <div className="hd-flex" style={{ gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            border: '2px solid var(--pencil)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--paper-tint)',
          }}>
            <IconDocument size={22} />
          </div>
          <div>
            <div className="hd-flex" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ font: '700 17px/1 var(--hand-bold)', color: 'var(--ink)' }}>
                {resume.versionName || `v${resume.version}`}
              </span>
              {isBase && <span className="hd-badge accent">基础版</span>}
              {hasJob && <span className="hd-badge green">岗位版</span>}
            </div>
            <div style={{ font: '14px/1.3 var(--hand)', color: 'var(--pencil)' }}>
              {resume.content?.personalInfo?.name || '未填写姓名'}
              {resume.content?.personalInfo?.school && ` · ${resume.content.personalInfo.school}`}
            </div>
          </div>
        </div>

        <div className="hd-flex resume-card-actions" style={{ gap: 6 }}>
          <button className="hd-btn small secondary" onClick={onViewDetail} title={isExpanded ? '收起详情' : '查看详情'}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconDocument size={15} />
              {isExpanded ? '收起' : '预览'}
            </span>
          </button>
          <button className="hd-btn small highlight" onClick={onExportPdf} disabled={exporting} title="导出 PDF">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconDownload size={15} />
              {exporting ? '导出中...' : '导出 PDF'}
            </span>
          </button>
          <button className="hd-btn small secondary" onClick={onBranch} title="创建岗位版本">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconPlus size={15} /> 分支
            </span>
          </button>
          {deleting ? (
            <span className="hd-flex" style={{ gap: 4 }}>
              <button className="hd-btn small" onClick={onDeleteConfirm} style={{ background: 'var(--accent)', padding: '8px 10px' }}>
                <IconCheck size={15} />
              </button>
              <button className="hd-btn small secondary" onClick={onDeleteCancel} style={{ padding: '8px 10px' }}>
                <IconX size={15} />
              </button>
            </span>
          ) : (
            <button className="hd-btn small secondary" onClick={onDelete} title="删除" style={{ color: 'var(--accent)' }}>
              <IconTrash size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {skills.slice(0, 6).map((s: any, i: number) => (
            <span key={i} className="hd-tag">{s.name}</span>
          ))}
          {skills.length > 6 && <span className="hd-tag">+{skills.length - 6}</span>}
        </div>
      )}

      {/* Review comment */}
      {resume.reviewComment && (
        <div className="hd-dashed" style={{ fontSize: 13, color: 'var(--accent)' }}>
          审核意见：{resume.reviewComment}
        </div>
      )}

      {advice && (
        <div className="hd-dashed" style={{ fontSize: 13, color: 'var(--ink)', background: 'var(--paper-tint)' }}>
          <div style={{ font: '700 14px/1.3 var(--hand-bold)', marginBottom: 8, color: 'var(--accent)' }}>
            简历建议{advice.target?.title ? ` · ${advice.target.title}` : ''}
          </div>
          {advice.matchedSkills?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {advice.matchedSkills.slice(0, 5).map((skill: any) => (
                <span key={skill.name} className="hd-badge green">
                  命中 {skill.name}{skill.masteryPct ? ` ${skill.masteryPct}%` : ''}
                </span>
              ))}
            </div>
          )}
          {advice.missingSkills?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {advice.missingSkills.slice(0, 5).map((skill: string) => (
                <span key={skill} className="hd-badge red">待补 {skill}</span>
              ))}
            </div>
          )}
          {advice.actionItems?.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              {advice.actionItems.slice(0, 3).map((item: string, index: number) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
          {/* P1-2 evidence-aware 岗位化表达建议 */}
          {advice.expressions?.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--rule)' }}>
              <div style={{ font: '700 13px/1.3 var(--hand-bold)', marginBottom: 8, color: 'var(--ink)' }}>
                岗位化表达建议（引用学习证据）
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {advice.expressions.map((expr: any) => {
                  const confColor =
                    expr.confidence === 'high' ? '#3a7d3a'
                    : expr.confidence === 'medium' ? '#e65100' : 'var(--accent)';
                  const confLabel =
                    expr.confidence === 'high' ? '证据充分'
                    : expr.confidence === 'medium' ? '证据一般' : '证据不足';
                  return (
                    <div key={expr.id} style={{ fontSize: 13, lineHeight: 1.5 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="hd-pill" style={{ fontSize: 10, background: '#e8f5e9', color: confColor, flexShrink: 0 }}>
                          {confLabel}
                        </span>
                        {expr.skills?.map((s: string) => (
                          <span key={s} className="hd-tag" style={{ fontSize: 11 }}>{s}</span>
                        ))}
                        {expr.evidence?.type && expr.evidence.type !== 'none' && (
                          <span className="hd-badge" style={{ fontSize: 11, color: 'var(--pencil)' }}>
                            {expr.evidence.type === 'evaluation' ? '测评' : expr.evidence.type === 'project' ? '项目' : '学习'}
                            {expr.evidence.detail ? `：${expr.evidence.detail}` : ''}
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: 3 }}>{expr.advice}</div>
                      {expr.warning && (
                        <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
                          ⚠ {expr.warning}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Detail / Preview Panel ── */}
      {isExpanded && (
        <div className="hd-dashed" style={{ padding: 12, marginTop: 4 }}>
          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--pencil)' }}>加载中...</div>
          ) : editMode ? (
            /* ── Edit Mode ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="hd-flex-between">
                <span style={{ font: '700 14px/1 var(--hand-bold)', color: 'var(--accent)' }}>
                  <IconEdit size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                  编辑 HTML
                </span>
                <div className="hd-flex" style={{ gap: 6 }}>
                  <button className="hd-btn small" onClick={onSaveEdit} disabled={saving}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconCheck size={14} />
                      {saving ? '保存中...' : '保存'}
                    </span>
                  </button>
                  <button className="hd-btn small secondary" onClick={onCancelEdit}>取消</button>
                </div>
              </div>
              <textarea
                value={editedHtml}
                onChange={(e) => onEditHtmlChange(e.target.value)}
                style={{
                  width: '100%', minHeight: 360,
                  font: '13px/1.5 var(--mono)',
                  border: '2px solid var(--pencil)',
                  borderRadius: 8,
                  padding: 12,
                  resize: 'vertical',
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                }}
              />
            </div>
          ) : (
            /* ── Preview Mode ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="hd-flex-between">
                <span style={{ font: '700 14px/1 var(--hand-bold)', color: 'var(--pencil)' }}>
                  <IconDocument size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                  简历预览
                </span>
                <button className="hd-btn small secondary" onClick={() => onStartEdit(displayHtml)} disabled={!displayHtml}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <IconEdit size={14} /> 编辑
                  </span>
                </button>
              </div>
              {displayHtml ? (
                <>
                  {recoveredPreview && (
                    <div style={{ padding: '9px 12px', borderRadius: 6, background: '#f5f0e8', color: '#6c6a64', fontSize: 12 }}>
                      原预览文件不完整，已根据简历数据恢复显示。重新生成后将使用新版排版。
                    </div>
                  )}
                  <iframe
                    srcDoc={displayHtml}
                    sandbox=""
                    style={{
                      width: '100%', height: 'min(76vh, 900px)', minHeight: 560,
                      border: '2px solid var(--rule)',
                      borderRadius: 8,
                      background: '#fff',
                    }}
                    title="简历预览"
                  />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--pencil)' }}>
                  暂无简历内容，请先生成简历
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
