/**
 * MiMo TTS 声音测试
 * 测试不同 voice 参数和文本处理方式
 */

const BASE_URL = 'https://token-plan-ams.xiaomimimo.com/v1';
const API_KEY = 'tp-e1zqwa8t76iuzthplilab87j6yukzq10dg7qf44kjpewu2uy';
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = 'D:/X/ZhiPath/video-renderer/public/tts_test';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 可能的 voice 参数
const VOICE_OPTIONS = [
  'alloy',
  'echo',
  'fable',
  'onyx',
  'nova',
  'shimmer',
  'female',
  'male',
  'zh-CN',
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-YunxiNeural',
  'xiaoxiao',
  'yunxi',
];

// 测试文本（包含中英文混合 + 专有名词）
const TEST_TEXTS = [
  {
    name: '中文基础',
    text: '今天我们来学习React Hooks，这是前端开发中非常重要的技术。',
  },
  {
    name: '英文专有名词',
    text: 'useState和useEffect是React Hooks中最常用的两个Hook。',
  },
  {
    name: '技术术语',
    text: 'JavaScript的闭包、TypeScript的泛型、CSS的Flexbox布局。',
  },
  {
    name: '混合文本',
    text: '在Vue 3中，我们使用Composition API来组织代码，类似React的Hooks。',
  },
];

async function testTTS(text, voice, model = 'mimo-v2.5-tts-voicedesign') {
  const start = Date.now();

  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: text }
        ],
        // voicedesign 模型可能支持额外参数
        voice: voice,
        max_tokens: 1000,
        stream: false,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { status: 'FAIL', code: resp.status, error: err.substring(0, 100), ms: Date.now() - start };
    }

    const data = await resp.json();
    const audioData = data.choices[0]?.message?.audio?.data;

    if (!audioData) {
      return { status: 'NO_AUDIO', raw: JSON.stringify(data).substring(0, 200), ms: Date.now() - start };
    }

    // 保存音频
    const filename = `tts_${voice || 'default'}.wav`;
    const filePath = path.join(OUTPUT_DIR, filename);
    const buffer = Buffer.from(audioData, 'base64');
    fs.writeFileSync(filePath, buffer);

    return {
      status: 'OK',
      file: filePath,
      sizeKB: Math.round(buffer.length / 1024),
      ms: Date.now() - start,
    };
  } catch (e) {
    return { status: 'ERROR', error: e.message, ms: Date.now() - start };
  }
}

async function testWithSystemPrompt(text, systemPrompt) {
  const start = Date.now();

  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mimo-v2.5-tts-voicedesign',
        messages: [
          { role: 'user', content: `${systemPrompt}\n\n${text}` }
        ],
        max_tokens: 1000,
        stream: false,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { status: 'FAIL', code: resp.status, error: err.substring(0, 100), ms: Date.now() - start };
    }

    const data = await resp.json();
    const audioData = data.choices[0]?.message?.audio?.data;

    if (!audioData) {
      return { status: 'NO_AUDIO', ms: Date.now() - start };
    }

    const filename = `tts_system_${Date.now()}.wav`;
    const filePath = path.join(OUTPUT_DIR, filename);
    const buffer = Buffer.from(audioData, 'base64');
    fs.writeFileSync(filePath, buffer);

    return {
      status: 'OK',
      file: filePath,
      sizeKB: Math.round(buffer.length / 1024),
      ms: Date.now() - start,
    };
  } catch (e) {
    return { status: 'ERROR', error: e.message, ms: Date.now() - start };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('MiMo TTS 声音质量测试');
  console.log('='.repeat(60));

  // 测试不同 voice 参数
  console.log('\n📢 测试 Voice 参数:');
  console.log('-'.repeat(40));

  const testText = TEST_TEXTS[0].text;
  for (const voice of VOICE_OPTIONS) {
    const result = await testTTS(testText, voice);
    const icon = result.status === 'OK' ? '✅' : '❌';
    console.log(`${icon} ${voice.padEnd(25)} ${result.status === 'OK' ? `${result.sizeKB}KB ${result.ms}ms` : result.error?.substring(0, 50) || result.status}`);
  }

  // 测试不同文本处理方式
  console.log('\n📝 测试文本处理:');
  console.log('-'.repeat(40));

  const textProcessors = [
    {
      name: '原始文本',
      text: 'useState和useEffect是React Hooks中最常用的两个Hook。',
    },
    {
      name: '中文标注',
      text: 'useState（状态钩子）和useEffect（副作用钩子）是React Hooks中最常用的两个Hook。',
    },
    {
      name: '拼音标注',
      text: 'useState（you state）和useEffect（you effect）是React Hooks中最常用的两个Hook。',
    },
    {
      name: '全中文',
      text: '状态钩子和副作用钩子是React钩子中最常用的两个钩子。',
    },
    {
      name: '自然语言描述',
      text: '在React中，我们经常使用两个重要的钩子：一个是用来管理状态的，另一个是用来处理副作用的。',
    },
  ];

  for (const tp of textProcessors) {
    const result = await testTTS(tp.text, 'alloy');
    const icon = result.status === 'OK' ? '✅' : '❌';
    console.log(`${icon} ${tp.name.padEnd(15)} ${result.status === 'OK' ? `${result.sizeKB}KB` : 'FAIL'}`);
  }

  // 测试不同模型
  console.log('\n🔊 测试不同模型:');
  console.log('-'.repeat(40));

  const models = [
    'mimo-v2.5-tts',
    'mimo-v2.5-tts-voicedesign',
    'mimo-v2-tts',
  ];

  for (const model of models) {
    const result = await testTTS(testText, 'alloy', model);
    const icon = result.status === 'OK' ? '✅' : '❌';
    console.log(`${icon} ${model.padEnd(30)} ${result.status === 'OK' ? `${result.sizeKB}KB ${result.ms}ms` : 'FAIL'}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log(`📁 音频文件保存在: ${OUTPUT_DIR}`);
}

main().catch(console.error);
