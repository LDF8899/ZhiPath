import { useCallback, useEffect, useState } from 'react';
import { getEmploymentDashboard, exportEmploymentCsv } from '../../api/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { IconRefresh, IconDownload, IconBriefcase, IconGradCap, IconTarget, IconCheck } from '../../components/icons';
import '../../styles/hand-draw.css';

interface Filters {
  major?: string;
  grade?: string;
  school?: string;
  class?: string;
}

function pctBar(pct: number, color = 'var(--accent)') {
  return (
    <div className="hd-progress" style={{ height: 8, flex: 1 }}>
      <div className="hd-progress-bar" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

/**
 * 就业准备度看板 — P2-1（学院/就业办）
 *
 * 展示：学生目标岗位分布、技能缺口 Top 10、学习任务完成率、测评达标率、
 * 求职准备度分层；支持按专业/年级/学校/班级筛选与 CSV 导出。
 */
export default function AdminEmployment() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async (next?: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEmploymentDashboard(next || filters);
      setData(res.data);
    } catch (e: any) {
      setError(e?.message || '看板加载失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportEmploymentCsv(filters);
      const blob = res instanceof Blob ? res : new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `就业准备度明细-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`导出失败：${e?.message || '未知错误'}`);
    } finally {
      setExporting(false);
    }
  };

  const ov = data?.overview || null;
  const filtersMeta = data?.filters || { majors: [], grades: [], schools: [], classes: [] };

  return (
    <div className="hd-canvas">
      <AdminPageHeader
        title="就业准备度看板"
        subtitle="学生目标岗位分布 · 技能缺口 · 任务与测评达标 · 求职准备度分层"
        actions={
          <>
            <button className="hd-btn small secondary" onClick={() => { setFilters({}); }}>
              <IconRefresh size={13} style={{ marginRight: 5 }} />
              重置
            </button>
            <button className="hd-btn small highlight" onClick={handleExport} disabled={exporting || !data}>
              <IconDownload size={13} style={{ marginRight: 5 }} />
              {exporting ? '导出中…' : '导出 CSV'}
            </button>
          </>
        }
      />

      {/* ── 筛选器 ── */}
      <div className="hd-card" style={{ marginBottom: 14, padding: 12 }}>
        <div className="hd-flex" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ font: '13px/1 var(--hand)', color: 'var(--pencil)' }}>筛选：</span>
          {[
            { key: 'school' as const, label: '学校', options: filtersMeta.schools },
            { key: 'major' as const, label: '专业', options: filtersMeta.majors },
            { key: 'grade' as const, label: '年级', options: filtersMeta.grades },
            { key: 'class' as const, label: '班级', options: filtersMeta.classes },
          ].map((f) => (
            <select
              key={f.key}
              value={filters[f.key] || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value || undefined }))}
              style={{ font: '12px/1 var(--hand)', padding: '6px 8px', border: '1.5px solid var(--rule)', borderRadius: 6, background: 'var(--paper)' }}
            >
              <option value="">全部{f.label}</option>
              {f.options.map((o: string) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ))}
          <button className="hd-btn small" onClick={() => fetchData()} disabled={loading}>
            应用筛选
          </button>
        </div>
      </div>

      {error && (
        <div className="hd-dashed" style={{ color: 'var(--accent)', marginBottom: 12 }}>{error}</div>
      )}

      {loading ? (
        <div className="hd-empty" style={{ padding: 48 }}>加载中…</div>
      ) : ov ? (
        <>
          {/* ── 概览 ── */}
          <div className="hd-grid-4" style={{ gap: 12, marginBottom: 14 }}>
            <div className="hd-card-accent" style={{ padding: 14 }}>
              <div className="hd-section-label" style={{ marginBottom: 8 }}>
                <IconBriefcase size={15} />
                学生总数
              </div>
              <div style={{ font: '800 28px/1 var(--serif)' }}>{ov.studentCount}</div>
              <div style={{ font: '12px/1.4 var(--hand)', color: 'var(--pencil)', marginTop: 4 }}>
                {ov.withTargetJob} 人已绑定目标岗位（{ov.targetJobRate}%）
              </div>
            </div>
            <div className="hd-card-accent" style={{ padding: 14 }}>
              <div className="hd-section-label" style={{ marginBottom: 8 }}>
                <IconTarget size={15} />
                学习任务完成率
              </div>
              <div style={{ font: '800 28px/1 var(--serif)' }}>{data.taskCompletion?.rate ?? 0}%</div>
              <div style={{ marginTop: 8 }}>{pctBar(data.taskCompletion?.rate ?? 0, '#3a7d3a')}</div>
              <div style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', marginTop: 4 }}>
                {data.taskCompletion?.done ?? 0}/{data.taskCompletion?.total ?? 0} 个任务
              </div>
            </div>
            <div className="hd-card-accent" style={{ padding: 14 }}>
              <div className="hd-section-label" style={{ marginBottom: 8 }}>
                <IconGradCap size={15} />
                测评达标率
              </div>
              <div style={{ font: '800 28px/1 var(--serif)' }}>{data.examPass?.rate ?? 0}%</div>
              <div style={{ marginTop: 8 }}>{pctBar(data.examPass?.rate ?? 0, 'var(--data-blue, #2f6fed)')}</div>
              <div style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', marginTop: 4 }}>
                {data.examPass?.passed ?? 0}/{data.examPass?.total ?? 0} 次测评
              </div>
            </div>
            <div className="hd-card-accent" style={{ padding: 14 }}>
              <div className="hd-section-label" style={{ marginBottom: 8 }}>
                <IconCheck size={15} />
                求职准备度分层
              </div>
              {[
                { label: '高（≥80）', value: ov.readiness?.high ?? 0, color: '#3a7d3a' },
                { label: '中（60-79）', value: ov.readiness?.medium ?? 0, color: '#e65100' },
                { label: '低（<60）', value: ov.readiness?.low ?? 0, color: 'var(--accent)' },
              ].map((r) => (
                <div key={r.label} className="hd-flex" style={{ gap: 8, alignItems: 'center', marginTop: 5 }}>
                  <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', width: 66, flexShrink: 0 }}>{r.label}</span>
                  {pctBar(ov.readinessTotal ? Math.round(r.value / ov.readinessTotal * 100) : 0, r.color)}
                  <span style={{ font: '12px/1 var(--serif)', fontWeight: 700, width: 26, textAlign: 'right' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hd-grid-2" style={{ gap: 12 }}>
            {/* ── 目标岗位分布 ── */}
            <div className="hd-card" style={{ padding: 14 }}>
              <div className="hd-section-label" style={{ marginBottom: 10 }}>
                <IconBriefcase size={16} />
                <h3 style={{ fontSize: 16 }}>学生目标岗位分布</h3>
              </div>
              {data.targetJobDistribution?.length > 0 ? (
                <div className="hd-flex-col" style={{ gap: 8 }}>
                  {data.targetJobDistribution.slice(0, 8).map((d: any) => (
                    <div key={d.jobId} className="hd-flex" style={{ gap: 8, alignItems: 'center' }}>
                      <span style={{ font: '13px/1 var(--hand)', width: 160, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.jobTitle}
                      </span>
                      {pctBar(d.pct)}
                      <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)', width: 70, textAlign: 'right', flexShrink: 0 }}>
                        {d.count} 人 · {d.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hd-empty" style={{ padding: 20 }}>暂无目标岗位数据</div>
              )}
            </div>

            {/* ── 技能缺口 Top 10 ── */}
            <div className="hd-card" style={{ padding: 14 }}>
              <div className="hd-section-label" style={{ marginBottom: 10 }}>
                <IconTarget size={16} />
                <h3 style={{ fontSize: 16 }}>技能缺口 Top 10</h3>
                <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)' }}>掌握度 &lt; 60%</span>
              </div>
              {data.skillGaps?.length > 0 ? (
                <div className="hd-flex-col" style={{ gap: 8 }}>
                  {data.skillGaps.map((g: any, i: number) => (
                    <div key={g.skill} className="hd-flex" style={{ gap: 8, alignItems: 'center' }}>
                      <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)', width: 20, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ font: '13px/1 var(--hand)', width: 150, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.skill}
                      </span>
                      {pctBar(Math.min(100, g.studentCount / Math.max(1, ov.studentCount) * 100), 'var(--accent)')}
                      <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)', width: 90, textAlign: 'right', flexShrink: 0 }}>
                        {g.studentCount} 人 · 均 {g.avgMastery}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hd-empty" style={{ padding: 20 }}>暂无技能缺口数据</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
