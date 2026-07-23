/**
 * Render the ZhiPath project showcase video.
 *
 * Usage:
 *   npx tsx src/render-project-showcase.ts --manifest <json> --output <mp4>
 */
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

interface ShowcaseAudioSegment {
  id: string;
  file_path?: string;
  staticSrc?: string;
  duration_sec: number;
}

interface ShowcaseScene {
  id: string;
  durationSec: number;
}

interface ShowcaseManifest {
  scenes: ShowcaseScene[];
  audioSegments?: ShowcaseAudioSegment[];
}

function getArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

async function main() {
  const manifestPath = getArg(process.argv.slice(2), '--manifest');
  const outputPath = getArg(process.argv.slice(2), '--output');

  if (!manifestPath || !outputPath) {
    console.error('Usage: npx tsx src/render-project-showcase.ts --manifest <json> --output <mp4>');
    process.exit(1);
  }

  const manifestText = fs.readFileSync(manifestPath, 'utf-8').replace(/^\uFEFF/, '');
  const manifest = JSON.parse(manifestText) as ShowcaseManifest;
  const audioSegments = manifest.audioSegments || [];

  const publicAudioDir = path.resolve(__dirname, '..', 'public', '_project_audio');
  fs.rmSync(publicAudioDir, { recursive: true, force: true });
  fs.mkdirSync(publicAudioDir, { recursive: true });

  for (const audio of audioSegments) {
    if (!audio.file_path || !fs.existsSync(audio.file_path)) continue;
    const ext = path.extname(audio.file_path) || '.wav';
    const destName = `${audio.id}${ext}`;
    fs.copyFileSync(audio.file_path, path.join(publicAudioDir, destName));
    audio.staticSrc = `_project_audio/${destName}`;
  }

  const fps = 30;
  const totalDurationSec = manifest.scenes.reduce((sum, scene) => {
    const audio = audioSegments.find((item) => item.id === scene.id);
    return sum + (audio?.duration_sec || scene.durationSec || 10);
  }, 0);
  const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));

  console.log(`[ProjectShowcase] scenes=${manifest.scenes.length}`);
  console.log(`[ProjectShowcase] duration=${totalDurationSec.toFixed(2)}s frames=${totalFrames}`);

  const serveUrl = await bundle({
    entryPoint: path.resolve(__dirname, 'index.ts'),
    webpackOverride: (config) => config,
  });

  const composition = await selectComposition({
    serveUrl,
    id: 'ProjectShowcase',
    inputProps: {
      scenes: manifest.scenes,
      audioSegments,
    },
  });
  (composition as any).durationInFrames = totalFrames;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: {
      scenes: manifest.scenes,
      audioSegments,
    },
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      process.stdout.write(`\r[ProjectShowcase] progress=${pct}%`);
    },
  });

  console.log(`\n[ProjectShowcase] done: ${outputPath}`);
}

main().catch((error) => {
  console.error('[ProjectShowcase] failed:', error);
  process.exit(1);
});
