/**
 * Remotion 渲染脚本
 * 使用生成的脚本和音频渲染视频
 */

const path = require('path');
const fs = require('fs');

async function main() {
  console.log('🎬 开始 Remotion 渲染...');

  // 动态导入 ESM 模块
  const { bundle } = await import('@remotion/bundler');
  const { renderMedia, selectComposition } = await import('@remotion/renderer');

  // 读取脚本
  const scriptPath = path.join(__dirname, 'public', 'script.json');
  const script = JSON.parse(fs.readFileSync(scriptPath, 'utf-8'));

  // 准备音频段落数据
  const audioSegments = script.segments
    .filter(seg => seg.audio?.file_path)
    .map(seg => ({
      id: seg.id,
      file_path: seg.audio.file_path,
      duration_sec: seg.audio.duration_sec,
    }));

  // 计算总时长
  const totalDuration = script.segments.reduce(
    (sum, seg) => sum + (seg.audio?.duration_sec || seg.estimated_duration_sec || 5),
    0
  );

  console.log(`📊 脚本：${script.segments.length} 个片段`);
  console.log(`⏱️ 总时长：${totalDuration.toFixed(2)} 秒`);
  console.log(`🔊 音频段落：${audioSegments.length} 个`);

  // 打包组件
  console.log('📦 打包 Remotion 组件...');
  const bundled = await bundle({
    entryPoint: path.resolve(__dirname, 'src', 'index.ts'),
    webpackOverride: (config) => config,
  });

  // 选择 Composition
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'VideoGenerator',
    inputProps: { script, audioSegments },
  });

  // 覆盖时长
  composition.durationInFrames = Math.ceil(totalDuration * 30);

  console.log(`🎬 渲染中... (${composition.durationInFrames} 帧)`);

  // 渲染
  const outputPath = path.join(__dirname, 'public', 'demo_video.mp4');

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      process.stdout.write(`\r   进度：${pct}%`);
    },
  });

  console.log('\n' + '='.repeat(50));
  console.log('✅ Remotion 渲染完成！');
  console.log('='.repeat(50));

  // 合并音频到视频（直接输出到最终文件，避免文件锁定）
  const mergedAudioPath = path.join(__dirname, 'public', 'merged_audio.wav');
  const finalOutputPath = path.join(__dirname, 'public', 'demo_video_with_audio.mp4');

  if (fs.existsSync(mergedAudioPath)) {
    console.log('🔊 合并音频到视频...');
    const { execSync } = require('child_process');

    try {
      // 直接输出到新文件，不删除原文件
      execSync(
        `ffmpeg -y -i "${outputPath}" -i "${mergedAudioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 "${finalOutputPath}"`,
        { encoding: 'utf-8', timeout: 60000 }
      );

      console.log('✅ 音频合并完成！');
      console.log(`📁 带音频版本：${finalOutputPath}`);

      // 检查最终文件
      if (fs.existsSync(finalOutputPath)) {
        const finalStats = fs.statSync(finalOutputPath);
        console.log(`📦 最终大小：${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);
      }
    } catch (e) {
      console.error('❌ 音频合并失败:', e.message);
    }
  } else {
    console.log('⚠️ 未找到合并音频文件，跳过音频合并');
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ 视频生成完成！');
  console.log('='.repeat(50));
  console.log(`📁 无音频版本：${outputPath}`);
  console.log(`📁 有音频版本：${finalOutputPath}`);
}

main().catch(console.error);
