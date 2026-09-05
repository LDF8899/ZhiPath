import { useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCcw } from 'lucide-react';
import { Bar, Button, Tag } from './ui';

type RagNodeKind = 'core' | 'source' | 'cluster' | 'chunk';
type RagEdgeType = 'indexes' | 'contains' | 'tagged' | 'retrieved';

type RagGraphNode = {
  id: string;
  kind: RagNodeKind;
  label: string;
  sourceType?: string;
  sourceId?: string;
  chunkId?: number;
  cluster?: string;
  confidence?: number;
  vectorStatus?: string;
  skillTags?: string[];
  score?: number;
  snippet?: string;
};

type RagGraphEdge = {
  from: string;
  to: string;
  type: RagEdgeType;
  strength: number;
};

type RagGraphSnapshot = {
  metrics?: {
    totalChunks?: number;
    indexedChunks?: number;
    failedChunks?: number;
    pendingChunks?: number;
    sourceCount?: number;
    sourceTypeCount?: Record<string, number>;
  };
  nodes?: RagGraphNode[];
  edges?: RagGraphEdge[];
};

type SearchResult = {
  chunkId?: number | string;
  score?: number;
  scoreBreakdown?: Record<string, number>;
  matchedTerms?: string[];
  retrieval?: { mode?: string; vectorHit?: boolean; rank?: number };
};

type PositionedNode = RagGraphNode & { position: [number, number, number] };

const CANVAS_BG = '#eef1f8';
const CORE_COLOR = '#5453ea';
const SOURCE_COLORS: Record<string, string> = {
  file_qa: '#5453ea',
  knowledge_upload: '#6366f1',
  domain_doc: '#5453ea',
  news_article: '#06b6d4',
  project: '#0ea5e9',
  github: '#0ea5e9',
  evaluation: '#10b981',
  exam: '#10b981',
  learning_commit: '#f59e0b',
  agent_output: '#8b5cf6',
  resume: '#ec4899',
};

const SOURCE_TYPE_LABEL: Record<string, string> = {
  file_qa: '权威资料/文件问答',
  knowledge_upload: '上传资料',
  domain_doc: '领域文档',
  news_article: '资讯资料',
  project: '项目实践',
  github: '代码仓库',
  evaluation: '测评证据',
  exam: '考试记录',
  learning_commit: '学习记录',
  agent_output: 'Agent 产物',
  resume: '简历画像',
};

function colorOf(node: RagGraphNode) {
  if (node.vectorStatus === 'failed') return '#ef4444';
  if (node.vectorStatus === 'pending') return '#f59e0b';
  if (node.kind === 'core') return CORE_COLOR;
  if (node.kind === 'cluster') return '#14b8a6';
  return SOURCE_COLORS[node.sourceType || ''] || '#64748b';
}

