import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  LogOut,
  Save,
  UserRound,
} from 'lucide-react';
import { skillApi, studentApi } from '../lib/api';
import { useAsync } from '../components/ui';
import { toast } from '../store/toast';
import { disconnectStream } from '../lib/sse';
import { useAuthStore } from '../store/auth';
import { RadarChart, type RadarPoint } from '../components/charts';
import {
  Bar,
  Button,
  Card,
  CardBody,
  CardHead,
  Empty,
  Field,
  Input,
  LoadingBlock,
  Metric,
  Tag,
} from '../components/ui';
import AbilityMap3D from '../components/AbilityMap3D';

/**
 * 用户中心 —— 个人资料、能力结构与退出入口。
 *
 * 左下角用户名点击进入这里；退出登录有独立按钮，不再绑在用户名上。
 * 资料编辑走 PUT /user/profile（学生档案字段）；身份字段（用户名/角色）只读。
 */

export default function Profile() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const profile = useAsync<any>(() => studentApi.profile(), []);
  const radar = useAsync<any>(() => studentApi.radar(), []);
  const skills = useAsync<Array<{ name: string; masteryPct: number; trustWeight: number; source: string }>>(
    () => skillApi.effective(),
    [],
  );

  const student = profile.data?.student || profile.data || {};
  const profileSkills: Array<{ name: string; level?: string; source?: string }> = Array.isArray(student?.skills)
    ? student.skills
    : [];
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setForm({
      realName: student?.name || user?.realName || '',
      school: student?.school || '',
      major: student?.major || '',
      grade: student?.grade || '',
      phone: student?.phone || '',
      email: student?.email || '',
    });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await studentApi.updateProfile({
        name: form.realName,
        realName: form.realName,
        school: form.school,
        major: form.major,
        grade: form.grade,
        phone: form.phone,
        email: form.email,
      });
      toast.success('资料已保存');
      setForm(null);
      profile.reload();
    } catch (err: any) {
      toast.error('保存失败', err?.message || '');
    } finally {
      setSaving(false);
    }
  };

  const radarPoints: RadarPoint[] = (() => {
    const dims = radar.data?.radarDimensions || [];
    if (!Array.isArray(dims) || dims.length < 3) return [];
    return dims.map((dimension: any) => ({
      name: dimension.name || dimension.dimension || '维度',
      value: Number(dimension.score ?? dimension.value ?? 0),
    }));
  })();

  const displayName = user?.realName || user?.username || '学习者';
  const initial = displayName.slice(0, 1).toUpperCase();
  const username = user?.username || '—';
  const role = user?.role || 'student';

  return (
    <div className="col" style={{ gap: 18 }}>
      <header>
        <h2 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserRound size={18} style={{ color: 'var(--brand-600)' }} />
          用户中心
        </h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          个人资料与能力档案。这里的资料会参与学情诊断，改完之后新任务的生成会更贴你的情况。
        </p>
      </header>

      {/* 3D 能力画像：中心球 = 个人能力，技能节点按证据来源分布，球体大小 = 掌握度 */}
      <Card>
        <CardHead
          icon={<UserRound size={15} />}
          title="能力画像 3D"
          extra={<span className="tiny faint">拖拽旋转 · 点击节点查看详情</span>}
        />
        <CardBody>
          {profile.loading && !profile.data ? (
            <LoadingBlock text="正在读取能力档案" />
          ) : profileSkills.length === 0 ? (
            <Empty
              title="还没有画像技能"
              desc="完成 Onboarding 画像或学习技能后，这里会以 3D 立体图展示你的能力分布：来源、掌握度和证据可信度。"
            />
          ) : (
            <AbilityMap3D profileSkills={profileSkills} effectiveSkills={skills.data || []} />
          )}
        </CardBody>
      </Card>

      <div className="profile-dashboard-grid">
        <Card>
          <CardHead
            icon={<BadgeCheck size={15} />}
            title="基本资料"
            extra={
              !form && (
                <Button size="sm" variant="quiet" onClick={startEdit}>
                  编辑
                </Button>
              )
            }
          />
          <CardBody>
            <div className="row" style={{ gap: 12, marginBottom: 14, alignItems: 'center' }}>
              <span
                className="user-chip__avatar"
                style={{ width: 44, height: 44, fontSize: 18, display: 'grid', placeItems: 'center' }}
              >
                {initial}
              </span>
              <div className="col" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700 }}>{displayName}</span>
                <span className="row tiny faint" style={{ gap: 8 }}>
                  <span>@{username}</span>
                  <Tag tone={role === 'admin' ? 'violet' : 'brand'}>
                    {role === 'admin' ? '管理员' : '学习者'}
                  </Tag>
                </span>
              </div>
            </div>

            {profile.loading && !profile.data ? (
              <LoadingBlock text="正在读取资料" />
            ) : form ? (
              <div className="col" style={{ gap: 10 }}>
                <Field label="称呼">
                  <Input value={form.realName} onChange={(event: any) => setForm({ ...form, realName: event.target.value })} />
                </Field>
                <Field label="学校">
                  <Input value={form.school} placeholder="选填" onChange={(event: any) => setForm({ ...form, school: event.target.value })} />
                </Field>
                <Field label="专业 / 背景">
                  <Input value={form.major} placeholder="选填，例如：前端开发 / 机械制造" onChange={(event: any) => setForm({ ...form, major: event.target.value })} />
                </Field>
                <Field label="阶段">
                  <Input value={form.grade} placeholder="选填，例如：在校学生 / 1-3 年开发" onChange={(event: any) => setForm({ ...form, grade: event.target.value })} />
                </Field>
                <Field label="手机">
                  <Input value={form.phone} placeholder="选填" onChange={(event: any) => setForm({ ...form, phone: event.target.value })} />
                </Field>
                <Field label="邮箱">
                  <Input value={form.email} placeholder="选填" onChange={(event: any) => setForm({ ...form, email: event.target.value })} />
                </Field>
                <div className="row" style={{ gap: 10 }}>
                  <Button variant="primary" onClick={save} loading={saving}>
                    <Save size={14} />
                    保存
                  </Button>
                  <Button variant="ghost" onClick={() => setForm(null)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <div className="col" style={{ gap: 8 }}>
                <ProfileRow label="称呼" value={student?.name || user?.realName || '—'} />
                <ProfileRow label="学校" value={student?.school || '未填写'} />
                <ProfileRow label="专业 / 背景" value={student?.major || '未填写'} />
                <ProfileRow label="阶段" value={student?.grade || '未填写'} />
                <ProfileRow label="手机" value={student?.phone || '未填写'} />
                <ProfileRow label="邮箱" value={student?.email || '未填写'} />
              </div>
            )}
          </CardBody>
        </Card>

        <div className="col" style={{ gap: 16 }}>
          <Card>
            <CardHead icon={<UserRound size={15} />} title="能力雷达" />
            <CardBody>
              {radar.loading && !radar.data ? (
                <LoadingBlock text="正在计算能力雷达" />
              ) : radarPoints.length < 3 ? (
                <Empty
                  title="维度数据还不够"
                  desc="完成更多学习与测评后，领域维度会逐步点亮，这里会画出你的能力结构。"
                />
              ) : (
                <div style={{ display: 'grid', placeItems: 'center' }}>
                  <RadarChart points={radarPoints} />
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead
              icon={<BadgeCheck size={15} />}
              title="技能掌握度"
              extra={<span className="tiny faint">含可信权重</span>}
            />
            <CardBody>
              {skills.loading && !skills.data ? (
                <LoadingBlock text="正在读取技能档案" />
              ) : (skills.data || []).length === 0 ? (
                <Empty
                  title="还没有技能记录"
                  desc="完成讲义、测验或考试后，这里会列出每个能力项的掌握度与证据可信度。"
                  action={<Button variant="primary" onClick={() => navigate('/path')}>去学习路径</Button>}
                />
              ) : (
                <div className="col" style={{ gap: 10 }}>
                  {(skills.data || []).map((skill) => {
                    const pct = Math.round(Number(skill.masteryPct) || 0);
                    return (
                      <div className="col" key={skill.name} style={{ gap: 4 }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span className="small grow truncate" style={{ minWidth: 0, fontWeight: 600 }}>{skill.name}</span>
                          <span className="tiny faint">可信 {Math.round((Number(skill.trustWeight) || 0) * 100)}%</span>
                          <span className="small" style={{ fontWeight: 700, color: pct >= 60 ? 'var(--green-600)' : 'var(--amber-600)' }}>{pct}%</span>
                        </div>
                        <Bar value={pct} tone={pct >= 60 ? 'green' : 'amber'} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Metric label="账号" value={username} />
            <Metric label="角色" value={role === 'admin' ? '管理员' : '学习者'} />
          </div>
          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <Button
              variant="ghost"
              onClick={() => {
                disconnectStream();
                logout();
                toast.info('已退出登录');
                navigate('/', { replace: true });
              }}
            >
              <LogOut size={14} />
              退出登录
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <span className="small faint" style={{ width: 84, flexShrink: 0 }}>{label}</span>
      <span className="small" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  );
}
