export type ChatAttachedFile = {
  name: string;
  size: number;
  type: string;
  content: string;
  truncated: boolean;
};

const MAX_FILE_CHARS = 16000;
const MAX_FILE_BYTES = 1024 * 1024;

const SUPPORTED_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'ts',
  'tsx',
  'js',
  'jsx',
  'html',
  'css',
  'scss',
  'less',
  'xml',
  'yml',
  'yaml',
  'sql',
  'log',
]);

export const CHAT_FILE_ACCEPT = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.html',
  '.css',
  '.scss',
  '.less',
  '.xml',
  '.yml',
  '.yaml',
  '.sql',
  '.log',
].join(',');

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getExtension(name: string) {
  const part = name.split('.').pop();
  return part ? part.toLowerCase() : '';
}

export function isSupportedChatFile(file: File) {
  if (file.type.startsWith('text/')) return true;
  if (file.type === 'application/json') return true;
  return SUPPORTED_EXTENSIONS.has(getExtension(file.name));
}

export async function readChatAttachedFile(file: File): Promise<ChatAttachedFile> {
  if (!isSupportedChatFile(file)) {
    throw new Error('当前仅支持 txt、md、csv、json 和代码类文本文件');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('文件过大，请先上传 1MB 以内的文本内容');
  }

  const raw = await file.text();
  const normalized = raw.replace(/\u0000/g, '').trim();
  if (!normalized) {
    throw new Error('文件内容为空，换一个文件试试');
  }

  const truncated = normalized.length > MAX_FILE_CHARS;
  return {
    name: file.name,
    size: file.size,
    type: file.type || getExtension(file.name) || 'text',
    content: truncated ? normalized.slice(0, MAX_FILE_CHARS) : normalized,
    truncated,
  };
}

export function buildQuestionWithFileContext(question: string, file: ChatAttachedFile) {
  return [
    '请基于我上传的文件回答问题。优先引用文件内容，不要编造文件中没有的信息。',
    `文件名：${file.name}`,
    `文件大小：${formatFileSize(file.size)}`,
    file.truncated ? '说明：文件内容较长，以下为前半部分截取内容。' : '',
    '文件内容：',
    '```',
    file.content,
    '```',
    `用户问题：${question}`,
  ].filter(Boolean).join('\n');
}

