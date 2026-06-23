import { useState, useEffect } from 'react';
import { getResumes, generateResume, deleteResume, branchResume, getJobs, exportResumePdf } from '../../api/user';
import '../../styles/hand-draw.css';
import {
  IconDocument,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconDownload,
  IconCheck,
  IconX,
} from '../../components/icons';

/** Toast helper */
function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `hd-message ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
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
}: {
  resume: any;
  exporting: boolean;
  deleting: boolean;
  onDelete: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onBranch: () => void;
  onExportPdf: () => void;
}) {
  const isBase = resume.isBase === 1;
  const hasJob = !!resume.targetJobId;
  const skills: any[] = resume.content?.skills || [];

  return (
    <div className="hd-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="hd-flex-between">
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

        <div className="hd-flex" style={{ gap: 6 }}>
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
    </div>
  );
}
