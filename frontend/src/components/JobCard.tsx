import '../styles/hand-draw.css';
import { IconBriefcase, IconLink } from './icons';
import { useNavigate } from 'react-router-dom';

interface Props {
  job: {
    id: number;
    title: string;
    company: string;
    location?: string;
    salaryRange?: string;
    matchScore: number;
    requiredSkills?: Array<{ name: string; weight?: number }>;
  };
  compact?: boolean;
}

export default function JobCard({ job, compact }: Props) {
  const navigate = useNavigate();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'blue';
    return '';
  };

  const getScoreHex = (score: number) => {
    if (score >= 80) return '#4a9d4a';
    if (score >= 60) return 'var(--data-blue)';
    return 'var(--accent)';
  };

  const tiltClass = job.id % 4 === 0 ? 'hd-tilt-1' : job.id % 4 === 1 ? 'hd-tilt-2' : job.id % 4 === 2 ? 'hd-tilt-3' : 'hd-tilt-4';

  if (compact) {
    return (
      <div
        onClick={() => navigate(`/user/jobs/${job.id}`)}
        className="hd-card hd-flex-between"
        style={{ cursor: 'pointer' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontFamily: 'var(--hand-bold)', fontSize: 15 }}>{job.title}</div>
          <div style={{ fontSize: 13, color: 'var(--pencil)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <IconBriefcase size={14} />
            {job.company}
            {job.location && (
              <>
                <span style={{ color: 'var(--rule)' }}>·</span>
                <IconLink size={14} />
                {job.location}
              </>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--serif)', color: getScoreHex(job.matchScore) }}>
            {job.matchScore}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--pencil)', fontFamily: 'var(--mono)' }}>匹配度</div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => navigate(`/user/jobs/${job.id}`)}
      className={`hd-card ${tiltClass}`}
      style={{ cursor: 'pointer' }}
    >
      <div className="hd-flex-between" style={{ marginBottom: 10 }}>
        <div>
          <h3 style={{ font: '800 20px/1.2 var(--serif)', margin: '0 0 4px' }}>{job.title}</h3>
          <div style={{ fontSize: 14, color: 'var(--pencil)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconBriefcase size={16} /> {job.company}
            {job.location && (
              <>
                <span style={{ color: 'var(--rule)' }}>·</span>
                {job.location}
              </>
            )}
          </div>
        </div>
        {job.salaryRange && (
          <span className="hd-badge accent">{job.salaryRange}</span>
        )}
      </div>

      {job.requiredSkills && job.requiredSkills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {job.requiredSkills.map((skill) => (
            <span key={skill.name} className="hd-tag">{skill.name}</span>
          ))}
        </div>
      )}

      <div className="hd-flex" style={{ gap: 10 }}>
        <div className="hd-progress" style={{ flex: 1 }}>
          <div className={`hd-progress-bar ${getScoreColor(job.matchScore)}`} style={{ width: `${job.matchScore}%` }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: getScoreHex(job.matchScore) }}>
          匹配 {job.matchScore}%
        </span>
      </div>
    </div>
  );
}
