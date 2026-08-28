import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { resolveMotionStyle } from './motion/presets';
import {
  isMotionStyleId,
  isVisualStyleId,
  type MotionStyleId,
  type VisualStyleId,
} from './motion/types';

type AssetKind = 'screenshot' | 'diagram';
type LlmProvider = 'auto' | 'off' | 'openai' | 'deepseek' | 'mimo' | 'custom';
type TtsEngine = 'edge';

interface CliOptions {
  prompt: string;
  duration: number;
  assets?: string;
  output: string;
  projectName: string;
  voice: string;
  rate: string;
  jobId: string;
  llm?: boolean;
  llmProvider: LlmProvider;
  llmModel?: string;
  llmBaseUrl?: string;
  llmInputPricePerMTok: number;
  llmOutputPricePerMTok: number;
  ttsEngine: TtsEngine;
  visualStyle: VisualStyleId | 'auto';
  motionStyle?: MotionStyleId;
}

interface MediaAsset {
  sourcePath: string;
  staticPath: string;
  kind: AssetKind;
  name: string;
}

interface ScenePlan {
  id: string;
  chapter: string;
  title: string;
  subtitle?: string;
  asset: string;
  assetKind: AssetKind;
  narration: string;
  durationSec: number;
  focus?: { x: number; y: number; scaleStart: number; scaleEnd: number };
  callouts?: Array<{ text: string; x: number; y: number }>;
  stats?: Array<{ label: string; value: string }>;
}

interface AudioSegment {
  id: string;
  file_path: string;
  duration_sec: number;
  voice: string;
}

interface Manifest {
  title: string;
  projectName: string;
  footerText: string;
  generatedAt: string;
  prompt: string;
  targetDurationSec: number;
  scenes: ScenePlan[];
  audioSegments: AudioSegment[];
  visualStyle: VisualStyleId;
  motionStyle: MotionStyleId;
  generation?: {
    llm: LlmRuntimeInfo;
    tts: TtsRuntimeInfo;
    cost: CostSummary;
  };
}

interface LlmRuntimeInfo {
  provider: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
  usedFallback: boolean;
}

interface TtsRuntimeInfo {
  engine: TtsEngine;
  voice: string;
  rate: string;
  quality: string;
}

interface CostSummary {
  currency: 'USD';
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  estimatedInputCost: number;
  estimatedOutputCost: number;
  estimatedTotalCost: number;
  source: 'api-usage' | 'fallback' | 'disabled' | 'unavailable';
}