function shortLabel(label?: string, max = 18) {
  const text = String(label || '证据');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildLayout(nodes: RagGraphNode[]): PositionedNode[] {
  const sources = nodes.filter((node) => node.kind === 'source');
  const clusters = nodes.filter((node) => node.kind === 'cluster');
  const chunks = nodes.filter((node) => node.kind === 'chunk');
  const positioned: PositionedNode[] = [];
  positioned.push(...nodes.filter((node) => node.kind === 'core').map((node) => ({ ...node, position: [0, 0, 0] as [number, number, number] })));

  const sourcePositions = new Map<string, [number, number, number]>();
  const sourceCount = Math.max(1, sources.length);
  sources.forEach((node, index) => {
    const angle = (index / sourceCount) * Math.PI * 2 - Math.PI / 2;
    const radius = 3.3;
    const position: [number, number, number] = [Math.cos(angle) * radius, Math.sin(angle) * 1.25, Math.sin(angle) * radius];
    sourcePositions.set(node.id, position);
    positioned.push({ ...node, position });
  });

  const clusterPositions = new Map<string, [number, number, number]>();
  const clusterCount = Math.max(1, clusters.length);
  clusters.forEach((node, index) => {
    const angle = (index / clusterCount) * Math.PI * 2 - Math.PI / 2;
    const radius = 6.2;
    const layer = index % 2 === 0 ? 1.9 : -1.9;
    const position: [number, number, number] = [Math.cos(angle) * radius, layer, Math.sin(angle) * radius];
    clusterPositions.set(node.label, position);
    positioned.push({ ...node, position });
  });

  const bySource = new Map<string, RagGraphNode[]>();
  chunks.forEach((node) => {
    const key = node.sourceId || node.sourceType || 'unknown';
    bySource.set(key, [...(bySource.get(key) || []), node]);
  });

  chunks.forEach((node, index) => {
    const siblings = bySource.get(node.sourceId || node.sourceType || 'unknown') || [node];
    const siblingIndex = siblings.findIndex((item) => item.id === node.id);
    const sourceNode = sources.find((item) => item.sourceId === node.sourceId && item.sourceType === node.sourceType);
    const sourcePos = sourceNode ? sourcePositions.get(sourceNode.id) : undefined;
    const clusterPos = clusterPositions.get(node.cluster || '');
    const base = sourcePos || clusterPos || [0, 0, 0];
    const angle = (siblingIndex / Math.max(1, siblings.length)) * Math.PI * 2 + index * 0.23;
    const spread = 1.35 + (siblingIndex % 3) * 0.3;
    const position: [number, number, number] = [
      base[0] + Math.cos(angle) * spread,
      base[1] + ((siblingIndex % 5) - 2) * 0.42,
      base[2] + Math.sin(angle) * spread,
    ];
    positioned.push({ ...node, position });
  });

  return positioned;
}

function labelStyle(active: boolean, color: string): React.CSSProperties {
  return {
    whiteSpace: 'nowrap',
    padding: '3px 7px',
    border: `1px solid ${active ? color : 'rgba(148,163,184,.45)'}`,
    borderRadius: 7,
    background: active ? 'rgba(255,255,255,.98)' : 'rgba(255,255,255,.88)',
    color: '#12141f',
    boxShadow: active ? `0 8px 24px ${color}33` : '0 6px 16px rgba(15,23,42,.08)',
    font: '11px/1.35 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    pointerEvents: 'none',
  };
}

function CameraFraming() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(0, size.width < 520 ? 8 : 7, size.width < 520 ? 17 : 14);
    camera.lookAt(0, 0, 0);
    if ('updateProjectionMatrix' in camera) camera.updateProjectionMatrix();
  }, [camera, size.width]);
  return null;
}

function PulseHalo({ color, radius, active }: { color: string; radius: number; active: boolean }) {
  const ref = useMemo(() => ({ current: null as THREE.Mesh | null }), []);
  useFrame(({ clock }) => {
    if (!ref.current || !active) return;
    const scale = 1.2 + Math.sin(clock.elapsedTime * 3) * 0.18;
    ref.current.scale.setScalar(scale);
  });
  return (
    <mesh ref={(mesh) => { ref.current = mesh; }} scale={active ? 1.25 : 1.05}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshBasicMaterial color={color} transparent opacity={active ? 0.14 : 0.045} side={THREE.BackSide} />
    </mesh>
  );
}

function GraphNode({ node, active, selected, onSelect }: { node: PositionedNode; active: boolean; selected: boolean; onSelect: (node: RagGraphNode) => void }) {
  const color = colorOf(node);
  const confidence = clamp(Number(node.confidence || 0.7), 0.25, 1);
  const radius = node.kind === 'core'
    ? 0.86
    : node.kind === 'source'
      ? 0.38 + confidence * 0.18
      : node.kind === 'cluster'
        ? 0.26
        : 0.18 + confidence * 0.18;
  const labelOffset = radius + (node.kind === 'chunk' ? 0.26 : 0.44);
  return (
    <group position={node.position}>
      <mesh
        scale={selected ? 1.18 : active ? 1.1 : 1}
        onClick={(event) => { event.stopPropagation(); onSelect(node); }}
        onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
      >
        {node.kind === 'source' ? <octahedronGeometry args={[radius, 0]} /> : <sphereGeometry args={[radius, 28, 28]} />}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active || selected || node.kind === 'core' ? 0.34 : 0.1}
          roughness={0.58}
          metalness={node.kind === 'core' ? 0.12 : 0.04}
          transparent
          opacity={node.vectorStatus === 'failed' ? 0.72 : 1}
        />
      </mesh>
      <PulseHalo color={color} radius={radius} active={active || selected || node.kind === 'core'} />
      {((node.kind === 'core' || node.kind === 'source') || active || selected) && (
        <Html center position={[0, labelOffset, 0]} distanceFactor={node.kind === 'chunk' ? 9 : 8} style={{ pointerEvents: 'none' }}>
          <div style={labelStyle(active || selected, color)}>
            {node.kind === 'chunk' && node.chunkId ? `#${node.chunkId} ` : ''}{shortLabel(node.label, node.kind === 'chunk' ? 16 : 20)}
          </div>
        </Html>
      )}
    </group>
  );
}

