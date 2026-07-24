import { useEffect, useMemo, useState } from 'react';
import {
  compareGitBranches,
  compareGitSnapshots,
  createGitBranch,
  getEvaluations,
  getGitBranchLog,
  getGitBranches,
  getGitCommit,
  getGitSnapshots,
  mergeGitBranch,
  rollbackGitCommit,
} from '../../api/user';
import RadarChart from '../../components/RadarChart';
import { useSSE } from '../../hooks/useSSE';
import type { CommitDelta, EvaluationListItem, LearningBranch, LearningCommit, RadarComparison, SkillSnapshot } from '../../types';
import '../../styles/hand-draw.css';

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<LearningBranch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [commits, setCommits] = useState<LearningCommit[]>([]);
  const [snapshots, setSnapshots] = useState<SkillSnapshot[]>([]);
  const [selectedCommitId, setSelectedCommitId] = useState<number | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SkillSnapshot | null>(null);
  const [compareA, setCompareA] = useState<number | ''>('');
  const [compareB, setCompareB] = useState<number | ''>('');
  const [snapshotCompare, setSnapshotCompare] = useState<RadarComparison | null>(null);
  const [branchCompareTarget, setBranchCompareTarget] = useState<number | ''>('');
  const [branchCompare, setBranchCompare] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<EvaluationListItem[]>([]);
  const [branchName, setBranchName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { latestEvent } = useSSE();

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0] || null;
  const latestSnapshot = selectedSnapshot || snapshots[0] || null;
  const ability = latestSnapshot?.abilityMetricsJson || null;
  const radar = latestSnapshot?.radarJson || [];

  const load = async (preferredBranchId?: number | null) => {
    setError(null);
    try {
      const branchRes = await getGitBranches();
      const nextBranches = branchRes.data || [];
      const nextActive = preferredBranchId || activeBranchId || nextBranches.find((b) => b.branchType === 'main')?.id || nextBranches[0]?.id || null;
      setBranches(nextBranches);
      setActiveBranchId(nextActive);
      if (nextActive) {
        const [logRes, snapshotRes, evaluationRes] = await Promise.all([
          getGitBranchLog(nextActive, 80),
          getGitSnapshots({ branchId: nextActive, limit: 80 }),
          getEvaluations(20),
        ]);
        setCommits(logRes.data || []);
        setSnapshots(snapshotRes.data || []);
        setEvaluations(evaluationRes.data || []);
        setSelectedSnapshot(null);
      }
    } catch (err: any) {
      setError(err?.message || '加载 Git 学习数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!latestEvent) return;
    if (['commit_created', 'radar_updated', 'branch_updated', 'match_updated', 'evaluation_updated'].includes(latestEvent.type)) {
      load(activeBranchId);
    }
  }, [latestEvent?.timestamp]);

  const selectedCommit = commits.find((c) => c.id === selectedCommitId) || null;

  const commitOptions = useMemo(() => commits.filter((c) => c.snapshotId), [commits]);

  const handleSelectCommit = async (commitId: number) => {
    setSelectedCommitId(commitId);
    const res = await getGitCommit(commitId);
    setSelectedSnapshot(res.data.snapshot);
  };

  const handleCreateBranch = async (type: 'side' | 'experiment') => {
    setBusy('branch');
    try {
      const res = await createGitBranch({
        branchName: branchName.trim() || `${type}-${new Date().toISOString().slice(5, 10)}`,
        branchType: type,
        sourceBranchId: activeBranch?.id,
      });
      setBranchName('');
      await load(res.data.id);
    } finally {
      setBusy(null);
    }
  };

  const handleCompareSnapshots = async () => {
    if (!compareA || !compareB) return;
    setBusy('snapshot-compare');
    try {
      const res = await compareGitSnapshots(Number(compareA), Number(compareB));
      setSnapshotCompare(res.data);
    } finally {
      setBusy(null);
    }
  };

  const handleCompareBranches = async () => {
    if (!activeBranch || !branchCompareTarget) return;
    setBusy('branch-compare');
    try {
      const res = await compareGitBranches(activeBranch.id, Number(branchCompareTarget));
      setBranchCompare(res.data);
    } finally {
      setBusy(null);
    }
  };

  const handleMerge = async (branch: LearningBranch) => {
    if (!window.confirm(`Merge ${branch.branchName} into main?`)) return;
    setBusy(`merge-${branch.id}`);
    try {
      await mergeGitBranch(branch.id);
      await load(activeBranchId);
    } finally {
      setBusy(null);
    }
  };

  const handleRollback = async (commit: LearningCommit) => {
    if (!window.confirm(`Rollback branch head to commit #${commit.id}?`)) return;
    setBusy(`rollback-${commit.id}`);
    try {
      await rollbackGitCommit(commit.id);
      await load(activeBranchId);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="hd-page"><div className="hd-page-wrap"><div className="hd-loading">Loading...</div></div></div>
    );
  }

  if (error) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-empty">
            <p>{error}</p>
            <button className="hd-btn small" onClick={() => load(activeBranchId)}>重试</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        <div className="hd-header">
          <div>
            <h1>Git 学习系统</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--pencil)', font: '14px/1.4 var(--hand)' }}>
              {activeBranch ? `${activeBranch.branchName} / head #${activeBranch.headCommitId || '-'}` : 'main branch initializing'}
            </p>
          </div>
          <button className="hd-btn small secondary" onClick={() => load(activeBranchId)}>刷新</button>
        </div>

        <div className="hd-grid-2" style={{ alignItems: 'start', gap: 18 }}>
          <div className="hd-flex-col" style={{ gap: 14 }}>
            <section className="hd-card-accent">
              <div className="hd-section-label"><h3>分支</h3></div>
              <div className="hd-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    className={`hd-tab${branch.id === activeBranchId ? ' active' : ''}`}
                    onClick={() => load(branch.id)}
                  >
                    {branch.branchName} · {branch.branchType}
                  </button>
                ))}
              </div>
              <div className="hd-flex" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <input
                  className="hd-input"
                  style={{ maxWidth: 220 }}
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="branch name"
                />
                <button className="hd-btn small" disabled={busy === 'branch'} onClick={() => handleCreateBranch('side')}>创建 side</button>
                <button className="hd-btn small secondary" disabled={busy === 'branch'} onClick={() => handleCreateBranch('experiment')}>创建 experiment</button>
              </div>
            </section>

            <section className="hd-card-accent">
              <div className="hd-section-label"><h3>Commit 时间轴</h3></div>
              {commits.length === 0 ? (
                <div className="hd-empty">暂无 commit</div>
              ) : (
                <div className="hd-flex-col" style={{ gap: 10 }}>
                  {commits.map((commit) => (
                    <article
                      key={commit.id}
                      className="hd-card"
                      style={{ borderColor: commit.id === selectedCommitId ? 'var(--accent)' : undefined }}
                    >
                      <div className="hd-flex-between" style={{ gap: 10 }}>
                        <button
                          className="hd-tab"
                          onClick={() => handleSelectCommit(commit.id)}
                          title="查看该 commit 的 snapshot"
                        >
                          #{commit.id} {commit.commitType}
                        </button>
                        <div className="hd-flex" style={{ gap: 8 }}>
                          <span className="hd-pill">{formatTime(commit.createTime)}</span>
                          <button className="hd-btn small secondary" disabled={busy === `rollback-${commit.id}`} onClick={() => handleRollback(commit)}>
                            rollback
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, font: '14px/1.4 var(--hand)', color: 'var(--ink)' }}>{commit.message}</div>
                      {commit.deltaJson && <DeltaSummary delta={commit.deltaJson} />}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="hd-flex-col" style={{ gap: 14 }}>
            <section className="hd-card-accent">
              <div className="hd-section-label"><h3>{selectedCommit ? `Snapshot #${selectedCommit.id}` : '当前雷达'}</h3></div>
              {radar.length >= 3 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <RadarChart data={radar.map((d) => ({ name: d.name, score: d.score, trend: d.trend }))} size={240} showTrend animated />
                  </div>
                  {ability && (
                    <div className="hd-grid-2" style={{ gap: 8, marginTop: 10 }}>
                      <Metric label="综合" value={ability.overallScore} />
                      <Metric label="深度" value={ability.depth} />
                      <Metric label="广度" value={ability.breadth} />
                      <Metric label="均衡" value={ability.balance} />
                      <Metric label="速度" value={ability.learningSpeed} />
                      <Metric label="连续性" value={ability.consistency} />
                    </div>
                  )}
                </>
              ) : (
                <div className="hd-empty">等待学习动作生成雷达</div>
              )}
            </section>

            <section className="hd-card-accent">
              <div className="hd-section-label"><h3>最近评价</h3></div>
              {evaluations.length === 0 ? (
                <div className="hd-empty">暂无评价记录</div>
              ) : (
                <div className="hd-flex-col" style={{ gap: 10 }}>
                  {evaluations.slice(0, 6).map((item) => (
                    <article key={item.attempt.id} className="hd-card">
                      <div className="hd-flex-between" style={{ gap: 10 }}>
                        <span className="hd-pill">{labelAttempt(item.attempt.attemptType)}</span>
                        <span className="hd-badge">{Math.round(Number(item.result?.normalizedScore || item.result?.score || 0))}分</span>
                      </div>
                      <div style={{ marginTop: 8, font: '14px/1.4 var(--hand-bold)', color: 'var(--ink)' }}>
                        {item.attempt.skillName || item.result?.skillName || '综合评价'}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 13, color: 'var(--pencil)' }}>
                        {item.result?.summary || '评价结果已沉淀'}
                      </div>
                      <ImpactExplanation item={item} />
                      <div className="hd-flex" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {item.impact?.commitId && <span className="hd-badge">commit #{item.impact.commitId}</span>}
                        <span className="hd-badge">置信度 {Math.round(Number(item.result?.confidence || 0) * 100)}%</span>
                        {Number(item.impact?.matchScoreDelta || 0) !== 0 && (
                          <span className={`hd-badge ${Number(item.impact?.matchScoreDelta || 0) > 0 ? 'green' : 'red'}`}>
                            匹配 {signed(Number(item.impact?.matchScoreDelta || 0))}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="hd-card-accent">
              <div className="hd-section-label"><h3>Commit 对比</h3></div>
              <div className="hd-flex" style={{ gap: 8 }}>
                <CommitSelect value={compareA} commits={commitOptions} onChange={setCompareA} />
                <CommitSelect value={compareB} commits={commitOptions} onChange={setCompareB} />
              </div>
              <button className="hd-btn small" style={{ marginTop: 10 }} disabled={!compareA || !compareB || busy === 'snapshot-compare'} onClick={handleCompareSnapshots}>
                对比
              </button>
              {snapshotCompare && (
                <ComparePanel delta={snapshotCompare.delta} before={snapshotCompare.before} after={snapshotCompare.after} />
              )}
            </section>

            <section className="hd-card-accent">
              <div className="hd-section-label"><h3>Branch 对比 / 合并</h3></div>
              <select className="hd-select" value={branchCompareTarget} onChange={(e) => setBranchCompareTarget(e.target.value ? Number(e.target.value) : '')}>
                <option value="">选择目标分支</option>
                {branches.filter((b) => b.id !== activeBranch?.id).map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                ))}
              </select>
              <button className="hd-btn small" style={{ marginTop: 10 }} disabled={!branchCompareTarget || busy === 'branch-compare'} onClick={handleCompareBranches}>
                对比分支
              </button>
              {branchCompare?.delta && <DeltaSummary delta={branchCompare.delta} />}
              <div className="hd-divider" />
              {branches.filter((b) => b.branchType !== 'main').map((branch) => (
                <button
                  key={branch.id}
                  className="hd-btn small secondary"
                  style={{ marginRight: 8, marginBottom: 8 }}
                  disabled={busy === `merge-${branch.id}` || Boolean(branch.mergedAt)}
                  onClick={() => handleMerge(branch)}
                >
                  {branch.mergedAt ? `${branch.branchName} merged` : `merge ${branch.branchName} to main`}
                </button>
              ))}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function CommitSelect({ value, commits, onChange }: { value: number | ''; commits: LearningCommit[]; onChange: (value: number | '') => void }) {
  return (
    <select className="hd-select" value={value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}>
      <option value="">commit</option>
      {commits.map((commit) => (
        <option key={commit.id} value={commit.snapshotId || ''}>#{commit.id} {commit.commitType}</option>
      ))}
    </select>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="hd-card" style={{ padding: '8px 10px' }}>
      <div style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)' }}>{label}</div>
      <div style={{ font: '700 18px/1.2 var(--serif)', color: 'var(--ink)', marginTop: 3 }}>{Math.round(Number(value) || 0)}</div>
    </div>
  );
}

function DeltaSummary({ delta }: { delta: CommitDelta }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="hd-flex" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="hd-badge">综合 {signed(delta.metricsChange?.overallScore)}</span>
        <span className="hd-badge">匹配 {signed(delta.metricsChange?.matchScore)}</span>
        <span className="hd-badge">深度 {signed(delta.metricsChange?.depthScore)}</span>
        <span className="hd-badge">广度 {signed(delta.metricsChange?.breadthScore)}</span>
      </div>
      {delta.radarChanges?.length > 0 && (
        <div className="hd-flex" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {delta.radarChanges.map((change) => (
            <span key={change.dimension} className={`hd-badge ${change.delta >= 0 ? 'green' : 'red'}`}>
              {change.dimension} {signed(change.delta)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ComparePanel({ delta, before, after }: { delta: CommitDelta; before: SkillSnapshot; after: SkillSnapshot }) {
  return (
    <div style={{ marginTop: 12 }}>
      <RadarChart
        data={after.radarJson.map((d) => ({ name: d.name, score: d.score, trend: d.trend }))}
        compareData={before.radarJson.map((d) => ({ name: d.name, score: d.score, trend: d.trend }))}
        size={220}
        showTrend
      />
      <DeltaSummary delta={delta} />
    </div>
  );
}

function ImpactExplanation({ item }: { item: EvaluationListItem }) {
  const impact = item.impact;
  if (!impact) {
    return (
      <div className="hd-dashed" style={{ marginTop: 8, font: '12px/1.5 var(--hand)', color: 'var(--pencil)' }}>
        本次评价已记录，等待后续学习动作生成能力影响。
      </div>
    );
  }

  const skillChanges = impact.skillChangesJson || [];
  const radarChanges = impact.radarChangesJson || [];
  const skillText = skillChanges.slice(0, 2).map((change) => `${change.name} ${signed(change.delta)}`).join('、');
  const radarText = radarChanges.slice(0, 2).map((change) => `${change.dimension} ${signed(change.delta)}`).join('、');
  const matchDelta = Number(impact.matchScoreDelta || impact.metricsChangeJson?.matchScore || 0);
  const parts = [
    skillText ? `技能变化：${skillText}` : '',
    radarText ? `雷达变化：${radarText}` : '',
    matchDelta ? `岗位匹配 ${signed(matchDelta)}` : '',
  ].filter(Boolean);

  return (
    <div className="hd-dashed" style={{ marginTop: 8, font: '12px/1.5 var(--hand)', color: 'var(--ink)' }}>
      <strong>为什么变化：</strong>
      {parts.length > 0
        ? `${parts.join('；')}。这些变化会进入画像和后续岗位匹配计算。`
        : '本次评价没有显著改变能力分或匹配度，系统仍保留记录用于后续复盘。'}
    </div>
  );
}

function labelAttempt(type: string) {
  const labels: Record<string, string> = {
    progress_read: '讲义',
    progress_quiz: '测验',
    progress_code: '代码',
    skill_complete: '完成',
    quick_test: '快测',
    exam: '考试',
    ai_assessment: 'AI评估',
    chat_resource: '资源',
    manual: '手动',
  };
  return labels[type] || type;
}

function signed(value: number) {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

function formatTime(ts?: number) {
  if (!ts) return '-';
  return new Date(Number(ts)).toLocaleString();
}
