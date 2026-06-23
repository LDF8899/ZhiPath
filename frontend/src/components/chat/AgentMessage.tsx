import { AGENT_CONFIGS } from '../office/types';
import AnimalAvatar from '../office/AnimalAvatar';
import type { ChatMessage } from '../../types';

interface AgentMessageProps {
  message: ChatMessage;
  isLast: boolean;
}

export default function AgentMessage({ message, isLast }: AgentMessageProps) {
  const agentKey = message.agent || 'chat';
  const config = AGENT_CONFIGS[agentKey] || AGENT_CONFIGS['chat'];
  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

  return (
    <div className={`agent-message ${isLast ? 'latest' : ''}`}>
      <div className="agent-message-header">
        <AnimalAvatar type={config.animal} color={config.color} size={24} />
        <span className="agent-message-name" style={{ color: config.color }}>{config.name}</span>
      </div>
      <div className="agent-message-bubble">
        {content}
      </div>
    </div>
  );
}
