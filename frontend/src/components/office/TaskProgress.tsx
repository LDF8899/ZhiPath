import AnimalAvatar from './AnimalAvatar';
import { useOfficeStore } from '../../stores/office';

export default function TaskProgress() {
  const { tasks, getAgentConfig } = useOfficeStore();
  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');
  
  if (activeTasks.length === 0) return null;
  
  return (
    <div className="task-progress-panel">
      <h4 className="progress-title">
        <span className="progress-icon">📋</span>
        进行中的任务
      </h4>
      <div className="progress-list">
        {activeTasks.map(task => {
          const config = getAgentConfig(task.agentId);
          return (
            <div key={task.taskId} className="progress-item">
              <AnimalAvatar type={config.animal} color={config.color} size={24} status="working" />
              <div className="progress-info">
                <span className="progress-name">{task.name}</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                </div>
                <span className="progress-text">{task.message || `${task.progress}%`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
