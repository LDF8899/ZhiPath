import type { GenerationConfig, NormalizedQuestion } from './question-generation.contracts';

/**
 * 通用出题提示词构造器 — 与聊天智能体共享，保证产题质量一致。
 *
 * 两种形态：
 * - single：一次一道（异步出题任务用，返回字段 stem/options[{key,text}]/answer/solution/parts/metadata）
 * - batch ：一次多道、聊天友好（返回 type/question/options[str]/answer/explanation，保持前端 exam 契约）
 */

const DIFFICULTY_LADDER = (difficulty: number): string =>
  difficulty <= 3
    ? '基础（1-3）：单步记忆、直接套用一个公式或概念'
    : difficulty <= 6
      ? '中等（4-6）：需两步以上推理，或综合两个知识点'
      : '困难（7-10）：多步推导、跨知识点综合、需判断/证明/讨论，接近压轴题';

function gradeNote(config: GenerationConfig): string {
  return config.grade
    ? `年级/学段：${config.grade}。`
    : '未指定年级，请按该学科通用水平，不做超纲也不做送分题。';
}

function topicNote(config: GenerationConfig): string {
  const topicText = config.topics?.map((topic) => topic.label || topic.code || topic.id).filter(Boolean).join('、') || '';
  return topicText ? `必须紧扣知识点：${topicText}。` : '';
}

function diversityNote(config: GenerationConfig, previous: NormalizedQuestion[]): string {
  if (!previous || previous.length === 0) return '当前为第一批，无历史题目。';
  const list = previous
    .map((q) => `「${String(q.stem).slice(0, 60)}」`)
    .join('；');
  return `避免与以下已生成题目重复：${list}。仅换数字/字母/选项顺序视为近似重复（不合格），请改用不同出题思路（不同情境、推理路径、考点侧重点）。`;
}

function qualityRules(config: GenerationConfig, previous: NormalizedQuestion[]): string {
  return `【核心出题法则】
1. 逆向构建（最重要）：先设定"好算、可解"的目标结果，再逆推题干和条件；严禁先写题目再硬凑答案。数值优先取整数或简单分数；几何/图形优先用标准角；最终答案避免"丑"无理数（如根号7、根号11），优先整数、根号2、根号3、根号5 或有理数。
2. 保证难度达标：不得出"看一眼就能答"的送分题。题目至少要包含一次两步以上的推理，或需组合多个知识点，或需判断/证明/讨论；难度达到 6 及以上时尤其要多步推导或设置陷阱，让学生必须想清楚再动手。
3. 题干严谨可判分：条件完备、答案唯一、无歧义；解析必须写清依据与推理步骤，禁止只写"略"或"详见解析"。
4. 选择题干扰项质量：4 个选项都须合理且有迷惑性，错误选项基于学生常见错误、漏算、误用公式或误读图形来设计；正确项唯一，不能一眼排除。
5. 若为解答/简答/编程等大题：采用阶梯式设问（parts），各部分标注 marks，并给出 M/A 评分点（方法分 + 答案分），体现"前一问的结论被后一问引用"的递进。
6. ${diversityNote(config, previous)}`;
}

function difficultyBlock(config: GenerationConfig): string {
  const topicNoteText = topicNote(config);
  return `【难度要求】目标难度 ${config.difficulty}/10。${DIFFICULTY_LADDER(config.difficulty)}。${gradeNote(config)}${topicNoteText}`;
}

function typeDescription(config: GenerationConfig): string {
  return config.questionTypes?.join('、') || '多种题型';
}

function bankNote(bankContext?: string): string {
  if (!bankContext) return '';
  return `\n【题库参考与防重】以下为已入库的相关题目。新题应与它们在风格/难度/考点上保持一致，但内容必须明显不同，不得与其中任何一题近似重复（仅换数字/字母不算）：
${bankContext}`;
}

