import '../styles/hand-draw.css';
import { IconDocument, IconArrowRight } from './icons';
import { useNavigate } from 'react-router-dom';
import { setPendingQuestionConfig } from '../utils/questionGeneratorConfig';

interface Props {
  data: {
    config?: any;
    summary?: string;
  };
}

export default function QuestionConfigCard({ data }: Props) {
  const navigate = useNavigate();
  const config = data?.config;
  const openGenerator = () => {
    if (config) setPendingQuestionConfig(config);
    navigate('/user/question-generator');
  };

  return (
    <div className="hd-card">
      <div className="hd-flex" style={{ marginBottom: 10 }}>
        <div className="hd-avatar" style={{ background: 'var(--highlight)' }}>
          <IconDocument size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--hand-bold)', fontSize: 15 }}>已解析出题需求</div>
          <div style={{ fontSize: 12, color: 'var(--pencil)' }}>{data.summary || '可到出题器进一步调整'}</div>
        </div>
      </div>
      <button className="hd-btn small" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={openGenerator}>
        去出题器编辑 <IconArrowRight size={15} />
      </button>
    </div>
  );
}
