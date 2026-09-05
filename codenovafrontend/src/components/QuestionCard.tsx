import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Markdown } from './Markdown';
import { Input, Textarea, Tag } from './ui';

/**
 * 统一的题目作答卡 —— 补弱练习与考试作答共用。
 *
 * 后端题目有两套来源，字段名不完全一致：
 *   - 题库/考试快照（exam_questions_v3）：title + content.options
 *   - 出题器快照（question_generation）：stem + options
 * 这里统一取值，并给出可判分的 gradeQuestion，避免两个页面各写一套判分逻辑。
 */

export type PracticeQuestion = {
  id?: number | string;
  type?: string;
  stem?: string;
  title?: string;
  options?: Array<{ key?: string; text?: string }>;
  content?: { options?: Array<{ key?: string; text?: string }>; [key: string]: any };
  answer?: any;
  solution?: string;
  explanation?: string;
  difficulty?: number;
  metadata?: Record<string, any>;
  [key: string]: any;
};

/** 用户作答值：单选存选项 key，多选存 key 数组，填空/编程存文本 */
export type AnswerValue = string | string[] | null;

export function questionStem(q: PracticeQuestion): string {
  return String(q.stem || q.title || '').trim();
}

export function questionOptions(q: PracticeQuestion): Array<{ key: string; text: string }> {
  const raw = q.options || q.content?.options || [];
  return (Array.isArray(raw) ? raw : [])
    .map((opt: any, index: number) => ({
      // 考试快照的选项是字符串数组：key 取位置索引，交卷时可以还原成服务端的数字答案
      key: String(opt?.key ?? index),
      text: String(opt?.text ?? (typeof opt === 'object' ? JSON.stringify(opt) : opt ?? '')),
    }))
    .filter((opt) => opt.text);
}

export function questionKind(q: PracticeQuestion): 'choice' | 'fill' | 'code' {
  const type = String(q.type || '').toLowerCase();
  // 注意：'coding' 不包含子串 'code'，必须显式列出
  if (type === 'coding' || type.includes('code') || type.includes('program')) return 'code';
  if (questionOptions(q).length > 0) return 'choice';
  return 'fill';
}

export function isMultiAnswer(q: PracticeQuestion): boolean {
  return questionKind(q) === 'choice' && Array.isArray(q.answer) && q.answer.length > 1;
}

const TYPE_LABEL: Record<string, string> = {
  choice: '单选题',
  single: '单选题',
  single_choice: '单选题',
  multi: '多选题',
  multi_choice: '多选题',
  fill: '填空题',
  blank: '填空题',
  judge: '判断题',
  code: '编程题',
  coding: '编程题',
  programming: '编程题',
  essay: '简答题',
  short_answer: '简答题',
};

export function questionTypeLabel(q: PracticeQuestion): string {
  const key = String(q.type || '').toLowerCase();
  return TYPE_LABEL[key] || (questionKind(q) === 'choice' ? '选择题' : questionKind(q) === 'code' ? '编程题' : '填空题');
}

/** 判分：choice 按选项 key 比对，fill 按归一化文本比对，code 交给解析自查（返回 null） */
export function gradeQuestion(q: PracticeQuestion, picked: AnswerValue): boolean | null {
  const kind = questionKind(q);

  if (kind === 'choice') {
    const options = questionOptions(q);
    const answer = q.answer;
    let correctKeys: string[];
    if (Array.isArray(answer)) {
      correctKeys = answer.map((item) => optionKeyFromAnswer(item, options));
    } else {
      correctKeys = [optionKeyFromAnswer(answer, options)];
    }
    if (correctKeys.some((key) => !key)) return null;
    const pickedKeys = Array.isArray(picked) ? picked : picked != null && picked !== '' ? [String(picked)] : [];
    return (
      correctKeys.length === pickedKeys.length && correctKeys.every((key) => pickedKeys.includes(key))
    );
  }

  if (kind === 'fill') {
    const expected = Array.isArray(q.answer) ? q.answer : [q.answer];
    const normalizedExpect = expected.map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean);
    const pickedText = String(Array.isArray(picked) ? picked.join(',') : picked ?? '').trim().toLowerCase();
    if (normalizedExpect.length === 0) return null;
    return normalizedExpect.includes(pickedText);
  }

  return null;
}

