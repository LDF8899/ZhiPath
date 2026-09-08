import { useState } from 'react';
import { CheckCircle2, KeyRound, Save, Server, Trash2 } from 'lucide-react';
import { userLlmApi, type LlmProviderOption, type UserLlmConfig } from '../lib/api';
import { Button, Card, CardBody, CardHead, Field, Input, Tag } from './ui';
import { toast } from '../store/toast';

/**
 * AI 服务商配置卡片 — 个人中心
 *
 * 用户按预算自选服务商并自带 API Key。key 加密存于后端，云端 AI 请求走后端代理，
 * 产生的 token 费用进用户自己的服务商账户（平台不再为个人请求全额买单）。
 */

interface AiProviderCardProps {
  config: UserLlmConfig | null;
  providers: LlmProviderOption[];
  loading: boolean;
  reload: () => void;
}

export default function AiProviderCard({ config, providers, loading, reload }: AiProviderCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<string>(config?.provider || providers[0]?.id || '');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState<string>(config?.baseUrl || '');

  const current = providers.find((p) => p.id === (editing ? provider : config?.provider)) || providers[0];

  const startEdit = () => {
    setProvider(config?.provider || providers[0]?.id || '');
    setApiKey('');
    setBaseUrl(config?.baseUrl || '');
    setEditing(true);
  };

  const canClear = Boolean(config?.configured);

  const clearConfig = async () => {
    if (!window.confirm('确定清空你的 AI 服务商配置？之后将回落使用平台默认模型。')) return;
    setSaving(true);
    try {
      await userLlmApi.clear();
      toast.info('已清空，回落到平台默认模型');
      setEditing(false);
      reload();
    } catch (err: any) {
      toast.error('清空失败', err?.message || '');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const chosen = providers.find((p) => p.id === provider);
    if (!chosen) {
      toast.error('请选择服务商');
      return;
    }
    if (chosen.needsApiKey && !apiKey.trim() && config?.provider !== chosen.id) {
      toast.error('请填写该服务商的 API Key');
      return;
    }
    setSaving(true);
    try {
      const result: any = await userLlmApi.save({
        provider: chosen.id,
        apiKey: apiKey.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
      });
      if (result && result.ok === false) {
        toast.error('保存失败', result.message || '');
        return;
      }
      toast.success('AI 服务商已保存');
      setEditing(false);
      setApiKey('');
      reload();
    } catch (err: any) {
      toast.error('保存失败', err?.message || '');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHead icon={<Server size={15} />} title="AI 服务商" />
        <CardBody>
          <p className="small muted">正在读取你的 AI 服务商配置…</p>
        </CardBody>
      </Card>
    );
  }

  const configured = Boolean(config?.configured);
  const pageKey = config?.keyMasked || null;

  return (
    <Card>
      <CardHead
        icon={<KeyRound size={15} />}
        title="AI 服务商"
        extra={
          !editing && (
            <div className="row" style={{ gap: 8 }}>
              {canClear && (
                <Button size="sm" variant="quiet" onClick={clearConfig} loading={saving}>
                  <Trash2 size={14} />
                  清除
                </Button>
              )}
              <Button size="sm" variant="quiet" onClick={startEdit}>
                编辑
              </Button>
            </div>
          )
        }
      />
      <CardBody>
        {!editing ? (
          <div className="col" style={{ gap: 12 }}>
            {configured ? (
              <>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{current?.label || config?.provider}</span>
                  <Tag tone="brand">已启用</Tag>
                  {current?.needsApiKey && pageKey && (
                    <span className="tiny faint grow truncate" style={{ minWidth: 0 }}>
                      Key {pageKey}
                    </span>
                  )}
                </div>
                {config?.baseUrl && (
                  <p className="small muted" style={{ wordBreak: 'break-all' }}>Base URL：{config.baseUrl}</p>
                )}
                <p className="small muted">
                  你的 AI 请求通过后端代理，使用你自己的 Key，token 费用进入你的服务商账户。
                </p>
              </>
            ) : (
              <div className="col" style={{ gap: 8 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--green-600)' }} />
                  <span className="small">当前使用平台默认模型（无需配置）</span>
                </div>
                <p className="small muted">
                  如果你有自己的 AI Key，可按预算自选服务商，产生的费用由你的 Key 承担。
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            <Field label="服务商">
              <div className="col" style={{ gap: 8 }}>
                {providers.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="choice"
                    aria-pressed={option.id === provider}
                    onClick={() => setProvider(option.id)}
                    style={{ textAlign: 'left' }}
                  >
                    {option.id === provider && (
                      <span className="choice__check">
                        <CheckCircle2 size={12} strokeWidth={3} />
                      </span>
                    )}
                    <span className="choice__title">{option.label}</span>
                    <span className="choice__desc">{option.note}</span>
                  </button>
                ))}
              </div>
            </Field>

            {current?.needsApiKey && (
              <Field
                label="API Key"
                hint={config?.provider === current.id && config?.keyMasked ? `已保存：${config.keyMasked}，留空则沿用` : undefined}
              >
                <Input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  placeholder={current.needsApiKey ? '填入你自己的 ' + current.label + ' Key' : '本地服务空 key 即可'}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setApiKey(event.target.value)}
                />
              </Field>
            )}

            <Field label="Base URL（可选）" hint="OpenAI 兼容端点可自定义，默认使用该服务商官方地址">
              <Input
                type="text"
                value={baseUrl}
                placeholder={current?.defaultBaseUrl || ''}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBaseUrl(event.target.value)}
              />
            </Field>

            <div className="row" style={{ gap: 10, marginTop: 6 }}>
              <Button variant="primary" onClick={save} loading={saving}>
                <Save size={14} />
                保存
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                取消
              </Button>
            </div>
            <p className="tiny faint">
              API Key 仅加密存储于后端服务器，用于云端代理调用，永不会在你浏览器本地暴露明文。
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