interface LlmResult {
  scenes: ScenePlan[];
  runtime: LlmRuntimeInfo;
  cost: CostSummary;
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const TEXT_EXTS = new Set(['.md', '.txt']);
const MAX_TEXT_CHARS = 12000; // max total chars from text assets to fit LLM context
const HEARTBEAT_INTERVAL_MS = Number(process.env.VIBING_CLI_HEARTBEAT_MS || 10000);
const PROVIDER_DEFAULTS: Record<string, { model: string; baseUrl: string; inputPricePerMTok: number; outputPricePerMTok: number }> = {
  openai: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', inputPricePerMTok: 0.15, outputPricePerMTok: 0.6 },
  deepseek: { model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', inputPricePerMTok: 0.27, outputPricePerMTok: 1.1 },
  mimo: { model: 'mimo-vl-7b', baseUrl: '', inputPricePerMTok: 0, outputPricePerMTok: 0 },
  custom: { model: 'custom-chat-model', baseUrl: '', inputPricePerMTok: 0, outputPricePerMTok: 0 },
};

function parseArgs(argv: string[]): CliOptions {
  const get = (name: string, fallback = '') => {
    const idx = argv.indexOf(name);
    return idx >= 0 ? argv[idx + 1] || fallback : fallback;
  };
  const has = (name: string) => argv.includes(name);
  const prompt = get('--prompt');
  if (!prompt) {
    throw new Error('Missing --prompt "video topic or requirements"');
  }
  const llmProvider = (has('--no-llm') ? 'off' : get('--llm-provider', process.env.VIBING_LLM_PROVIDER || 'auto')) as LlmProvider;
  const providerDefaults = PROVIDER_DEFAULTS[llmProvider] || PROVIDER_DEFAULTS.openai;
  const requestedVisualStyle = get('--visual-style', 'auto');
  const requestedMotionStyle = get('--motion-style');
  if (requestedVisualStyle !== 'auto' && !isVisualStyleId(requestedVisualStyle)) {
    throw new Error(`Unknown visual style: ${requestedVisualStyle}`);
  }
  if (requestedMotionStyle && !isMotionStyleId(requestedMotionStyle)) {
    throw new Error(`Unknown motion style: ${requestedMotionStyle}`);
  }
  return {
    prompt,
    duration: Number(get('--duration', '300')) || 300,
    assets: get('--assets') || undefined,
    output: get('--output', 'public/vibing-output/vibing-video.mp4'),
    projectName: get('--project-name', 'Vibing Video'),
    voice: get('--voice', 'zh-CN-YunyangNeural'),
    rate: get('--rate', '+0%'),
    jobId: get('--job-id', `cli-${Date.now()}`),
    llm: !has('--no-llm'),
    llmProvider,
    llmModel: get('--llm-model', process.env.VIBING_LLM_MODEL || providerDefaults.model),
    llmBaseUrl: get('--llm-base-url', process.env.VIBING_LLM_BASE_URL || providerDefaults.baseUrl),
    llmInputPricePerMTok: Number(get('--llm-input-price', String(providerDefaults.inputPricePerMTok))) || 0,
    llmOutputPricePerMTok: Number(get('--llm-output-price', String(providerDefaults.outputPricePerMTok))) || 0,
    ttsEngine: (get('--tts-engine', 'edge') as TtsEngine) || 'edge',
    visualStyle: requestedVisualStyle as VisualStyleId | 'auto',
    motionStyle: requestedMotionStyle as MotionStyleId | undefined,
  };
}

function inferVisualStyle(prompt: string): VisualStyleId {
  const normalized = prompt.toLowerCase();
  if (/(terminal|console|command|cli|code|developer|终端|命令行|代码|开发者)/i.test(normalized)) {
    return 'terminal-grid';
  }
  if (/(luxury|launch|automotive|cinematic|premium|奢侈|发布会|汽车|电影感|高端)/i.test(normalized)) {
    return 'cinematic-product';
  }
  if (/(saas|dashboard|analytics|workflow|productivity|数据|仪表盘|工作流|效率)/i.test(normalized)) {
    return 'precision-mono';
  }
  return 'editorial-paper';
}

function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf-8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function safeName(name: string, index: number) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext).replace(/[^\w\u4e00-\u9fa5-]+/g, '-').slice(0, 60);
  return `${String(index + 1).padStart(2, '0')}-${base || 'asset'}${ext}`;
}

function scanAssets(sourceDir: string | undefined, jobDir: string): MediaAsset[] {
  const assetsDir = path.join(jobDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  if (!sourceDir) return [];
  const root = path.resolve(sourceDir);
  if (!fs.existsSync(root)) throw new Error(`Assets folder not found: ${root}`);

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) files.push(full);
    }
  };
  walk(root);
  files.sort((a, b) => a.localeCompare(b, 'zh-CN'));

  return files.map((file, index) => {
    const dest = safeName(path.basename(file), index);
    const destPath = path.join(assetsDir, dest);
    fs.copyFileSync(file, destPath);
    return {
      sourcePath: file,
      staticPath: `vibing/jobs/${path.basename(jobDir)}/assets/${dest}`,
      kind: inferKind(file),
      name: path.basename(file),
    };
  });
}

function inferKind(file: string): AssetKind {
  const lower = file.toLowerCase();
  return lower.includes('architecture') || lower.includes('diagram') || lower.includes('flow') || lower.includes('process')
    ? 'diagram'
    : 'screenshot';
}

interface TextAsset {
  name: string;
  content: string;
}

