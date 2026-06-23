import { useMemo } from 'react';
import type { SkillGraphNode } from '../../types/workspace';

/**
 * NodeDetail — 节点详情面板
 *
 * 选中节点时展示:
 *   - 技能名称 + 分类
 *   - 掌握度进度条
 *   - 信任权重指示器
 *   - 前置技能列表 (可点击)
 *   - 关联技能列表
 *   - 最后更新时间 (相对)
 *   - 快捷操作按钮
 */

interface Props {
  node: SkillGraphNode;
  onClose: () => void;
}

/** 相对时间显示 */
function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return `${Math.floor(days / 30)}个月前`;
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

/** 掌握度等级文字 */
function masteryLabel(value: number): string {
  if (value >= 90) return '精通';
  if (value >= 70) return '熟练';
  if (value >= 50) return '掌握';
  if (value >= 30) return '了解';
  return '入门';
}

/** 掌握度颜色 */
function masteryColor(value: number): string {
  if (value >= 80) return '#4ade80';
  if (value >= 60) return '#facc15';
  if (value >= 40) return '#fb923c';
  return '#f87171';
}

/** 分类颜色 */
const CATEGORY_COLORS: Record<string, string> = {
  '前端基础': '#3b82f6',
  '前端框架': '#8b5cf6',
  '后端': '#10b981',
  '数据库': '#f59e0b',
  'DevOps': '#ef4444',
  '软技能': '#ec4899',
};

export default function NodeDetail({ node, onClose }: Props) {
  const catColor = CATEGORY_COLORS[node.category] || '#6366f1';

  const trustLevel = useMemo(() => {
    if (node.trustWeight >= 0.9) return { icon: '\u{1F512}', text: '已验证', color: '#4ade80' };
    if (node.trustWeight >= 0.6) return { icon: '\u{1F510}', text: '部分验证', color: '#facc15' };
    return { icon: '\u{1F4AD}', text: '自评', color: '#94a3b8' };
  }, [node.trustWeight]);

  return (
    <div
      className="absolute top-3 right-3 w-72 max-h-[calc(100%-24px)] overflow-y-auto
        rounded-xl border border-white/10 bg-[#0f0f1a]/95 backdrop-blur-md text-white shadow-2xl z-10"
    >
      {/* 头部 */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold leading-tight">{node.name}</h3>
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium"
              style={{ background: catColor + '20', color: catColor, borderLeft: `2px solid ${catColor}` }}
            >
              {node.category}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none p-1"
            aria-label="关闭"
          >
            &times;
          </button>
        </div>
      </div>

      {/* 掌握度 */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400">掌握度</span>
          <span className="text-xs font-medium" style={{ color: masteryColor(node.mastery) }}>
            {masteryLabel(node.mastery)} {node.mastery}%
          </span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${node.mastery}%`,
              background: `linear-gradient(90deg, ${masteryColor(node.mastery)}, ${masteryColor(node.mastery)}cc)`,
            }}
          />
        </div>
        {/* 有效掌握度 (mastery * trust) */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-500">有效掌握度</span>
          <span className="text-[10px] text-gray-400">{node.effectiveMastery.toFixed(1)}%</span>
        </div>
      </div>

      {/* 信任权重 */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-base">{trustLevel.icon}</span>
          <div>
            <span className="text-xs text-gray-400">信任权重</span>
            <span className="ml-2 text-xs font-medium" style={{ color: trustLevel.color }}>
              {trustLevel.text} ({(node.trustWeight * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>

      {/* 前置技能 */}
      {node.prerequisites.length > 0 && (
        <div className="px-4 py-3 border-b border-white/5">
          <h4 className="text-xs text-gray-400 mb-2">
            前置技能 ({node.prerequisites.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {node.prerequisites.map((prereq) => (
              <span
                key={prereq}
                className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-gray-300
                  hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
              >
                {prereq}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 关联技能 */}
      {node.relatedSkills.length > 0 && (
        <div className="px-4 py-3 border-b border-white/5">
          <h4 className="text-xs text-gray-400 mb-2">
            关联技能 ({node.relatedSkills.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {node.relatedSkills.map((related) => (
              <span
                key={related}
                className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-gray-300
                  hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
              >
                {related}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 最后更新 */}
      <div className="px-4 py-2 border-b border-white/5">
        <span className="text-[10px] text-gray-500">
          最后更新: {relativeTime(node.lastUpdated)}
        </span>
      </div>

      {/* 快捷操作 */}
      <div className="p-3 flex flex-col gap-2">
        <button
          className="w-full py-2 px-3 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30
            text-indigo-300 text-xs font-medium transition-colors text-left"
        >
          生成学习计划
        </button>
        <button
          className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30
            text-amber-300 text-xs font-medium transition-colors text-left"
        >
          出考试题
        </button>
        <button
          className="w-full py-2 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30
            text-emerald-300 text-xs font-medium transition-colors text-left"
        >
          生成教学视频
        </button>
      </div>
    </div>
  );
}
