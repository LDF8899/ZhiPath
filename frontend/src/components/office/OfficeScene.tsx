import AgentStation from './AgentStation';
import TaskProgress from './TaskProgress';
import { useOfficeStore } from '../../stores/office';
import { AGENT_CONFIGS } from './types';

const SCENE_AGENTS: Record<string, string[]> = {
  village: ['generate_path', 'chat', 'recommend_jobs'],
  advanced: ['generate_path', 'chat', 'recommend_jobs', 'generate_exam', 'show_progress', 'generate_video'],
  master: Object.keys(AGENT_CONFIGS),
};

const SCENE_CONFIGS = {
  village: { name: '新手村', bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  advanced: { name: '进阶区', bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  master: { name: '大师殿', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
};

export default function OfficeScene() {
  const { currentScene, activeAgent, agentStatuses, setActiveAgent } = useOfficeStore();
  const sceneConfig = SCENE_CONFIGS[currentScene as keyof typeof SCENE_CONFIGS] || SCENE_CONFIGS.village;
  const agentIds = SCENE_AGENTS[currentScene] || SCENE_AGENTS.village;
  
  return (
    <div className="office-scene" style={{ background: sceneConfig.bg }}>
      <div className="scene-header">
        <span className="scene-name">🏢 {sceneConfig.name}</span>
      </div>
      <div className="scene-grid">
        {agentIds.map(agentId => {
          const config = AGENT_CONFIGS[agentId];
          if (!config) return null;
          return (
            <AgentStation
              key={agentId}
              agent={config}
              status={agentStatuses[agentId] || 'idle'}
              isActive={activeAgent === agentId}
              onClick={() => setActiveAgent(agentId)}
            />
          );
        })}
      </div>
      <TaskProgress />
    </div>
  );
}