function scanTextAssets(sourceDir: string | undefined): TextAsset[] {
  if (!sourceDir) return [];
  const root = path.resolve(sourceDir);
  if (!fs.existsSync(root)) return [];

  const results: TextAsset[] = [];
  let totalChars = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      const ext = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTS.has(ext)) continue;
      try {
        const raw = fs.readFileSync(full, 'utf-8');
        const remaining = MAX_TEXT_CHARS - totalChars;
        if (remaining <= 0) break;
        const snippet = raw.length > remaining ? raw.slice(0, remaining) + '\n...(truncated)' : raw;
        results.push({ name: entry.name, content: snippet });
        totalChars += snippet.length;
      } catch { /* skip unreadable */ }
    }
  };
  walk(root);
  return results;
}

function sceneCountForDuration(duration: number) {
  return Math.max(5, Math.min(24, Math.round(duration / 16)));
}

function fallbackScenes(opts: CliOptions, assets: MediaAsset[]): ScenePlan[] {
  const count = Math.max(5, Math.min(sceneCountForDuration(opts.duration), Math.max(assets.length, 6)));
  const per = opts.duration / count;
  const selected = assets.length ? assets : createPlaceholderAssets(count);
  const ideas = [
    'Opening',
    'Core Value',
    'Workflow',
    'Key Capability',
    'Live Demo',
    'Technical Support',
    'Highlights',
    'Wrap Up',
  ];

  return Array.from({ length: count }).map((_, index) => {
    const asset = selected[index % selected.length];
    const idea = ideas[index % ideas.length];
    const focus = focusPreset(index, asset.kind);
    const callout = calloutPreset(index);
    return {
      id: `scene_${String(index + 1).padStart(2, '0')}`,
      chapter: `${String(index + 1).padStart(2, '0')} ${idea}`,
      title: index === 0 ? opts.projectName : `${idea}: ${asset.name.replace(/\.[^.]+$/, '')}`,
      subtitle: opts.prompt.slice(0, 90),
      asset: asset.staticPath,
      assetKind: asset.kind,
      narration: buildFallbackNarration(opts.prompt, asset.name, index, count),
      durationSec: Math.max(8, per),
      focus,
      callouts: [{ text: index === 0 ? 'Generated from prompt and uploaded assets' : 'Focus point extracted from source material', ...callout }],
      stats: [
        { label: 'Target', value: `${Math.round(opts.duration / 60)} min` },
        { label: 'Asset', value: `${index + 1}` },
      ],
    };
  });
}

function focusPreset(index: number, kind: AssetKind) {
  const presets = [
    { x: 42, y: 46 },
    { x: 63, y: 50 },
    { x: 52, y: 36 },
    { x: 46, y: 62 },
    { x: 68, y: 58 },
    { x: 38, y: 54 },
  ];
  const point = presets[index % presets.length];
  return {
    x: point.x,
    y: point.y,
    scaleStart: kind === 'diagram' ? 1.01 : 1.015,
    scaleEnd: kind === 'diagram' ? 1.09 : 1.14,
  };
}

function calloutPreset(index: number) {
  const presets = [
    { x: 62, y: 46 },
    { x: 45, y: 58 },
    { x: 68, y: 38 },
    { x: 42, y: 64 },
    { x: 58, y: 56 },
    { x: 72, y: 52 },
  ];
  return presets[index % presets.length];
}

function createPlaceholderAssets(count: number): MediaAsset[] {
  return Array.from({ length: count }).map((_, index) => ({
    sourcePath: '',
    staticPath: '__placeholder__',
    kind: 'diagram' as const,
    name: `asset ${index + 1}`,
  }));
}

function buildFallbackNarration(prompt: string, assetName: string, index: number, count: number) {
  if (index === 0) {
    return `This video is generated from the request: ${prompt}. We will move through the provided material in order, turning the topic, evidence, interface screens, and final takeaways into one clear project story.`;
  }
  if (index === count - 1) {
    return `To close, we return to the main goal: ${prompt}. The video connects the uploaded material into a complete demo, and the same pipeline can be rerun with new assets, timing, voice, or a different model prompt.`;
  }
  return `This segment focuses on ${assetName}. The shot keeps the source material readable, then uses title, callout, and motion to make the key point clear without forcing viewers to inspect every detail.`;
}