function Scene({ nodes, edges, activeChunkIds, selectedId, onSelect }: { nodes: PositionedNode[]; edges: RagGraphEdge[]; activeChunkIds: Set<number>; selectedId?: string; onSelect: (node: RagGraphNode) => void }) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  return (
    <>
      <color attach="background" args={[CANVAS_BG]} />
      <fog attach="fog" args={[CANVAS_BG, 13, 28]} />
      <ambientLight intensity={1.18} />
      <directionalLight position={[6, 8, 10]} intensity={1.35} color="#ffffff" />
      <pointLight position={[-6, 4, 8]} intensity={0.75} color="#8b5cf6" />
      <pointLight position={[7, -4, -6]} intensity={0.45} color="#14b8a6" />
      <CameraFraming />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={7} maxDistance={22} enablePan={false} />

      {edges.map((edge, index) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return null;
        const retrieved = to.chunkId ? activeChunkIds.has(Number(to.chunkId)) : false;
        const color = edge.type === 'tagged' ? '#14b8a6' : retrieved ? '#5453ea' : '#9aa0b4';
        return (
          <Line
            key={`${edge.from}-${edge.to}-${index}`}
            points={[from.position, to.position]}
            color={color}
            transparent
            opacity={retrieved ? 0.82 : edge.type === 'contains' ? 0.36 : 0.24}
            lineWidth={retrieved ? 2 : 1}
          />
        );
      })}

      {nodes.map((node) => (
        <GraphNode
          key={node.id}
          node={node}
          active={Boolean(node.chunkId && activeChunkIds.has(Number(node.chunkId)))}
          selected={selectedId === node.id}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function ScoreBreakdown({ result }: { result?: SearchResult }) {
  if (!result?.scoreBreakdown) return null;
  const rows = [
    ['向量相似', result.scoreBreakdown.vectorScore],
    ['关键词命中', result.scoreBreakdown.keywordScore],
    ['标签命中', result.scoreBreakdown.tagScore],
    ['来源可信', result.scoreBreakdown.sourceConfidence],
    ['新鲜度', result.scoreBreakdown.freshness],
  ];
  return (
    <div className="col" style={{ gap: 6 }}>
      {rows.map(([label, value]) => (
        <div key={String(label)} className="col" style={{ gap: 3 }}>
          <div className="row tiny faint"><span className="grow">{label}</span><strong>{Math.round(Number(value) * 100)}%</strong></div>
          <Bar value={Number(value) * 100} />
        </div>
      ))}
    </div>
  );
}

export default function RagEngine3D({ graph, results = [], query = '' }: { graph?: RagGraphSnapshot | null; results?: SearchResult[]; query?: string }) {
  const [selected, setSelected] = useState<RagGraphNode | null>(null);
  const [viewKey, setViewKey] = useState(0);
  const activeChunkIds = useMemo(() => new Set(results.map((item) => Number(item.chunkId)).filter(Boolean)), [results]);
  const resultByChunk = useMemo(() => new Map(results.map((item) => [Number(item.chunkId), item])), [results]);
  const positionedNodes = useMemo(() => buildLayout(graph?.nodes || []), [graph?.nodes]);
  const selectedResult = selected?.chunkId ? resultByChunk.get(Number(selected.chunkId)) : undefined;
  const metrics = graph?.metrics || {};

  useEffect(() => {
    if (!selected && positionedNodes.length > 0) setSelected(positionedNodes.find((node) => node.kind === 'core') || positionedNodes[0]);
  }, [positionedNodes, selected]);

  if (!graph || !positionedNodes.length) {
    return (
      <div className="col" style={{ minHeight: 360, justifyContent: 'center', alignItems: 'center', gap: 8, border: '1px dashed var(--border)', borderRadius: 12 }}>
        <span className="small muted">暂无 RAG 图谱数据</span>
        <span className="tiny faint">完成知识导入或重建索引后，这里会显示可视化数据引擎。</span>
      </div>
    );
  }

  return (
    <div className="rag-engine-grid">
      <div className="rag-canvas" style={{ background: CANVAS_BG }}>
        <Canvas key={viewKey} camera={{ position: [0, 7, 14], fov: 48, near: 0.1, far: 70 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}>
          <Scene nodes={positionedNodes} edges={graph.edges || []} activeChunkIds={activeChunkIds} selectedId={selected?.id} onSelect={setSelected} />
        </Canvas>
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          onClick={() => setViewKey((value) => value + 1)}
          title="重置视角"
          aria-label="重置视角"
          style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, padding: 0, display: 'grid', placeItems: 'center', borderRadius: 8, background: 'rgba(255,255,255,.82)' }}
        >
          <RotateCcw size={14} />
        </button>
        {query && (
          <div style={{ position: 'absolute', left: 12, top: 12, padding: '6px 9px', borderRadius: 999, background: 'rgba(255,255,255,.9)', border: '1px solid var(--border)', boxShadow: '0 10px 24px rgba(15,23,42,.08)' }}>
            <span className="tiny">Query：<strong>{query}</strong> · 高亮 {activeChunkIds.size} 个证据节点</span>
          </div>
        )}
      </div>

      <aside className="col" style={{ gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="metric"><span className="metric__label">切片</span><strong className="metric__value">{metrics.totalChunks || 0}</strong></div>
          <div className="metric"><span className="metric__label">已索引</span><strong className="metric__value">{metrics.indexedChunks || 0}</strong></div>
          <div className="metric"><span className="metric__label">来源</span><strong className="metric__value">{metrics.sourceCount || 0}</strong></div>
          <div className="metric"><span className="metric__label">命中</span><strong className="metric__value">{activeChunkIds.size}</strong></div>
        </div>

        <div className="col" style={{ gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(255,255,255,.72)' }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Tag tone="brand">{selected?.kind === 'chunk' ? `证据 #${selected.chunkId}` : selected?.kind || '节点'}</Tag>
            {selected?.sourceType && <Tag tone="neutral">{SOURCE_TYPE_LABEL[selected.sourceType] || selected.sourceType}</Tag>}
            {selected?.vectorStatus && <Tag tone={selected.vectorStatus === 'indexed' ? 'green' : selected.vectorStatus === 'failed' ? 'rose' : 'amber'}>{selected.vectorStatus === 'indexed' ? '已索引' : selected.vectorStatus === 'failed' ? '索引失败' : '待索引'}</Tag>}
          </div>
          <strong className="small">{selected?.label || 'RAG Engine'}</strong>
          {selected?.snippet && <p className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{selected.snippet}</p>}
          {typeof selected?.confidence === 'number' && (
            <div className="col" style={{ gap: 4 }}>
              <div className="row tiny faint"><span className="grow">证据可信度</span><strong>{Math.round(selected.confidence * 100)}%</strong></div>
              <Bar value={selected.confidence * 100} />
            </div>
          )}
          {selectedResult?.retrieval && (
            <p className="tiny faint">召回模式：{selectedResult.retrieval.mode === 'vector' ? '向量召回 + 重排' : '关键词兜底'} · Rank #{selectedResult.retrieval.rank}</p>
          )}
          <ScoreBreakdown result={selectedResult} />
          {selectedResult?.matchedTerms?.length ? (
            <div className="row wrap" style={{ gap: 6 }}>
              {selectedResult.matchedTerms.slice(0, 8).map((term) => <Tag key={term} tone="neutral">{term}</Tag>)}
            </div>
          ) : null}
          {selected?.skillTags?.length ? (
            <div className="row wrap" style={{ gap: 6 }}>
              {selected.skillTags.slice(0, 8).map((tag) => <Tag key={tag} tone="neutral">{tag}</Tag>)}
            </div>
          ) : null}
        </div>

        <div className="col" style={{ gap: 7 }}>
          <p className="tiny faint">图例：中心球=Chroma 向量核心，菱形=数据源，小绿球=知识主题，小球=证据切片。</p>
          <p className="tiny faint">颜色表示来源类型，球体大小表示可信度，发光节点表示本次检索命中，红/黄节点表示索引异常或排队。</p>
        </div>
      </aside>
    </div>
  );
}
