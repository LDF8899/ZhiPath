/**
 * 视频渲染脚本
 *
 * 供 backend-ts 的 VideoAgent 调用：
 *   npx tsx src/render.ts --script <json_path> --audio <audio_json_path> --output <output_path>
 *
 * 输入：
 *   --script  视频脚本 JSON 文件路径
 *   --audio   音频段落 JSON 文件路径（含 file_path + duration_sec）
 *   --output  输出 MP4 路径
 *
 * 流程：
 *   1. 读取脚本 JSON + 音频 JSON
 *   2. 打包 Remotion 组件
 *   3. 逐帧渲染
 *   4. 合并音视频输出 MP4
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import * as fs from 'fs';
import * as path from 'path';

interface AudioSegment {
  id: string;
  file_path: string;
  duration_sec: number;
  staticSrc?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const scriptPath = getArg(args, '--script');
  const audioPath = getArg(args, '--audio');
  const outputPath = getArg(args, '--output');

  if (!scriptPath || !outputPath) {
    console.error('Usage: npx tsx src/render.ts --script <path> --output <path> [--audio <path>]');
    process.exit(1);
  }

  // 读取脚本
  const script = JSON.parse(fs.readFileSync(scriptPath, 'utf-8'));

  // 读取音频段落（可选）
  let audioSegments: AudioSegment[] = [];
  if (audioPath && fs.existsSync(audioPath)) {
    audioSegments = JSON.parse(fs.readFileSync(audioPath, 'utf-8'));
  }

  // 把每段音频暂存到 public/_audio，改写为 staticFile 可识别的相对路径。
  // Remotion 只能通过 staticFile() 访问 public 下的资源，所以渲染前必须把
  // /tmp 里的 wav 拷进来，组件里才能用 <Audio> 把声音烤进 mp4（帧级锁定，无漂移）。
  const publicAudioDir = path.resolve(__dirname, '..', 'public', '_audio');
  fs.rmSync(publicAudioDir, { recursive: true, force: true });
  fs.mkdirSync(publicAudioDir, { recursive: true });

  for (const seg of audioSegments) {
    if (seg.file_path && fs.existsSync(seg.file_path)) {
      const ext = path.extname(seg.file_path) || '.wav';
      const destName = `${seg.id}${ext}`;
      fs.copyFileSync(seg.file_path, path.join(publicAudioDir, destName));
      // staticFile 接收相对 public 的路径（正斜杠）
      seg.staticSrc = `_audio/${destName}`;
    }
  }

  // 计算总时长 —— 必须与 VideoGenerator 的逐段取帧口径完全一致：
  // 每段 round(durationSec*fps) 后再求和，避免合成总帧数与各 Sequence 帧数之和对不上。
  const fps = 30;
  let totalFrames = 0;
  for (const seg of script.segments) {
    const audio = audioSegments.find((a: AudioSegment) => a.id === seg.id);
    const durationSec =
      audio?.duration_sec || seg.audio?.duration_sec || seg.estimated_duration_sec || 5;
    totalFrames += Math.round(durationSec * fps);
  }
  const totalDurationSec = totalFrames / fps;

  console.log(`[Render] 脚本: ${script.segments.length} 个片段, 总时长: ${totalDurationSec.toFixed(1)}s`);

  // 打包 Remotion 组件
  console.log('[Render] 打包组件...');
  const bundled = await bundle({
    entryPoint: path.resolve(__dirname, 'index.ts'),
    webpackOverride: (config) => config,
  });

  // 选择 Composition
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'VideoGenerator',
    inputProps: { script, audioSegments },
  });

  // 覆盖时长
  (composition as any).durationInFrames = totalFrames;

  // 渲染
  console.log('[Render] 开始渲染...');
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 10 === 0) {
        console.log(`[Render] 进度: ${pct}%`);
      }
    },
  });

  console.log(`[Render] 完成: ${outputPath}`);

  // 输出结果 JSON（供后端读取）
  const result = {
    output_path: outputPath,
    duration_sec: totalDurationSec,
    frames: totalFrames,
    fps,
    segments: script.segments.length,
  };

  const resultPath = outputPath.replace(/\.mp4$/, '.result.json');
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`[Render] 结果: ${resultPath}`);
}

function getArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

main().catch((e) => {
  console.error('[Render] 失败:', e.message);
  process.exit(1);
});
