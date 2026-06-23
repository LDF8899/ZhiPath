/**
 * 演示视频生成脚本
 * 直接调用 MiMo API 生成脚本 + TTS 音频 + Remotion 渲染
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'https://token-plan-ams.xiaomimimo.com/v1';
const API_KEY = 'tp-e1zqwa8t76iuzthplilab87j6yukzq10dg7qf44kjpewu2uy';
const OUTPUT_DIR = 'D:/X/ZhiPath/video-renderer/public';

// 确保输出目录存在
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Step 1: 生成脚本 ──
async function generateScript(skillName) {
  console.log('📝 Step 1: 生成视频脚本...');

  const resp = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'mimo-v2.5',
      messages: [
        {
          role: 'system',
          content: `你是教学视频脚本生成器。为技能生成结构化视频脚本。

输出规则：
1. 必须输出合法 JSON
2. narration 是口语化解说词（像老师在课堂上讲话）
3. 不要出现"如图所示""请看屏幕"
4. 总片段 3-5 个

JSON 结构：
{
  "skill_name": "xxx",
  "difficulty": "beginner",
  "total_segments": 3,
  "segments": [
    {
      "id": "seg_01",
      "type": "title_card",
      "narration": "口语化解说词",
      "visual": {"type": "title", "title": "xxx", "subtitle": "xxx"},
      "emphasis": ["关键词"],
      "estimated_duration_sec": 5
    },
    {
      "id": "seg_02",
      "type": "bullet_points",
      "narration": "解说词",
      "visual": {"type": "bullets", "items": ["要点1", "要点2", "要点3"], "highlight_index": 0},
      "emphasis": ["关键词"],
      "estimated_duration_sec": 8
    },
    {
      "id": "seg_03",
      "type": "summary",
      "narration": "总结解说词",
      "visual": {"type": "key_points", "points": ["总结1", "总结2"]},
      "emphasis": ["关键词"],
      "estimated_duration_sec": 6
    }
  ]
}

片段类型：title_card, bullet_points, code_walkthrough, summary, highlight_reel`
        },
        {
          role: 'user',
          content: `为「${skillName}」生成教学视频脚本，难度：beginner`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  const data = await resp.json();
  const content = data.choices[0]?.message?.content || '';

  // 提取 JSON
  let jsonStr = content;
  const match = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (match) jsonStr = match[1].trim();

  try {
    const script = JSON.parse(jsonStr);
    console.log(`   ✅ 脚本生成成功：${script.total_segments} 个片段`);
    return script;
  } catch (e) {
    console.error('   ❌ JSON 解析失败，使用 fallback');
    return {
      skill_name: skillName,
      difficulty: 'beginner',
      total_segments: 3,
      segments: [
        {
          id: 'seg_01',
          type: 'title_card',
          narration: `今天我们来学习${skillName}。这是一个非常重要的前端技术。`,
          visual: { type: 'title', title: skillName, subtitle: '快速入门教程' },
          emphasis: [skillName],
          estimated_duration_sec: 6,
        },
        {
          id: 'seg_02',
          type: 'bullet_points',
          narration: `让我们来了解${skillName}的三个核心要点。第一，基本概念。第二，常用属性。第三，实际应用。`,
          visual: { type: 'bullets', items: ['基本概念', '常用属性', '实际应用'], highlight_index: 0 },
          emphasis: ['核心要点'],
          estimated_duration_sec: 10,
        },
        {
          id: 'seg_03',
          type: 'summary',
          narration: `今天我们学习了${skillName}的基础知识。记住这些要点，多加练习，你就能掌握它。`,
          visual: { type: 'key_points', points: ['掌握基础概念', '多加练习'] },
          emphasis: ['练习'],
          estimated_duration_sec: 7,
        },
      ],
    };
  }
}

// ── Step 2: TTS 配音 ──
async function synthesizeTTS(text, index) {
  console.log(`🔊 Step 2.${index + 1}: TTS 合成 - "${text.substring(0, 30)}..."`);

  // 专有名词替换表（只替换发音特别差的词）
  const termMap = {
    // 英文缩写（TTS 会逐字母读）
    'CSS': 'CSS',           // 保留，TTS 能读
    'HTML': 'HTML',         // 保留
    'API': 'API',           // 保留
    'DOM': 'DOM',           // 保留
    'JSX': 'JSX',           // 保留

    // 框架/库名（保留英文，TTS 能读）
    'React': 'React',
    'Vue': 'Vue',
    'Angular': 'Angular',
    'Node.js': 'Node.js',

    // Hook 名（保留英文，但加空格分隔）
    'useState': 'use State',
    'useEffect': 'use Effect',
    'useCallback': 'use Callback',
    'useMemo': 'use Memo',
    'useRef': 'use Ref',

    // CSS 属性（保留英文）
    'Flexbox': 'Flex box',
    'flexbox': 'flex box',
    'display': 'display',
    'justify-content': 'justify content',
    'align-items': 'align items',
    'flex-wrap': 'flex wrap',

    // 技术术语（保留英文）
    'JavaScript': 'JavaScript',
    'TypeScript': 'TypeScript',
    'component': 'component',
    'props': 'props',
    'state': 'state',
    'render': 'render',
    'function': 'function',
    'closure': 'closure',
    'callback': 'callback',
  };

  // 只在必要时替换，保留原始文本
  let processedText = text;
  for (const [term, replacement] of Object.entries(termMap)) {
    if (term !== replacement) {
      processedText = processedText.replace(new RegExp(term, 'gi'), replacement);
    }
  }


  

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`   ❌ TTS 失败: ${resp.status} ${err.substring(0, 100)}`);
    return { file_path: '', duration_sec: text.length / 2.5 };
  }

  const data = await resp.json();
  const audioData = data.choices[0]?.message?.audio?.data;

  if (!audioData) {
    console.error('   ❌ 无音频数据');
    return { file_path: '', duration_sec: text.length / 2.5 };
  }

  // 保存 WAV 文件
  const filePath = path.join(OUTPUT_DIR, `seg_${String(index + 1).padStart(2, '0')}.wav`);
  const buffer = Buffer.from(audioData, 'base64');
  fs.writeFileSync(filePath, buffer);

  // 获取时长
  let durationSec;
  try {
    const result = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
    durationSec = parseFloat(result);
  } catch {
    durationSec = (buffer.length - 44) / (2 * 24000);
  }

  console.log(`   ✅ 音频生成：${filePath} (${durationSec.toFixed(2)}s)`);
  return { file_path: filePath, duration_sec: durationSec };
}

// ── Step 3: 合并音频 ──
function mergeAudio(audioPaths, outputPath) {
  console.log('🎵 Step 3: 合并音频...');

  const validPaths = audioPaths.filter(p => fs.existsSync(p));
  if (validPaths.length === 0) {
    console.log('   ⚠️ 无音频文件');
    return 0;
  }

  const listPath = outputPath + '.list.txt';
  fs.writeFileSync(listPath, validPaths.map(p => `file '${p}'`).join('\n'));

  try {
    execSync(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });

    const result = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${outputPath}"`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    const duration = parseFloat(result);
    console.log(`   ✅ 音频合并完成：${outputPath} (${duration.toFixed(2)}s)`);
    return duration;
  } catch (e) {
    console.error('   ❌ 合并失败:', e.message);
    return 0;
  } finally {
    try { fs.unlinkSync(listPath); } catch {}
  }
}

// ── Main ──
async function main() {
  const skillName = process.argv[2] || 'React Hooks';
  console.log('='.repeat(50));
  console.log(`🎬 生成教学视频：${skillName}`);
  console.log('='.repeat(50));

  // Step 1: 生成脚本
  const script = await generateScript(skillName);

  // 保存脚本
  const scriptPath = path.join(OUTPUT_DIR, 'script.json');
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  console.log(`   脚本保存：${scriptPath}`);

  // Step 2: TTS 配音
  const audioSegments = [];
  for (let i = 0; i < script.segments.length; i++) {
    const seg = script.segments[i];
    const audio = await synthesizeTTS(seg.narration, i);
    seg.audio = audio;
    audioSegments.push(audio);
  }

  // Step 3: 合并音频
  const mergedAudioPath = path.join(OUTPUT_DIR, 'merged_audio.wav');
  const totalDuration = mergeAudio(
    audioSegments.map(a => a.file_path).filter(Boolean),
    mergedAudioPath
  );

  // 保存更新后的脚本（含音频信息）
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));

  // 输出结果
  console.log('\n' + '='.repeat(50));
  console.log('✅ 生成完成！');
  console.log('='.repeat(50));
  console.log(`📁 输出目录：${OUTPUT_DIR}`);
  console.log(`📄 脚本：${scriptPath}`);
  console.log(`🔊 合并音频：${mergedAudioPath}`);
  console.log(`⏱️ 总时长：${totalDuration.toFixed(2)} 秒`);
  console.log(`📊 片段数：${script.segments.length}`);

  console.log('\n📋 片段详情：');
  script.segments.forEach((seg, i) => {
    console.log(`  ${i + 1}. [${seg.type}] ${seg.narration.substring(0, 40)}... (${seg.audio.duration_sec.toFixed(1)}s)`);
  });

  console.log('\n🎬 下一步：运行 Remotion 渲染');
  console.log(`   cd D:/X/ZhiPath/video-renderer`);
  console.log(`   npx remotion studio`);
}

main().catch(console.error);