function optionKeyFromAnswer(answer: any, options: Array<{ key: string; text: string }>): string {
  if (typeof answer === 'number') return options[answer]?.key ?? String(answer);
  const text = String(answer ?? '');
  if (!text) return '';
  const byKey = options.find((opt) => opt.key === text);
  if (byKey) return byKey.key;
  const byText = options.find((opt) => opt.text === text);
  if (byText) return byText.key;
  if (/^\d+$/.test(text)) return options[Number(text)]?.key ?? text;
  return text;
}

/** 展示用：把后端答案归一成可读文本（"正确答案 C" / "答案内容"） */
export function answerLabel(q: PracticeQuestion): string {
  if (questionKind(q) === 'choice') {
    const options = questionOptions(q);
    const keys = (Array.isArray(q.answer) ? q.answer : [q.answer]).map((item) => optionKeyFromAnswer(item, options));
    return keys
      .map((key) => {
        const index = options.findIndex((opt) => opt.key === key);
        return index >= 0 ? String.fromCharCode(65 + index) : key;
      })
      .filter(Boolean)
      .join('、');
  }
  return (Array.isArray(q.answer) ? q.answer : [q.answer]).map((item) => String(item ?? '')).filter(Boolean).join(' / ');
}

export function QuestionCard({
  index,
  question,
  value,
  onChange,
  disabled,
  footer,
}: {
  index: number;
  question: PracticeQuestion;
  value: AnswerValue;
  onChange: (next: AnswerValue) => void;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  const kind = questionKind(question);
  const options = questionOptions(question);
  const multi = isMultiAnswer(question);
  const stem = questionStem(question);

  const toggleMulti = (key: string) => {
    const current = Array.isArray(value) ? value : value ? [String(value)] : [];
    onChange(current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  return (
    <article className="card question-card" style={{ padding: '14px 16px' }}>
      <header className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="tag tag--outline">第 {index + 1} 题</span>
        <Tag tone={kind === 'choice' ? 'brand' : kind === 'code' ? 'teal' : 'violet'}>
          {questionTypeLabel(question)}
          {multi ? ' · 多选' : ''}
        </Tag>
        {typeof question.difficulty === 'number' && question.difficulty > 0 && (
          <span className="tiny faint">难度 {question.difficulty}/10</span>
        )}
      </header>

      <div className="question-card__stem" style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 10 }}>
        <Markdown source={stem || '（题目内容缺失）'} />
      </div>

      {kind === 'choice' && (
        <div className="q-options" role="radiogroup" style={{ display: 'grid', gap: 10 }}>
          {options.map((opt, optIndex) => {
            const label = `${String.fromCharCode(65 + optIndex)}`;
            const isSelected = multi
              ? Array.isArray(value) && value.includes(opt.key)
              : value === opt.key;
            const onClick = () => (multi ? toggleMulti(opt.key) : onChange(opt.key));
            return (
              <button
                key={opt.key}
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={isSelected}
                aria-disabled={disabled}
                disabled={disabled}
                onClick={onClick}
                className="q-option"
              >
                <span className="q-option__mark" aria-hidden="true">
                  {label}
                  {isSelected && (
                    <span className="q-option__check">
                      <CheckCircle2 size={14} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="q-option__text">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {kind === 'fill' && (
        <div style={{ marginTop: 10 }}>
          <Input
            placeholder="填写你的答案"
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onChange={(event: any) => onChange(event.target.value)}
          />
        </div>
      )}

      {kind === 'code' && (
        <div style={{ marginTop: 10 }}>
          <Textarea
            rows={5}
            placeholder="写下你的实现或思路（编程题对照解析自查）"
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onChange={(event: any) => onChange(event.target.value)}
          />
        </div>
      )}

      {footer && <div style={{ marginTop: 10 }}>{footer}</div>}
    </article>
  );
}
