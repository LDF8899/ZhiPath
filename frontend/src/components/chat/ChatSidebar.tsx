import { useOfficeStore } from '../../stores/office';
import { AGENT_CONFIGS } from '../office/types';
import AnimalAvatar from '../office/AnimalAvatar';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const agentList = Object.entries(AGENT_CONFIGS).filter(([key]) => key !== 'chat');

export default function ChatSidebar({ isOpen, onToggle }: ChatSidebarProps) {
  const { activeAgent, agentStatuses, tasks } = useOfficeStore();

  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');

  return (
    <>
      <button className="office-sidebar-toggle" onClick={onToggle} title="智能体办公室">
        <span className="office-toggle-icon">{isOpen ? '›' : '‹'}</span>
      </button>
      <aside className={`office-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="office-sidebar-header">
          <h3>智能体办公室</h3>
        </div>

        <div className="office-agent-list">
          {agentList.map(([key, config]) => {
            const status = agentStatuses[key] || 'idle';
            const isActive = activeAgent === key;
            return (
              <div key={key} className={`office-agent-item ${isActive ? 'active' : ''}`}>
                <AnimalAvatar type={config.animal} color={config.color} size={32} status={status} />
                <div className="office-agent-info">
                  <span className="office-agent-name">{config.name}</span>
                  <span className={`office-agent-status ${status}`}>
                    {status === 'working' ? '工作中' : status === 'completed' ? '已完成' : '空闲'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {activeTasks.length > 0 && (
          <div className="office-task-section">
            <h4>进行中的任务</h4>
            {activeTasks.map(task => (
              <div key={task.taskId} className="office-task-item">
                <span className="office-task-name">{task.name}</span>
                <div className="office-task-progress">
                  <div className="office-task-bar" style={{ width: `${task.progress}%` }} />
                </div>
                <span className="office-task-msg">{task.message || `${task.progress}%`}</span>
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
