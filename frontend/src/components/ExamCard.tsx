import '../styles/hand-draw.css';
import { IconDocument, IconArrowRight } from './icons';
import { useNavigate } from 'react-router-dom';

interface Props {
  data: {
    exam_id: number;
    skill: string;
    questions: Array<{ type: string; question: string }>;
  };
}

export default function ExamCard({ data }: Props) {
  const navigate = useNavigate();

  return (
    <div className="hd-card">
      <div className="hd-flex" style={{ marginBottom: 10 }}>
        <div className="hd-avatar" style={{ background: 'var(--highlight)' }}>
          <IconDocument size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--hand-bold)', fontSize: 15 }}>{data.skill} 练习题</div>
          <div style={{ fontSize: 12, color: 'var(--pencil)' }}>共 {data.questions.length} 题</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        {data.questions.slice(0, 2).map((q, i) => (
          <div key={i} className="hd-dashed" style={{ fontSize: 12, color: 'var(--pencil)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '6px 10px' }}>
            {i + 1}. {q.question}
          </div>
        ))}
        {data.questions.length > 2 && (
          <div style={{ fontSize: 11, color: 'var(--pencil)', paddingLeft: 4 }}>还有 {data.questions.length - 2} 题...</div>
        )}
      </div>
      <button
        className="hd-btn small"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={() => navigate(`/user/exams/${data.exam_id}/take`)}
      >
        开始做题
        <IconArrowRight size={14} />
      </button>
    </div>
  );
}