function disabledCost(
  provider: string,
  model: string,
  source: CostSummary['source'],
  inputPricePerMTok = 0,
  outputPricePerMTok = 0,
): CostSummary {
  return {
    currency: 'USD',
    provider,
    model,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    inputPricePerMTok,
    outputPricePerMTok,
    estimatedInputCost: 0,
    estimatedOutputCost: 0,
    estimatedTotalCost: 0,
    source,
  };
}

function estimateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  inputPricePerMTok: number,
  outputPricePerMTok: number,
  source: CostSummary['source'],
): CostSummary {
  const estimatedInputCost = (inputTokens / 1_000_000) * inputPricePerMTok;
  const estimatedOutputCost = (outputTokens / 1_000_000) * outputPricePerMTok;
  return {
    currency: 'USD',
    provider,
    model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputPricePerMTok,
    outputPricePerMTok,
    estimatedInputCost,
    estimatedOutputCost,
    estimatedTotalCost: estimatedInputCost + estimatedOutputCost,
    source,
  };
}

function resolveLlmSettings(opts: CliOptions) {
  if (!opts.llm || opts.llmProvider === 'off') return null;

  const providerKey = (provider: string) => {
    if (process.env.VIBING_LLM_API_KEY) return process.env.VIBING_LLM_API_KEY;
    if (provider === 'openai') return process.env.OPENAI_API_KEY;
    if (provider === 'deepseek') return process.env.DEEPSEEK_API_KEY;
    if (provider === 'mimo') return process.env.MIMO_API_KEY;
    return process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.MIMO_API_KEY;
  };

  const candidates =
    opts.llmProvider === 'auto'
      ? [
          { provider: 'openai', apiKey: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_BASE_URL, model: process.env.OPENAI_MODEL },
          { provider: 'deepseek', apiKey: process.env.DEEPSEEK_API_KEY, baseUrl: process.env.DEEPSEEK_BASE_URL, model: process.env.DEEPSEEK_MODEL },
          { provider: 'mimo', apiKey: process.env.MIMO_API_KEY, baseUrl: process.env.MIMO_BASE_URL, model: process.env.MIMO_MODEL },
        ]
      : [
          {
            provider: opts.llmProvider,
            apiKey: providerKey(opts.llmProvider),
            baseUrl: opts.llmBaseUrl || process.env.VIBING_LLM_BASE_URL,
            model: opts.llmModel || process.env.VIBING_LLM_MODEL,
          },
        ];

  for (const item of candidates) {
    const defaults = PROVIDER_DEFAULTS[item.provider] || PROVIDER_DEFAULTS.custom;
    const apiKey = item.apiKey;
    if (!apiKey) continue;
    const baseUrl = item.baseUrl || defaults.baseUrl;
    const model = item.model || defaults.model;
    if (!baseUrl || !model) continue;
    return {
      provider: item.provider,
      apiKey,
      baseUrl,
      model,
    };
  }
  return null;
}