/** 可复用的图形出图指南：按题选择 GeoGebra(2D) 或 three.js(3D)，任意学科需要图就自动用。 */
export const GEOGEBRA_FIGURE_GUIDE = `【图形（任意学科，自动按需）】若本题涉及任何图形/示意图——几何、坐标系、函数、曲线、统计、受力/内力图、立体几何、空间图形、建筑/结构/工程形态、装置等——必须输出 figure；纯文字/纯代数/纯计算题 figure 一律为 null。

【选择规则】按"是否需要 3D"二选一：
- 平面几何/坐标系/函数图像/统计图/2D 图解/平面内力图 → 用 GeoGebra（type:"geogebra"）。
- 立体几何/空间图形/建筑/结构/工程三维模型/构件/桁架/楼体/空间受力示意 → 用 three.js（type:"three"）。

1) GeoGebra（仅 2D 平面图）：
{"type":"geogebra","commands":["A=(0,0)","Segment(A,B)"],"view":[xmin,xmax,ymin,ymax],"axes":true,"grid":false}
- 必须给出覆盖所有对象的 view（[xmin,xmax,ymin,ymax]，留 10%~20% 边距，坐标用整数/简单分数），确保图形落在画面的中央，不要默认视口。

2) three.js（3D，含立体几何/工程/建筑）：
{"type":"three","scene":[{...}],"camera":{"position":[x,y,z],"target":[x,y,z]},"axes":true}
scene 为对象数组，支持的 kind（Y 轴向上；position 为三维坐标）：
- box：{"kind":"box","size":[w,h,d],"position":[x,y,z],"color":"#..","rotation":[rx,ry,rz]}（楼体/柱/梁/板/几何块）
- sphere：{"kind":"sphere","radius":r,"position":[x,y,z],"color":"#.."}
- cylinder：{"kind":"cylinder","radius":r,"height":h,"position":[x,y,z],"color":"#.."}（圆柱/轴/杆）
- cone：{"kind":"cone","radius":r,"height":h,"position":[x,y,z],"color":"#.."}
- grid：{"kind":"grid","size":s,"divisions":n}（地面参照）
- arrow：{"kind":"arrow","from":[x,y,z],"to":[x,y,z],"color":"#.."}（力/荷载/向量）
- edge：{"kind":"edge","points":[[x,y,z],...],"color":"#.."}（折线/桁架/轮廓/配筋示意）
- text：{"kind":"text","text":"标签","position":[x,y,z],"color":"#.."}
camera：如 {"position":[8,7,8],"target":[0,0,0]}。

【GeoGebra 命令规范（type 为 geogebra 时遵守）】
可用构造命令：点 A=(0,0)；线段 Segment(A,B)；直线/射线 Line/Ray；折线 Polyline；圆/圆弧 Circle/Arc；多边形 Polygon；函数 f(x)=x^2-2x、Curve(...)；圆锥曲线 Ellipse/Hyperbola/Parabola/Conic；向量 Vector；角度 Angle(A,B,C)；中点/交点 Midpoint/Intersect；切线/垂线/平行线 Tangent/PerpendicularLine/ParallelLine；立体：Prism/Pyramid/Sphere/Plane/IntersectPath。
【禁止（会报错，绝不使用）】样式/设置命令：SetLineThickness、SetColor、SetVisible、SetAxesVisible、SetGridVisible、SetPointSize、ShowGrid、ShowAxes、ShowLabel、SetValue、Delete、Rename、SetText、SetCaption 等一律不写；坐标轴/网格/线宽/标签由前端统一设置。
坐标用整数或简单分数；题干涉及的每个对象尽量画（圆心、切点、支座、力/力偶、内力分布、交点、构件、节点等）；如不确定命令或对象语法，宁可少画，也绝不要写会报错的命令。`;

function figureNote(): string {
  return GEOGEBRA_FIGURE_GUIDE;
}



/** 异步出题任务：一次一道，字段面向题库 JSON。 */
export function buildSinglePrompt(config: GenerationConfig, previous: NormalizedQuestion[] = [], bankContext?: string) {
  const system = `你是学科考试的资深出题与阅卷专家，请为「${config.subject || '本学科'}」出一道练习题。

${difficultyBlock(config)}

${qualityRules(config, previous)}
${bankNote(bankContext)}
${figureNote()}

【输出格式】只输出严格的 JSON 对象，不要 Markdown、不要解释文字。字段如下：
{
  "type": "choice | fill | coding | essay",
  "stem": "题干",
  "figure": {"type":"geogebra","commands":["A=(1,2)","Segment(A,B)"],"view":[-1,8,8,-1],"axes":true,"grid":false},
  "options": [{"key":"A","text":"..."},{"key":"B","text":"..."}],
  "answer": "选择题为正确项 key（A/B/C/D），填空/简答/编程为答案文本",
  "solution": "完整解析与推理步骤",
  "parts": [{"label":"(a)","question":"子题题干","answer":"答案","solution":"解析","marks":N}],
  "metadata": {"difficulty": ${config.difficulty}, "topics": ["知识点"], "solutionSteps": ["(1M) 方法点","(1A) 答案点"], "constructionNotes": "逆向构建草稿：预设的结果与参数"}
}`;
  const user = `请生成一道难度为 ${config.difficulty}/10 的${typeDescription(config)}题${config.instructions ? `。额外要求：${config.instructions}` : ''}。只输出 JSON。`;
  return { system, user };
}

/** 聊天/测验：一次多道，字段保持前端 exam 契约（question/options[str]/answer/explanation）。 */
export function buildBatchPrompt(config: GenerationConfig, count: number, previous: NormalizedQuestion[] = [], bankContext?: string) {
  const system = `你是学科考试的资深出题与阅卷专家，请为「${config.subject || '本学科'}」出一套练习。

${difficultyBlock(config)}

${qualityRules(config, previous)}
${bankNote(bankContext)}
${figureNote()}

【输出格式】只输出严格的 JSON 对象，不要 Markdown。字段如下：
{
  "skill": "${config.subject || ''}",
  "questions": [
    {
      "type": "choice | fill | coding | essay",
      "question": "题干",
      "figure": {"type":"geogebra","commands":["A=(1,2)","Segment(A,B)"],"view":[-1,8,8,-1],"axes":true,"grid":false},
      "options": ["选项A文本", "选项B文本", "选项C文本", "选项D文本"],
      "answer": <选择题填正确项下标(0起)；填空/简答/编程填答案文本>,
      "explanation": "完整解析与推理步骤",
      "parts": [{"label":"(a)","question":"子题题干","answer":"答案","explanation":"解析","marks":N}]
    }
  ]
}`;
  const user = `请生成 ${count} 道难度为 ${config.difficulty}/10 的${typeDescription(config)}题${config.instructions ? `。额外要求：${config.instructions}` : ''}。题目之间不要重复，每道都要给出解析。只输出 JSON。`;
  return { system, user };
}
