import { useEffect } from 'react';
import { useTaskGroup, type GroupTask, type TaskStatus } from '../hooks/useTaskGroup';

interface Props {
  groupId: string;
  showDetails?: boolean;
  onComplete?: () => void;
}

/** 状态图标 */
const STATUS_ICON: Record<TaskStatus, string> = {
  pending: '⏳',
  running: '⚙️',
  completed: '✅',
  failed: '❌',
  cancelled: '⛔',
};

/** 状态颜色 */
const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: 'text-gray-400',
  running: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  cancelled: 'text-gray-400',
};

/** 进度条颜色 */
function getProgressColor(progress: number, status: TaskStatus): string {
  if (status === 'failed') return 'bg-red-500';
  if (status === 'cancelled') return 'bg-gray-300';
  if (status === 'completed') return 'bg-green-500';
  if (progress < 30) return 'bg-blue-400';
  if (progress < 70) return 'bg-blue-500';
  return 'bg-blue-600';
}

/**
 * 任务组进度组件 — 显示多个关联任务的总进度
 */
export default function TaskGroupProgress({ groupId, showDetails = false, onComplete }: Props) {
  const {
    tasks,
    progress,
    status,
    isComplete,
    isFailed,
    isRunning,
    isCancelled,
    cancelGroup,
    connected,
  } = useTaskGroup(groupId);

  // 完成回调
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  const statusLabel = {
    pending: '等待中',
    running: '进行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }[status];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* 头部 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {statusLabel}
          </span>
          {!connected && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
              断线重连中…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{progress}%</span>
          {isRunning && (
            <button
              onClick={cancelGroup}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
          )}
        </div>
      </div>

      {/* 总进度条 */}
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progress, status)}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 子任务列表 */}
      {showDetails && tasks.length > 0 && (
        <div className="mt-2 space-y-2">
          {tasks.map((task) => (
            <TaskItem key={task.taskId} task={task} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {tasks.length === 0 && (
        <div className="py-2 text-center text-sm text-gray-400">
          {isRunning ? '等待任务下发…' : '暂无任务'}
        </div>
      )}
    </div>
  );
}

/** 子任务项 */
function TaskItem({ task }: { task: GroupTask }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
      {/* 状态图标 */}
      <span className={`text-sm ${STATUS_COLOR[task.status]}`}>
        {STATUS_ICON[task.status]}
      </span>

      {/* 任务信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-gray-700">{task.name}</span>
          <span className="ml-2 shrink-0 text-xs text-gray-500">
            {task.status === 'running' ? `${task.progress}%` : ''}
          </span>
        </div>

        {/* 子进度条 */}
        {(task.status === 'running' || task.status === 'completed') && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getProgressColor(task.progress, task.status)}`}
              style={{ width: `${task.progress}%` }}
            />
          </div>
        )}

        {/* 消息 */}
        {task.message && (
          <p className="mt-0.5 truncate text-xs text-gray-400">{task.message}</p>
        )}
      </div>
    </div>
  );
}