async function generateScenesWithLlm(opts: CliOptions, assets: MediaAsset[], textAssets: TextAsset[]): Promise<LlmResult | null> {
  const settings = resolveLlmSettings(opts);
  if (!settings) return null;
  const { apiKey, baseUrl, model, provider } = settings;
  const sceneCount = sceneCountForDuration(opts.duration);
  const assetList = assets.map((a, i) => ({ index: i, name: a.name, kind: a.kind })).slice(0, 80);

  // Build text context from scanned .md/.txt files
  let textContext = '';
  if (textAssets.length > 0) {
    const parts = textAssets.map(t => `=== ${t.name} ===\n${t.content}`);
    textContext = `\nReference materials (use these for accurate product details, features, and terminology):\n${parts.join('\n\n')}`;
  }
  const system = [
    'You are a cinematic product-demo video director and motion designer.',
    'Return strict JSON only. Do not use Markdown.',
    'Narration should follow the user language. If the prompt is Chinese, write natural spoken Chinese.',
    'Avoid slide-deck pacing. Design scenes as live demo shots with camera focus, movement, and on-screen evidence.',
  ].join(' ');
  const user = [
    `Create a storyboard JSON for a video of about ${opts.duration} seconds.`,
    `User request: ${opts.prompt}`,
    `Project name: ${opts.projectName}`,
    `Suggested scene count: ${sceneCount}`,
    `Available assets: ${JSON.stringify(assetList)}`,
    textContext,
    '',
    'Output shape:',
    '{"scenes":[{"chapter":"","title":"","subtitle":"","assetIndex":0,"assetKind":"screenshot","narration":"","callouts":[{"text":"","x":58,"y":50}],"stats":[{"label":"","value":""}],"focus":{"x":50,"y":50,"scaleStart":1.01,"scaleEnd":1.08}}]}',
    '',
    'Rules:',
    '- narration should be natural voiceover, about 45 to 90 Chinese characters or 25 to 55 English words per scene.',
    '- assetIndex must reference the available asset list; reuse assets if needed.',
    '- title should be short; subtitle should explain the screen value in one sentence.',
    '- use at most 2 callouts and at most 2 stats per scene.',
    '- focus should vary between scenes and point to the most important visible area, not always the center.',
    '- prefer action words and real demo language over PPT summary language.',
    '- do not invent features that are not visible or implied by the assets and request.',
  ].join('\n');

  const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
    }),
  });
  if (!resp.ok) {
    console.warn(`[LLM] failed ${resp.status}: ${(await resp.text()).slice(0, 160)}`);
    return null;
  }
  const data: any = await resp.json();
  const usage = data.usage || {};
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0;
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0;
  const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens) || inputTokens + outputTokens;
  const cost = estimateCost(
    provider,
    model,
    inputTokens || Math.max(0, totalTokens - outputTokens),
    outputTokens,
    opts.llmInputPricePerMTok,
    opts.llmOutputPricePerMTok,
    inputTokens || outputTokens || totalTokens ? 'api-usage' : 'unavailable',
  );
  console.log(`[cost] ${JSON.stringify(cost)}`);

  const text = String(data.choices?.[0]?.message?.content || '').replace(/^```json\s*|\s*```$/g, '');
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.scenes)) return null;
  const per = opts.duration / parsed.scenes.length;
  const fallbackAssets = assets.length ? assets : createPlaceholderAssets(parsed.scenes.length);

  const scenes = parsed.scenes.map((scene: any, index: number) => {
    const asset = fallbackAssets[Number(scene.assetIndex)] || fallbackAssets[index % fallbackAssets.length];
    return {
      id: `scene_${String(index + 1).padStart(2, '0')}`,
      chapter: String(scene.chapter || `${String(index + 1).padStart(2, '0')} Scene`),
      title: String(scene.title || `Scene ${index + 1}`),
      subtitle: scene.subtitle ? String(scene.subtitle) : undefined,
      asset: asset.staticPath,
      assetKind: (scene.assetKind === 'diagram' ? 'diagram' : asset.kind) || 'screenshot',
      narration: String(scene.narration || buildFallbackNarration(opts.prompt, asset.name, index, parsed.scenes.length)),
      durationSec: Math.max(8, per),
      focus: scene.focus || focusPreset(index, asset.kind),
      callouts: Array.isArray(scene.callouts) ? scene.callouts.slice(0, 2) : [],
      stats: Array.isArray(scene.stats) ? scene.stats.slice(0, 2) : [],
    };
  });
  return {
    scenes,
    runtime: {
      provider,
      model,
      baseUrl,
      enabled: true,
      usedFallback: false,
    },
    cost,
  };
}

