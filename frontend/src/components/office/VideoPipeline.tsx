const PIPELINE_STAGES = [
  { id: 'script', label: '脚本', icon: '🐼' },
  { id: 'render', label: '渲染', icon: '🎬' },
  { id: 'tts', label: '配音', icon: '🎙️' },
  { id: 'compose', label: '合成', icon: '🎬' },
];

interface VideoPipelineProps {
  taskId: string;
  currentStage: string;
  progress: number;
}

export default function VideoPipeline({ taskId, currentStage, progress }: VideoPipelineProps) {
  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.id === currentStage);
  
  return (
    <div className="video-pipeline">
      <h4 className="pipeline-title">🎬 视频制作</h4>
      <div className="pipeline-stages">
        {PIPELINE_STAGES.map((stage, i) => {
          const isCompleted = i < currentStageIndex;
          const isActive = i === currentStageIndex;
          
          return (
            <div 
              key={stage.id}
              className={`pipeline-stage ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
            >
              <div className="stage-icon">
                {isCompleted ? '✓' : stage.icon}
              </div>
              <span className="stage-label">{stage.label}</span>
              {isActive && (
                <div className="stage-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="progress-text">{progress}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
