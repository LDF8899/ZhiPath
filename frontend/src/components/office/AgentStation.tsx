import AnimalAvatar from './AnimalAvatar';
import type { AgentConfig } from './types';

interface AgentStationProps {
  agent: AgentConfig;
  status: 'idle' | 'working' | 'completed';
  isActive: boolean;
  onClick?: () => void;
}

export default function AgentStation({ agent, status, isActive, onClick }: AgentStationProps) {
  return (
    <div className={`agent-station ${isActive ? 'active' : ''} ${status}`} onClick={onClick}>
      <div className="station-desk">
        <AnimalAvatar type={agent.animal} color={agent.color} size={48} status={status} />
      </div>
      <div className="station-label">
        <span className="station-name">{agent.name}</span>
        {status === 'working' && <span className="station-status">忙碌中</span>}
      </div>
    </div>
  );
}
