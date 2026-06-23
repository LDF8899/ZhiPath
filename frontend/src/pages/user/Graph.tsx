import { useState } from 'react';
import '../../styles/hand-draw.css';
import {
  IconGraph,
  IconCode,
  IconBriefcase,
} from '../../components/icons';

/** Mock graph data */
const mockSkills = [
  { name: 'JavaScript', level: '精通', related: ['React', 'TypeScript', 'Node.js', 'Vue'] },
  { name: 'React', level: '熟悉', related: ['JavaScript', 'TypeScript', 'Redux', 'Next.js'] },
  { name: 'TypeScript', level: '熟悉', related: ['JavaScript', 'React', 'Node.js'] },
  { name: 'Python', level: '了解', related: ['Django', 'FastAPI', '数据分析'] },
  { name: 'Node.js', level: '了解', related: ['JavaScript', 'Express', 'Nest.js'] },
  { name: 'HTML/CSS', level: '精通', related: ['JavaScript', 'Sass', 'Tailwind'] },
];

const mockJobs = [
  { title: '前端开发工程师', company: '腾讯科技', skills: ['JavaScript', 'React', 'TypeScript'] },
  { title: '全栈开发工程师', company: '字节跳动', skills: ['JavaScript', 'React', 'Node.js'] },
  { title: 'Web 前端工程师', company: '阿里巴巴', skills: ['JavaScript', 'React', 'CSS'] },
];

export default function Graph() {
  const [selectedSkill, setSelectedSkill] = useState<string>('JavaScript');

  const currentSkill = mockSkills.find((s) => s.name === selectedSkill) || mockSkills[0];
  const relatedSkills = mockSkills.filter((s) => currentSkill.related.includes(s.name));
  const connectedJobs = mockJobs.filter((j) => j.skills.includes(selectedSkill));

  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        {/* Header */}
        <div className="hd-header">
          <div>
            <h1>知识图谱</h1>
            <p style={{ font: '15px/1.3 var(--hand)', color: 'var(--pencil)', margin: '4px 0 0' }}>
              技能关联关系可视化
            </p>
          </div>
          <select
            className="hd-select"
            style={{ width: 200 }}
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
          >
            {mockSkills.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Graph placeholder */}
        <div className="hd-canvas" style={{ minHeight: 500 }}>
          <div className="hd-empty" style={{ padding: '24px 0' }}>
            <IconGraph size={56} />
            <div style={{ marginTop: 12, marginBottom: 6, font: '20px/1 var(--hand-bold)' }}>
              图谱视图开发中
            </div>
            <div style={{ font: '14px/1.4 var(--hand)', color: 'var(--pencil)', maxWidth: 400, margin: '0 auto' }}>
              React Flow 尚未安装，以下以结构化卡片展示技能与岗位的关联关系。
            </div>
          </div>

          {/* Selected skill highlight */}
          <div style={{ textAlign: 'center', margin: '16px 0 24px' }}>
            <span className="hd-pin" style={{ fontSize: 14 }}>
              当前技能：{currentSkill.name} ({currentSkill.level})
            </span>
          </div>

          {/* Relationship display as structured cards */}
          <div className="hd-grid-2">
            {/* Related skills */}
            <div>
              <div className="hd-section-label">
                <IconCode size={20} />
                <h3>关联技能</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {relatedSkills.length > 0 ? relatedSkills.map((skill) => (
                  <div key={skill.name} className="hd-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedSkill(skill.name)}>
                    <div className="hd-flex-between">
                      <span style={{ font: '700 16px/1 var(--hand-bold)', color: 'var(--ink)' }}>{skill.name}</span>
                      <span className="hd-badge">{skill.level}</span>
                    </div>
                    <div className="hd-divider" style={{ margin: '8px 0' }} />
                    <div style={{ font: '13px/1.3 var(--hand)', color: 'var(--pencil)' }}>
                      {selectedSkill} → {skill.name}
                    </div>
                  </div>
                )) : (
                  <div className="hd-dashed" style={{ textAlign: 'center', padding: 20, font: '14px/1 var(--hand)', color: 'var(--pencil)' }}>
                    暂无关联技能
                  </div>
                )}
              </div>
            </div>

            {/* Connected jobs */}
            <div>
              <div className="hd-section-label">
                <IconBriefcase size={20} />
                <h3>相关岗位</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {connectedJobs.length > 0 ? connectedJobs.map((job, i) => (
                  <div key={i} className="hd-card">
                    <div style={{ font: '700 16px/1 var(--hand-bold)', color: 'var(--ink)', marginBottom: 4 }}>
                      {job.title}
                    </div>
                    <div style={{ font: '13px/1.3 var(--hand)', color: 'var(--pencil)', marginBottom: 8 }}>
                      {job.company}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {job.skills.map((s) => (
                        <span key={s} className={`hd-tag ${s === selectedSkill ? 'hot' : ''}`}>{s}</span>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="hd-dashed" style={{ textAlign: 'center', padding: 20, font: '14px/1 var(--hand)', color: 'var(--pencil)' }}>
                    暂无相关岗位
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* All skills overview */}
          <div style={{ marginTop: 24 }}>
            <div className="hd-section-label">
              <IconGraph size={20} />
              <h3>全部技能</h3>
            </div>
            <div className="hd-grid-3">
              {mockSkills.map((skill) => (
                <div
                  key={skill.name}
                  className={`hd-card ${skill.name === selectedSkill ? 'hd-card-accent' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedSkill(skill.name)}
                >
                  <div className="hd-flex-between" style={{ marginBottom: 6 }}>
                    <span style={{ font: '700 16px/1 var(--hand-bold)', color: 'var(--ink)' }}>{skill.name}</span>
                    <span className={`hd-badge ${skill.level === '精通' ? 'green' : skill.level === '熟悉' ? 'accent' : ''}`}>
                      {skill.level}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {skill.related.slice(0, 3).map((r) => (
                      <span key={r} className="hd-tag" style={{ fontSize: 11, padding: '2px 6px' }}>{r}</span>
                    ))}
                    {skill.related.length > 3 && (
                      <span className="hd-tag" style={{ fontSize: 11, padding: '2px 6px' }}>+{skill.related.length - 3}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