function convertVttTime(time: string) {
  const match = time.match(/^(\d+):(\d{2}):(\d{2})[\.,](\d{3})$/);
  if (!match) throw new Error(`Invalid VTT time: ${time}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function vttDuration(vttPath: string) {
  const text = fs.readFileSync(vttPath, 'utf-8');
  let last = 0;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/-->\s*(\d+:\d{2}:\d{2}[\.,]\d{3})/);
    if (match) last = Math.max(last, convertVttTime(match[1]));
  }
  return Math.max(1, last + 0.45);
}

function synthesizeEdge(scene: ScenePlan, audioDir: string, voice: string, rate: string): AudioSegment {
  fs.mkdirSync(audioDir, { recursive: true });
  const txt = path.join(audioDir, `${scene.id}.txt`);
  const mp3 = path.join(audioDir, `${scene.id}.mp3`);
  const vtt = path.join(audioDir, `${scene.id}.vtt`);
  fs.writeFileSync(txt, scene.narration, 'utf-8');
  execFileSync('python', ['-m', 'edge_tts', '--file', txt, '--voice', voice, '--rate', rate, '--write-media', mp3, '--write-subtitles', vtt], {
    stdio: 'pipe',
    timeout: 60000,
  });
  fs.rmSync(txt, { force: true });
  return { id: scene.id, file_path: mp3, duration_sec: vttDuration(vtt), voice };
}

function synthesizeTts(scene: ScenePlan, audioDir: string, opts: CliOptions): AudioSegment {
  if (opts.ttsEngine !== 'edge') {
    throw new Error(`Unsupported TTS engine: ${opts.ttsEngine}`);
  }
  return synthesizeEdge(scene, audioDir, opts.voice, opts.rate);
}

function emitHeartbeat(packet: Record<string, unknown>) {
  const memory = process.memoryUsage();
  console.log(`[heartbeat] ${JSON.stringify({
    schema: 'vibing-heartbeat/v1',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
    rssMb: Math.round(memory.rss / 1024 / 1024),
    heapMb: Math.round(memory.heapUsed / 1024 / 1024),
    ...packet,
  })}`);
}

async function renderManifest(
  manifest: Manifest,
  output: string,
  onRenderProgress: (progress: number) => void,
) {
  const audioSegments = manifest.audioSegments.map((item) => ({ ...item }));
  const publicAudioDir = path.resolve('public', 'vibing', 'render-audio');
  fs.rmSync(publicAudioDir, { recursive: true, force: true });
  fs.mkdirSync(publicAudioDir, { recursive: true });
  for (const audio of audioSegments as any[]) {
    const dest = `${audio.id}${path.extname(audio.file_path)}`;
    fs.copyFileSync(audio.file_path, path.join(publicAudioDir, dest));
    audio.staticSrc = `vibing/render-audio/${dest}`;
  }
  const totalDurationSec = manifest.audioSegments.reduce((sum, item) => sum + item.duration_sec, 0);
  const serveUrl = await bundle({
    entryPoint: path.resolve('src', 'index.ts'),
    webpackOverride: (config) => config,
  });
  const inputProps = {
    scenes: manifest.scenes,
    audioSegments,
    projectName: manifest.projectName,
    footerText: manifest.footerText,
    visualStyle: manifest.visualStyle,
    motionStyle: manifest.motionStyle,
  };
  const composition = await selectComposition({ serveUrl, id: 'ProjectShowcase', inputProps });
  (composition as any).durationInFrames = Math.round(totalDurationSec * 30);
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: output,
    inputProps,
    onProgress: ({ progress }) => {
      onRenderProgress(progress);
      process.stdout.write(`\r[render] ${Math.round(progress * 100)}%`);
    },
  });
  process.stdout.write('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  loadEnv(path.resolve('.env'));

  let currentStage = 'boot';
  let currentProgress = 0;
  let currentScene = '';
  let currentLlm: LlmRuntimeInfo = {
    provider: opts.llmProvider,
    model: opts.llmModel || '',
    baseUrl: opts.llmBaseUrl || '',
    enabled: opts.llmProvider !== 'off' && opts.llm !== false,
    usedFallback: true,
  };
  const currentTts: TtsRuntimeInfo = {
    engine: opts.ttsEngine,
    voice: opts.voice,
    rate: opts.rate,
    quality: opts.ttsEngine === 'edge' ? 'free neural voice' : 'custom',
  };
  let currentCost: CostSummary = disabledCost(
    currentLlm.provider,
    currentLlm.model,
    currentLlm.enabled ? 'unavailable' : 'disabled',
    opts.llmInputPricePerMTok,
    opts.llmOutputPricePerMTok,
  );
  const emitCurrentHeartbeat = () => {
    emitHeartbeat({
      jobId: opts.jobId,
      nodeId: `renderer-${process.pid}`,
      stage: currentStage,
      progress: currentProgress,
      sceneId: currentScene,
      queueDepth: 0,
      llm: currentLlm,
      tts: currentTts,
      cost: currentCost,
    });
  };
  const heartbeat = setInterval(emitCurrentHeartbeat, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref?.();

  try {
    emitCurrentHeartbeat();
    const localJobId = `${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`;
    const jobDir = path.resolve('public', 'vibing', 'jobs', localJobId);
    fs.mkdirSync(jobDir, { recursive: true });

    currentStage = 'assets';
    currentProgress = 5;
    const assets = scanAssets(opts.assets, jobDir);
    const textAssets = scanTextAssets(opts.assets);
    console.log(`[assets] ${assets.length} files`);
    if (textAssets.length > 0) {
      console.log(`[text-assets] ${textAssets.length} text files (${textAssets.reduce((s, t) => s + t.content.length, 0)} chars)`);
    }
    emitCurrentHeartbeat();

    currentStage = 'storyboard';
    currentProgress = 15;
    emitCurrentHeartbeat();
    const llmResult = await generateScenesWithLlm(opts, assets, textAssets).catch((error) => {
      console.warn(`[LLM] fallback: ${error.message}`);
      return null;
    });
    if (llmResult) {
      currentLlm = llmResult.runtime;
      currentCost = llmResult.cost;
    } else {
      currentLlm = {
        ...currentLlm,
        enabled: opts.llmProvider !== 'off' && opts.llm !== false,
        usedFallback: true,
      };
      currentCost = disabledCost(
        currentLlm.provider,
        currentLlm.model,
        currentLlm.enabled ? 'fallback' : 'disabled',
        opts.llmInputPricePerMTok,
        opts.llmOutputPricePerMTok,
      );
      console.log(`[cost] ${JSON.stringify(currentCost)}`);
    }
    emitCurrentHeartbeat();
    const scenes = llmResult?.scenes?.length ? llmResult.scenes : fallbackScenes(opts, assets);
    const visualStyle = opts.visualStyle === 'auto' ? inferVisualStyle(opts.prompt) : opts.visualStyle;
    const motionStyle = resolveMotionStyle(visualStyle, opts.motionStyle);
    console.log(`[scenes] ${scenes.length}`);
    console.log(`[style] visual=${visualStyle} motion=${motionStyle}`);

    currentStage = 'tts';
    const audioDir = path.join(jobDir, 'audio');
    const audioSegments = scenes.map((scene, index) => {
      currentScene = scene.id;
      currentProgress = 20 + Math.round((index / Math.max(1, scenes.length)) * 20);
      emitCurrentHeartbeat();
      console.log(`[tts] ${index + 1}/${scenes.length} ${scene.id}`);
      const audio = synthesizeTts(scene, audioDir, opts);
      scene.durationSec = audio.duration_sec;
      return audio;
    });
    currentScene = '';
    currentProgress = 40;

    const manifest: Manifest = {
      title: opts.projectName,
      projectName: opts.projectName,
      footerText: 'generated by vibing vidio',
      generatedAt: new Date().toISOString(),
      prompt: opts.prompt,
      targetDurationSec: opts.duration,
      scenes,
      audioSegments,
      visualStyle,
      motionStyle,
      generation: {
        llm: currentLlm,
        tts: currentTts,
        cost: currentCost,
      },
    };
    const manifestPath = path.join(jobDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[manifest] ${manifestPath}`);
    console.log(`[duration] ${(audioSegments.reduce((s, a) => s + a.duration_sec, 0) / 60).toFixed(2)} min`);

    currentStage = 'render';
    emitCurrentHeartbeat();
    await renderManifest(manifest, opts.output, (progress) => {
      currentProgress = 40 + Math.round(progress * 60);
      emitCurrentHeartbeat();
    });

    currentStage = 'completed';
    currentProgress = 100;
    emitCurrentHeartbeat();
    console.log(`[done] ${path.resolve(opts.output)}`);
  } finally {
    clearInterval(heartbeat);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
