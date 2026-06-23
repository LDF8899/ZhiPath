import { Html } from '@react-three/drei';

/**
 * GraphControls — 图表控制面板 (HTML overlay)
 *
 * 功能:
 *   - 标签显隐切换
 *   - 簇云显隐切换
 *   - 分类过滤
 *   - 重置视角 (通过 OrbitControls API)
 */

interface Props {
  showLabels: boolean;
  showClusters: boolean;
  categories: string[];
  activeCategories: Set<string>;
  onToggleLabels: () => void;
  onToggleClusters: () => void;
  onToggleCategory: (category: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  '前端基础': '#3b82f6',
  '前端框架': '#8b5cf6',
  '后端': '#10b981',
  '数据库': '#f59e0b',
  'DevOps': '#ef4444',
  '软技能': '#ec4899',
};

export default function GraphControls({
  showLabels,
  showClusters,
  categories,
  activeCategories,
  onToggleLabels,
  onToggleClusters,
  onToggleCategory,
}: Props) {
  return (
    <Html
      fullscreen
      style={{ pointerEvents: 'none' }}
      position={[0, 0, 0]}
    >
      <div
        className="absolute bottom-3 left-3 flex flex-col gap-2 pointer-events-auto"
        style={{ zIndex: 10 }}
      >
        {/* 标签 / 簇云切换 */}
        <div className="flex gap-1.5">
          <ToggleButton
            active={showLabels}
            onClick={onToggleLabels}
            label="标签"
          />
          <ToggleButton
            active={showClusters}
            onClick={onToggleClusters}
            label="簇云"
          />
        </div>

        {/* 分类过滤器 */}
        <div className="bg-[#0f0f1a]/80 backdrop-blur-sm rounded-lg p-2 border border-white/5">
          <span className="text-[10px] text-gray-500 block mb-1.5">分类筛选</span>
          <div className="flex flex-col gap-1">
            {categories.map((cat) => {
              const color = CATEGORY_COLORS[cat] || '#6366f1';
              const active = activeCategories.has(cat);
              return (
                <label
                  key={cat}
                  className="flex items-center gap-1.5 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => onToggleCategory(cat)}
                    className="sr-only"
                  />
                  <span
                    className="w-3 h-3 rounded-sm border transition-all flex-shrink-0"
                    style={{
                      borderColor: active ? color : '#374151',
                      background: active ? color : 'transparent',
                    }}
                  />
                  <span
                    className="text-[10px] transition-colors"
                    style={{ color: active ? '#e5e7eb' : '#6b7280' }}
                  >
                    {cat}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </Html>
  );
}

/** 切换按钮 */
function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all
        border backdrop-blur-sm"
      style={{
        background: active ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 15, 26, 0.8)',
        borderColor: active ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255,255,255,0.05)',
        color: active ? '#a5b4fc' : '#6b7280',
      }}
    >
      {active ? '隐藏' : '显示'}{label}
    </button>
  );
}
