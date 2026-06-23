import { useEffect, useCallback, useRef } from 'react';
import { useSSE } from './useSSE';
import { useOfficeStore } from '../stores/office';

/**
 * LangGraph 事件 Hook
 *
 * 监听 SSE 的 graph_node 事件，实时更新智能体办公室状态：
 * - 智能体从 idle → working
 * - 进度条实时更新
 * - 任务完成后自动恢复 idle
 */
export function useGraphEvents() {
  const { connected, events, latestEvent } = useSSE();
  const { setActiveAgent, setAgentStatus, addTask, updateTask } = useOfficeStore();
  const processedCountRef = useRef(0);

  // 处理新到达的 graph_node 事件
  useEffect(() => {
    if (!latestEvent || latestEvent.type !== 'graph_node') return;

    const { node, agent, label, reply, actions } = latestEvent.data;

    // 更新智能体状态：开始工作
    setActiveAgent(agent);
    setAgentStatus(agent, 'working');

    // 如果节点产生了 actions（如 video_pending），添加到任务跟踪
    if (actions?.length > 0) {
      for (const action of actions) {
        if (action.type === 'video_pending' && action.data?.taskId) {
          addTask({
            taskId: action.data.taskId,
            agentId: agent,
            name: `生成${action.data.skillName || ''}教学视频`,
            progress: 0,
            status: 'running',
            message: label,
          });
        }
      }
    }

    // 2 秒后恢复 idle（除非是长时间任务如视频生成）
    const isLongTask = node === 'generateVideo' || node === 'generateAnimation';
    if (!isLongTask) {
      setTimeout(() => {
        setAgentStatus(agent, 'idle');
        setActiveAgent(null);
      }, 2000);
    }
  }, [latestEvent, setActiveAgent, setAgentStatus, addTask]);

  return { connected, events };
}
