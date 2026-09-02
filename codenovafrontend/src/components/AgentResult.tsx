import { BookOpen, CheckCircle2, Lightbulb, ListChecks } from 'lucide-react';
import { Markdown } from './Markdown';
import { Bar, Tag } from './ui';

/**
 * Agent 任务结果的结构化展示 —— 替代"把 JSON 直接怼给用户"。
 *
 * 每种 agentType 有对应的友好渲染（评估分维度条、讲义 Markdown、阅读清单、代码卡片），
 * 无法识别的结构会先尝试提取 summary/content 等常见文本字段，
 * 最后才折叠展示原始 JSON 并明确标注为开发视图 —— 中间数据可追溯，但不吓唬用户。
 */

const LEVEL_TONE: Record<string, 'green' | 'amber' | 'rose' | 'violet'> = {
  优秀: 'green',
  良好: 'green',
  合格: 'green',
  需努力: 'amber',
  薄弱: 'rose',
  进阶: 'violet',
};

function ParamsList({ params }: { params: Record<string, any> }) {
  const entries = Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return <p className="small muted">（无参数）</p>;
  return (
    <div className="col" style={{ gap: 6 }}>
      {entries.map(([key, value]) => (
        <div className="row" key={key} style={{ gap: 8 }}>
          <span className="tiny faint" style={{ width: 88, flexShrink: 0 }}>{key}</span>
          <span className="small" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function AssessResult({ result }: { result: any }) {
  const dimensions = Array.isArray(result.dimensions) ? result.dimensions : [];
  const weakPoints: string[] = Array.isArray(result.weakPoints)
    ? result.weakPoints.map((item: any) => (typeof item === 'string' ? item : item?.point || item?.skill || '')).filter(Boolean)
    : [];
  const improvements: string[] = Array.isArray(result.improvements)
    ? result.improvements.map((item: any) => (typeof item === 'string' ? item : item?.action || item?.suggestion || '')).filter(Boolean)
    : [];
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {result.level && <Tag tone={LEVEL_TONE[result.level] || 'amber'}>综合评级：{result.level}</Tag>}
      </div>
      {result.summary && <p className="small" style={{ lineHeight: 1.7 }}>{result.summary}</p>}
      {dimensions.length > 0 && (
        <div className="col" style={{ gap: 8 }}>
          {dimensions.map((dim: any, index: number) => {
            const score = Number(dim.score ?? 0);
            const max = Number(dim.maxScore ?? 100) || 100;
            const pct = Math.round((score / max) * 100);
            return (
              <div className="col" key={dim.dimension || index} style={{ gap: 3 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="small grow" style={{ fontWeight: 600 }}>{dim.dimension || `维度 ${index + 1}`}</span>
                  {dim.trend && dim.trend !== 'stable' && (
                    <span className="tiny faint">{dim.trend === 'up' ? '↑ 上升' : dim.trend === 'down' ? '↓ 下降' : dim.trend}</span>
                  )}
                  <span className="small" style={{ fontWeight: 700, color: pct >= 60 ? 'var(--green-600)' : 'var(--amber-600)' }}>{score}/{max}</span>
                </div>
                <Bar value={pct} tone={pct >= 60 ? 'green' : 'amber'} />
                {dim.detail && <p className="tiny muted" style={{ lineHeight: 1.6 }}>{dim.detail}</p>}
              </div>
            );
          })}
        </div>
      )}
      {weakPoints.length > 0 && (
        <div className="col" style={{ gap: 5 }}>
          <span className="tiny" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ListChecks size={12} /> 薄弱点
          </span>
          <div className="row wrap" style={{ gap: 6 }}>
            {weakPoints.map((point) => <Tag key={point} tone="amber">{point}</Tag>)}
          </div>
        </div>
      )}
      {improvements.length > 0 && (
        <div className="col" style={{ gap: 5 }}>
          <span className="tiny" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Lightbulb size={12} /> 提升建议
          </span>
          {improvements.map((item, index) => (
            <p className="small muted" key={index} style={{ lineHeight: 1.6, paddingLeft: 2, borderLeft: '3px solid var(--brand-100, #e7e8fd)' }}>{item}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function LectureResult({ result }: { result: any }) {
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {result.level && <Tag tone="brand">{result.level}</Tag>}
        {result.estimatedTime && <span className="tiny faint">预计 {result.estimatedTime}</span>}
        {result.wordCount ? <span className="tiny faint">{result.wordCount} 字</span> : null}
      </div>
      {result.keyPoints?.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {result.keyPoints.slice(0, 5).map((point: string) => (
            <Tag key={point} tone="teal" icon={<CheckCircle2 size={10} />}>{point}</Tag>
          ))}
        </div>
      )}
      {result.content && <Markdown source={result.content} />}
      {Array.isArray(result.exercises) && result.exercises.length > 0 && (
        <div className="col" style={{ gap: 6 }}>
          <span className="tiny" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <BookOpen size={12} /> 配套练习
          </span>
          {result.exercises.map((exercise: any, index: number) => (
            <p className="small muted" key={index} style={{ lineHeight: 1.6 }}>
              {typeof exercise === 'string' ? exercise : exercise?.question || exercise?.title || JSON.stringify(exercise)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadingResult({ result }: { result: any }) {
  const items = Array.isArray(result.items) ? result.items : [];
  return (
    <div className="col" style={{ gap: 10 }}>
      {result.studyAdvice && (
        <p className="small" style={{ lineHeight: 1.7, padding: '8px 12px', background: 'var(--bg-sunken)', borderRadius: 8 }}>
          <strong>阅读建议：</strong>{result.studyAdvice}
        </p>
      )}
      {items.map((item: any, index: number) => (
        <div key={index} className="col" style={{ gap: 4, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="small" style={{ fontWeight: 600 }}>{item?.title || `材料 ${index + 1}`}</span>
            {item?.type && <Tag tone="neutral">{item.type}</Tag>}
          </div>
          {(item?.summary || item?.why) && (
            <p className="tiny muted" style={{ lineHeight: 1.6 }}>{item.summary || item.why}</p>
          )}
          {item?.url && (
            <a className="tiny" href={item.url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-600)' }}>{item.url}</a>
          )}
        </div>
      ))}
      {!items.length && <p className="small muted">（没有返回阅读材料）</p>}
    </div>
  );
}

function CodeResult({ result }: { result: any }) {
  const examples = Array.isArray(result.examples) ? result.examples : [];
  return (
    <div className="col" style={{ gap: 10 }}>
      {result.language && <Tag tone="teal">{result.language}</Tag>}
      {examples.map((example: any, index: number) => (
        <div key={index} className="col" style={{ gap: 6, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
          <span className="small" style={{ fontWeight: 600 }}>{example?.title || `案例 ${index + 1}`}</span>
          {example?.description && <p className="tiny muted" style={{ lineHeight: 1.6 }}>{example.description}</p>}
          {example?.code && (
            <pre style={{ margin: 0, padding: '8px 10px', background: 'var(--bg-sunken)', borderRadius: 8, overflow: 'auto', fontSize: 12, lineHeight: 1.6 }}>
              <code>{example.code}</code>
            </pre>
          )}
          {Array.isArray(example?.keyPoints) && example.keyPoints.length > 0 && (
            <div className="row wrap" style={{ gap: 6 }}>
              {example.keyPoints.map((point: string) => <Tag key={point} tone="neutral">{point}</Tag>)}
            </div>
          )}
        </div>
      ))}
      {Array.isArray(result.bestPractices) && result.bestPractices.length > 0 && (
        <div className="col" style={{ gap: 4 }}>
          <span className="tiny" style={{ fontWeight: 700 }}>最佳实践</span>
          {result.bestPractices.map((practice: string, index: number) => (
            <p className="tiny muted" key={index} style={{ lineHeight: 1.6 }}>· {practice}</p>
          ))}
        </div>
      )}
      {!examples.length && <p className="small muted">（没有返回代码案例）</p>}
    </div>
  );
}

/** 兜底：优先提取常见文本字段，实在不行折叠展示原始 JSON */
function GenericResult({ result }: { result: any }) {
  const text = [result?.summary, result?.content, result?.text, result?.message].find(
    (value) => typeof value === 'string' && value.trim(),
  );
  if (text) return <Markdown source={text} />;
  return (
    <details>
      <summary className="tiny muted" style={{ cursor: 'pointer' }}>展开原始数据（开发调试视图）</summary>
      <pre className="tiny muted" style={{ margin: '8px 0 0', padding: '8px 10px', background: 'var(--bg-sunken)', borderRadius: 8, overflow: 'auto', maxHeight: 260, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
        {JSON.stringify(result, null, 2).slice(0, 4000)}
      </pre>
    </details>
  );
}

export function AgentResultView({ agentType, result }: { agentType: string; result: any }) {
  if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
    return <p className="small muted">（暂无结构化产出）</p>;
  }
  switch (String(agentType || '').toLowerCase()) {
    case 'assess':
      return <AssessResult result={result} />;
    case 'lecture':
      return <LectureResult result={result} />;
    case 'reading':
      return <ReadingResult result={result} />;
    case 'code':
      return <CodeResult result={result} />;
    default:
      return <GenericResult result={result} />;
  }
}

export { ParamsList as AgentParamsView };
