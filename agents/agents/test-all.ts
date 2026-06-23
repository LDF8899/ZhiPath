/**
 * 全部 Agent 统一测试
 *
 * 运行方式：npx ts-node --transpile-only test-all.ts
 */

import { generateLecture } from './generate-lecture';
import { generateReading } from './generate-reading';
import { generateCode } from './generate-code';
import { generatePath } from './generate-path';
import { assessLearning } from './generate-assess';

const SPARK_CONFIG = {
  apiUrl: 'https://spark-api-open.xf-yun.com/x2/chat/completions',
  apiKey: 'a3d175c0042c043fc9297f52fa5a606a:MzIxMzM2NzgyMGUzNDU5YTA5YmJmM2Ri',
  model: 'spark-x',
};

async function main() {
  console.log('================================================');
  console.log('  全部 Agent 统一测试');
  console.log('================================================\n');

  // 测试讲义生成
  console.log('【1. 讲义生成】');
  try {
    const r = await generateLecture('React Hooks', 'beginner', undefined, SPARK_CONFIG);
    if (r.type === 'error') console.log(`❌ ${r.data.message}`);
    else console.log(`✅ 字数:${r.data.wordCount} | 练习题:${r.data.exercises.length}道 | 知识点:${r.data.keyPoints.length}条`);
  } catch (e: any) { console.log(`❌ ${e.message}`); }

  // 测试拓展阅读
  console.log('\n【2. 拓展阅读】');
  try {
    const r = await generateReading('React Hooks', 2, undefined, SPARK_CONFIG);
    if (r.type === 'error') { console.log(`❌ ${r.data.message}`); }
    else {
      console.log(`✅ 共${r.data.totalItems}篇\n`);
      r.data.items.forEach((item: any, i: number) => {
        const icon = item.difficulty === 'basic' ? '🟢' : item.difficulty === 'intermediate' ? '🟡' : '🔴';
        console.log(`  📖 ${i+1}. ${item.title} ${icon} ${item.readTime} | ${item.source}`);
        console.log(`     摘要: ${item.summary.substring(0, 80)}...`);
        console.log(`     概念: ${item.keyConcepts.join('、')}\n`);
      });
    }
  } catch (e: any) { console.log(`❌ ${e.message}`); }

  // 测试代码案例
  console.log('\n【3. 代码案例】');
  try {
    const r = await generateCode('React Hooks', 'JavaScript', 2, SPARK_CONFIG);
    if (r.type === 'error') { console.log(`❌ ${r.data.message}`); }
    else {
      console.log(`✅ 共${r.data.totalExamples}个案例\n`);
      r.data.examples.forEach((ex: any, i: number) => {
        console.log(`  💻 ${i+1}. ${ex.title}`);
        console.log(`     说明: ${ex.description}`);
        console.log(`     代码:\n${ex.code.split('\n').map((l: string) => `       ${l}`).join('\n')}`);
        console.log(`     运行结果: ${ex.output}`);
        console.log(`     要点: ${ex.keyPoints.join('、')}\n`);
      });
    }
  } catch (e: any) { console.log(`❌ ${e.message}`); }

  // 测试学习路径
  console.log('\n【4. 学习路径】');
  try {
    const r = await generatePath('Java后端开发', '零基础', '每天2小时', undefined, SPARK_CONFIG);
    if (r.type === 'error') { console.log(`❌ ${r.data.message}`); }
    else {
      console.log(`✅ 目标:${r.data.goal} | 阶段:${r.data.stages.length}个 | 总时长:${r.data.totalDuration}\n`);
      r.data.stages.forEach((stage: any) => {
        const icon = stage.difficulty === 'basic' ? '🟢' : stage.difficulty === 'intermediate' ? '🟡' : '🔴';
        console.log(`  📚 阶段${stage.stageNumber}：${stage.name} ${icon} ${stage.duration}`);
        console.log(`     技能: ${stage.skills.join('、')}`);
        console.log(`     完成标志: ${stage.milestones.join('、')}\n`);
      });
    }
  } catch (e: any) { console.log(`❌ ${e.message}`); }

  // 测试学习效果评估
  console.log('\n【5. 学习效果评估】');
  try {
    const r = await assessLearning(
      '学了2周Java，完成了基础语法和面向对象，做了50道选择题正确率70%，写了3个小项目',
      'Java后端开发',
      '刚完成基础阶段',
      SPARK_CONFIG
    );
    if (r.type === 'error') { console.log(`❌ ${r.data.message}`); }
    else {
      const d = r.data;
      console.log(`✅ 总分:${d.overallScore} | 等级:${d.level}\n`);
      console.log('  📊 维度评分:');
      d.dimensions.forEach((dim: any) => {
        const trend = dim.trend === 'up' ? '📈' : dim.trend === 'down' ? '📉' : '➡️';
        console.log(`     ${trend} ${dim.dimension}: ${dim.score}分 - ${dim.detail}`);
      });
      console.log('\n  ⚠️ 薄弱点:');
      d.weakPoints.forEach((w: any) => console.log(`     - ${w.skill}: ${w.suggestion}`));
      console.log(`\n  💡 计划调整: ${d.planAdjustment}`);
      console.log(`  💪 ${d.encouragement}`);
    }
  } catch (e: any) { console.log(`❌ ${e.message}`); }

  console.log('\n================================================');
  console.log('  测试完成');
  console.log('================================================');
}

main();
