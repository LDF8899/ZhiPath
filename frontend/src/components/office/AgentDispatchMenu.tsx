import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { makeAnimalSVG } from './AnimalSVG';

interface DispatchMenuProps {
  agentKey: string;           // agentType: 'path' | 'exam' | 'video' | 'lecture' 等
  agentName: string;
  agentAnimal: string;
  agentColor: string;
  position: { x: number; y: number };
  onClose: () => void;
  /** 上下文：如果从知识图谱节点触发 */
  contextNodeId?: string;
  /** 上下文：如果从路径卡片触发 */
  contextPathId?: number;
  /** 打开详情面板 */
  onDetail?: () => void;
  /** 直接使用 */
  onDirectUse?: () => void;
  /** 编辑 */
  onEdit?: () => void;
}

/**
 * 派遣上下文菜单 — 替代跨页面拖拽
 * 点击 Agent 卡片后弹出，提供派遣/查看详情/直接使用等操作
 */
export default function AgentDispatchMenu({
  agentKey, agentName, agentAnimal, agentColor, position,
  onClose, contextNodeId, contextPathId, onDetail, onDirectUse, onEdit,
}: DispatchMenuProps) {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── 边界检测：确保菜单不超出视口 ── */
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (rect.right > vw - 10) {
        menuRef.current.style.left = `${vw - rect.width - 10}px`;
      }
      if (rect.bottom > vh - 10) {
        menuRef.current.style.top = `${vh - rect.height - 10}px`;
      }
      if (rect.left < 10) {
        menuRef.current.style.left = '10px';
      }
      if (rect.top < 10) {
        menuRef.current.style.top = '10px';
      }
    }
  }, []);

  /* ── 点击外部关闭 ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [onClose]);

  /* ── 菜单项 ── */
  const handleDispatchToChat = useCallback(() => {
    navigate(`/user/chat?agent=${agentKey}&auto=1`);
    onClose();
  }, [navigate, agentKey, onClose]);

  const handleGenerateLearningPlan = useCallback(() => {
    navigate(`/user/chat?agent=${agentKey}&auto=1&nodeId=${contextNodeId}&intent=generate_path`);
    onClose();
  }, [navigate, agentKey, contextNodeId, onClose]);

  const handleGenerateExam = useCallback(() => {
    navigate(`/user/chat?agent=${agentKey}&auto=1&nodeId=${contextNodeId}&intent=generate_exam`);
    onClose();
  }, [navigate, agentKey, contextNodeId, onClose]);

  const handleGenerateVideo = useCallback(() => {
    navigate(`/user/chat?agent=${agentKey}&auto=1&nodeId=${contextNodeId}&intent=generate_video`);
    onClose();
  }, [navigate, agentKey, contextNodeId, onClose]);

  const handleBindPathMentor = useCallback(() => {
    navigate(`/user/chat?agent=${agentKey}&auto=1&pathId=${contextPathId}&intent=path_mentor`);
    onClose();
  }, [navigate, agentKey, contextPathId, onClose]);

  const handleDetail = useCallback(() => {
    onDetail?.();
    onClose();
  }, [onDetail, onClose]);

  const handleDirectUse = useCallback(() => {
    onDirectUse?.();
    onClose();
  }, [onDirectUse, onClose]);

  const handleEdit = useCallback(() => {
    onEdit?.();
    onClose();
  }, [onEdit, onClose]);

  return (
    <>
      {/* 背景遮罩 */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9998,
      }} />

      {/* 菜单本体 */}
      <div
        ref={menuRef}
        className="dispatch-menu"
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          minWidth: 200,
          background: 'var(--paper, #fff)',
          border: '2px solid var(--pencil, #2b2620)',
          borderRadius: 12,
          padding: '8px 0',
          boxShadow: '4px 4px 0 var(--pencil, #2b2620)',
          font: '13px/1.4 var(--hand, sans-serif)',
        }}
      >
        {/* 头部 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px 10px', borderBottom: '1px dashed var(--rule, #e8e4de)',
          marginBottom: 4,
        }}>
          <div style={{ width: 32, height: 32 }} dangerouslySetInnerHTML={{ __html: makeAnimalSVG(agentAnimal, agentColor) }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{agentName}</div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>{agentKey}</div>
          </div>
        </div>

        {/* 通用菜单项 */}
        <MenuItem icon="💬" label="派遣到对话" onClick={handleDispatchToChat} />
        {onDetail && <MenuItem icon="📊" label="查看详情" onClick={handleDetail} />}
        {onDirectUse && <MenuItem icon="⚡" label="直接使用" onClick={handleDirectUse} />}
        {onEdit && <MenuItem icon="✏️" label="编辑形象" onClick={handleEdit} />}

        {/* 上下文菜单项：知识图谱节点 */}
        {contextNodeId && (
          <>
            <div style={{ height: 1, background: 'var(--rule, #e8e4de)', margin: '4px 12px' }} />
            <MenuItem icon="📚" label="为此技能生成学习计划" onClick={handleGenerateLearningPlan} />
            <MenuItem icon="📝" label="为此技能出考试题" onClick={handleGenerateExam} />
            <MenuItem icon="🎬" label="为此技能生成教学视频" onClick={handleGenerateVideo} />
          </>
        )}

        {/* 上下文菜单项：路径卡片 */}
        {contextPathId !== undefined && (
          <>
            <div style={{ height: 1, background: 'var(--rule, #e8e4de)', margin: '4px 12px' }} />
            <MenuItem icon="🎓" label="绑定为路径导师" onClick={handleBindPathMentor} />
          </>
        )}
      </div>
    </>
  );
}

/* ── 菜单项子组件 ── */
function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--rule, #f5f2ed)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
