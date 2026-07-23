param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Speech

$rendererDir = Join-Path $Root 'video-renderer'
$sourceScreens = Join-Path $Root 'PPT素材包\实机截图'
$sourceDiagrams = Join-Path $Root 'PPT素材包\技术架构图'
$assetDir = Join-Path $rendererDir 'public\project-showcase\assets'
$audioDir = Join-Path $rendererDir 'public\project-showcase\audio'
$manifestPath = Join-Path $rendererDir 'public\project-showcase\project-showcase-manifest.json'

New-Item -ItemType Directory -Force -Path $assetDir | Out-Null
New-Item -ItemType Directory -Force -Path $audioDir | Out-Null

$assets = @(
  @{ Source = Join-Path $sourceScreens '01-landing.png'; Dest = '01-landing.png' },
  @{ Source = Join-Path $sourceScreens '02-dashboard.png'; Dest = '02-dashboard.png' },
  @{ Source = Join-Path $sourceScreens '03-chat.png'; Dest = '03-chat.png' },
  @{ Source = Join-Path $sourceScreens '04-learning.png'; Dest = '04-learning.png' },
  @{ Source = Join-Path $sourceScreens '05-jobs.png'; Dest = '05-jobs.png' },
  @{ Source = Join-Path $sourceScreens '06-job-detail.png'; Dest = '06-job-detail.png' },
  @{ Source = Join-Path $sourceScreens '07-profile.png'; Dest = '07-profile.png' },
  @{ Source = Join-Path $sourceScreens '08-progress.png'; Dest = '08-progress.png' },
  @{ Source = Join-Path $sourceScreens '09-resume.png'; Dest = '09-resume.png' },
  @{ Source = Join-Path $sourceScreens '10-exams.png'; Dest = '10-exams.png' },
  @{ Source = Join-Path $sourceScreens '11-wrong-answers.png'; Dest = '11-wrong-answers.png' },
  @{ Source = Join-Path $sourceScreens '12-agent-office.png'; Dest = '12-agent-office.png' },
  @{ Source = Join-Path $sourceScreens '13-admin-dashboard.png'; Dest = '13-admin-dashboard.png' },
  @{ Source = Join-Path $sourceScreens '14-admin-jobs.png'; Dest = '14-admin-jobs.png' },
  @{ Source = Join-Path $sourceScreens '15-multimodal-memory-workflow.png'; Dest = '15-multimodal-memory-workflow.png' },
  @{ Source = Join-Path $sourceScreens '16-multimodal-video-learning-path.png'; Dest = '16-multimodal-video-learning-path.png' },
  @{ Source = Join-Path $sourceDiagrams '01-overall-architecture.png'; Dest = 'd-01-overall-architecture.png' },
  @{ Source = Join-Path $sourceDiagrams '02-career-loop.png'; Dest = 'd-02-career-loop.png' },
  @{ Source = Join-Path $sourceDiagrams '03-git-learning.png'; Dest = 'd-03-git-learning.png' },
  @{ Source = Join-Path $sourceDiagrams '04-multi-agent.png'; Dest = 'd-04-multi-agent.png' },
  @{ Source = Join-Path $sourceDiagrams '05-jd-search.png'; Dest = 'd-05-jd-search.png' },
  @{ Source = Join-Path $sourceDiagrams '06-match-model.png'; Dest = 'd-06-match-model.png' }
)

foreach ($asset in $assets) {
  if (-not (Test-Path -LiteralPath $asset.Source)) {
    throw "Missing asset: $($asset.Source)"
  }
  Copy-Item -LiteralPath $asset.Source -Destination (Join-Path $assetDir $asset.Dest) -Force
}

$scenes = @(
  @{
    id = 'scene_01'
    chapter = '01 产品入口'
    title = '智途 ZhiPath'
    subtitle = '岗位驱动的多智能体职业学习与能力成长平台'
    asset = 'project-showcase/assets/01-landing.png'
    assetKind = 'screenshot'
    durationSec = 17
    narration = '这是智途 ZhiPath 的真实产品入口。项目不是再做一个聊天机器人，而是把岗位目标、学习计划、评估证据和简历表达放进同一条成长链路，让学生每一次学习都能靠近真实职业目标。'
    focus = @{ x = 50; y = 48; scaleStart = 1.02; scaleEnd = 1.08 }
    stats = @(@{ label = '真实产品页面'; value = '16+' }, @{ label = '核心闭环模块'; value = '9' })
    callouts = @(@{ text = '从职业目标开始，而不是从课程列表开始'; x = 58; y = 40 })
  },
  @{
    id = 'scene_02'
    chapter = '02 成长闭环'
    title = '把学习、岗位和证据连成闭环'
    subtitle = '目标岗位定义方向，学习过程持续沉淀能力证据。'
    asset = 'project-showcase/assets/d-02-career-loop.png'
    assetKind = 'diagram'
    durationSec = 17
    narration = '智途的核心逻辑是一条闭环。系统先解析目标岗位，再识别用户差距，生成主线和支线计划。学习产生提交，评估形成证据，能力画像反过来影响岗位匹配和简历生成。'
    focus = @{ x = 50; y = 50; scaleStart = 1.00; scaleEnd = 1.05 }
    stats = @(@{ label = '岗位到学习'; value = '闭环' }, @{ label = '能力证据'; value = '持续累积' })
    callouts = @(@{ text = '岗位、计划、评估、画像、简历互相回写'; x = 56; y = 52 })
  },
  @{
    id = 'scene_03'
    chapter = '03 学生工作台'
    title = '学生首页：今日任务和成长态势'
    subtitle = '用户进入后先看到行动优先级，而不是零散功能入口。'
    asset = 'project-showcase/assets/02-dashboard.png'
    assetKind = 'screenshot'
    durationSec = 16
    narration = '学生端首页把今日任务、学习进度、岗位匹配和能力变化集中到一个工作台。用户不用在多个工具之间搬运信息，系统会把下一步最该做的事情推到前面。'
    focus = @{ x = 50; y = 45; scaleStart = 1.02; scaleEnd = 1.09 }
    stats = @(@{ label = '首页聚合'; value = '任务' }, @{ label = '能力状态'; value = '可追踪' })
    callouts = @(@{ text = '任务、匹配、能力状态同屏呈现'; x = 70; y = 38 })
  },
  @{
    id = 'scene_04'
    chapter = '04 AI 助教'
    title = '对话不是终点，动作才是结果'
    subtitle = '聊天区可以触发讲义、图解、视频、练习和学习计划。'
    asset = 'project-showcase/assets/03-chat.png'
    assetKind = 'screenshot'
    durationSec = 17
    narration = 'AI 助教并不只给一段回答。它会结合当前页面、用户画像和最近学习上下文识别意图，再把请求路由到不同智能体，生成可以进入资源台账的讲义、图解、代码练习或视频任务。'
    focus = @{ x = 50; y = 55; scaleStart = 1.02; scaleEnd = 1.10 }
    stats = @(@{ label = '意图路由'; value = '上下文感知' }, @{ label = '生成结果'; value = '入台账' })
    callouts = @(@{ text = '从回答升级为可执行任务'; x = 46; y = 58 })
  },
  @{
    id = 'scene_05'
    chapter = '05 学习路线'
    title = '岗位主线与自选支线并行'
    subtitle = '主线服务就业目标，支线承载兴趣探索和补强技能。'
    asset = 'project-showcase/assets/04-learning.png'
    assetKind = 'screenshot'
    durationSec = 16
    narration = '学习页面采用类似 Git 分支的结构。目标岗位对应 main 主线，兴趣探索和补强技能是 side 支线。多个目标可以并行推进，每次完成任务都会留下可回溯的学习提交。'
    focus = @{ x = 52; y = 52; scaleStart = 1.02; scaleEnd = 1.10 }
    stats = @(@{ label = '主线'; value = '岗位驱动' }, @{ label = '支线'; value = '兴趣补强' })
    callouts = @(@{ text = '同一能力画像支撑多条学习分支'; x = 60; y = 45 })
  },
  @{
    id = 'scene_06'
    chapter = '06 岗位搜索'
    title = '本地岗位与联网岗位一起看'
    subtitle = '系统区分真实来源、抓取时间和 AI 建议，避免混淆。'
    asset = 'project-showcase/assets/05-jobs.png'
    assetKind = 'screenshot'
    durationSec = 17
    narration = '岗位页同时支持本地岗位库和联网搜索。联网链路会保留来源站点、原始链接和抓取时间；如果网络失败，系统回退到本地岗位，不把 AI 猜测包装成真实招聘。'
    focus = @{ x = 55; y = 48; scaleStart = 1.02; scaleEnd = 1.11 }
    stats = @(@{ label = '来源透明'; value = 'URL' }, @{ label = '失败降级'; value = '本地库' })
    callouts = @(@{ text = '真实岗位、联网结果、AI 建议分清楚'; x = 66; y = 34 })
  },
  @{
    id = 'scene_07'
    chapter = '07 岗位详情'
    title = '六因子匹配解释差距'
    subtitle = '匹配分数被拆成技能、项目、考试、进度和速度等证据。'
    asset = 'project-showcase/assets/06-job-detail.png'
    assetKind = 'screenshot'
    durationSec = 18
    narration = '岗位详情页不是只给一个总分，而是展示六因子匹配。系统说明已匹配技能、缺失技能、项目证据、学习进度和投递门槛，把差距直接转化成下一步学习任务。地图服务也在这里展示公司位置和静态地图。'
    focus = @{ x = 55; y = 52; scaleStart = 1.02; scaleEnd = 1.10 }
    stats = @(@{ label = '匹配模型'; value = '6 因子' }, @{ label = '地图接入'; value = '高德' })
    callouts = @(@{ text = '差距分析直接连接学习任务'; x = 66; y = 58 }, @{ text = '公司位置解析与地图展示'; x = 73; y = 31 })
  },
  @{
    id = 'scene_08'
    chapter = '08 能力画像'
    title = '二维雷达与三维能力图谱'
    subtitle = '能力不是静态标签，而是由学习证据不断更新的数字画像。'
    asset = 'project-showcase/assets/07-profile.png'
    assetKind = 'screenshot'
    durationSec = 17
    narration = '能力画像页同时展示基础雷达、三维能力图谱和历史快照。每个维度都能回到具体提交、考试或项目证据，回答能力在什么时候、因为什么发生了变化。'
    focus = @{ x = 48; y = 51; scaleStart = 1.02; scaleEnd = 1.10 }
    stats = @(@{ label = '能力维度'; value = '6' }, @{ label = '历史状态'; value = '快照' })
    callouts = @(@{ text = '能力变化可以追溯到具体证据'; x = 58; y = 50 })
  },
  @{
    id = 'scene_09'
    chapter = '09 Git 化学习'
    title = '学习也可以 Commit、Compare、Merge'
    subtitle = '借鉴版本管理思想表达多目标学习和能力演进。'
    asset = 'project-showcase/assets/08-progress.png'
    assetKind = 'screenshot'
    durationSec = 18
    narration = '进度页把学习动作抽象成提交。完成任务后形成 Commit，能力状态形成 Snapshot，分支之间可以 Compare，确认有效的成果可以 Merge 回主线。Rollback 只移动指针，不删除历史。'
    focus = @{ x = 51; y = 50; scaleStart = 1.02; scaleEnd = 1.10 }
    stats = @(@{ label = '学习提交'; value = 'Commit' }, @{ label = '分支对比'; value = 'Compare' })
    callouts = @(@{ text = '多目标并行，历史可回溯'; x = 63; y = 45 })
  },
  @{
    id = 'scene_10'
    chapter = '10 评估闭环'
    title = '考试和错题进入能力证据链'
    subtitle = '分数不只是结果，还会影响画像、计划和岗位匹配。'
    asset = 'project-showcase/assets/10-exams.png'
    assetKind = 'screenshot'
    durationSec = 16
    narration = '考试中心记录正式测评和快速测试。系统把 Attempt、Result、DimensionScore、Evidence 和 Impact 串成证据链，说明一次评估怎样影响技能画像、学习计划和岗位匹配。'
    focus = @{ x = 50; y = 50; scaleStart = 1.02; scaleEnd = 1.09 }
    stats = @(@{ label = '评估记录'; value = 'Attempt' }, @{ label = '业务影响'; value = 'Impact' })
    callouts = @(@{ text = '成绩会回写能力和计划'; x = 61; y = 46 })
  },
  @{
    id = 'scene_11'
    chapter = '11 错题复习'
    title = '薄弱点复习不是题目堆叠'
    subtitle = '错题被重新组织为技能缺口、复习建议和后续练习。'
    asset = 'project-showcase/assets/11-wrong-answers.png'
    assetKind = 'screenshot'
    durationSec = 15
    narration = '错题本把错误答案归因到知识点和能力维度。它不是简单保存题目，而是辅助用户识别薄弱点，生成复习建议，并把后续练习重新接回学习路径。'
    focus = @{ x = 52; y = 52; scaleStart = 1.02; scaleEnd = 1.09 }
    stats = @(@{ label = '薄弱点'; value = '归因' }, @{ label = '复习路径'; value = '联动' })
    callouts = @(@{ text = '错题回到能力成长链路'; x = 57; y = 47 })
  },
  @{
    id = 'scene_12'
    chapter = '12 智能简历'
    title = '简历来自事实证据，而不是凭空包装'
    subtitle = '项目、技能、校园经历和岗位要求共同驱动版本生成。'
    asset = 'project-showcase/assets/09-resume.png'
    assetKind = 'screenshot'
    durationSec = 16
    narration = '智能简历模块读取用户画像、项目经历、学习证据和目标岗位要求，生成可编辑的岗位定制版本。简历内容不是凭空包装，而是尽量回到系统已经沉淀的事实。'
    focus = @{ x = 50; y = 50; scaleStart = 1.02; scaleEnd = 1.09 }
    stats = @(@{ label = '岗位定制'; value = 'Resume' }, @{ label = '证据来源'; value = '画像' })
    callouts = @(@{ text = '从能力证据生成表达材料'; x = 58; y = 50 })
  },
  @{
    id = 'scene_13'
    chapter = '13 智能体办公室'
    title = '让后台 AI 工作过程可见'
    subtitle = '长任务、状态、失败恢复和资源台账集中展示。'
    asset = 'project-showcase/assets/12-agent-office.png'
    assetKind = 'screenshot'
    durationSec = 18
    narration = '智能体办公室把后台任务可视化。用户能看到哪个智能体正在工作，任务进行到哪一步，哪些资源已经完成，失败发生在哪里。单个任务失败时，已完成的局部结果仍然保留并可重试。'
    focus = @{ x = 52; y = 50; scaleStart = 1.02; scaleEnd = 1.10 }
    stats = @(@{ label = '异步任务'; value = 'SSE' }, @{ label = '资源结果'; value = '台账' })
    callouts = @(@{ text = 'AI 后台任务变成可观察流程'; x = 62; y = 36 })
  },
  @{
    id = 'scene_14'
    chapter = '14 多智能体架构'
    title = '一个编排器，多个专业执行者'
    subtitle = 'Orchestrator 负责拆解动作，专业智能体负责生成和校验。'
    asset = 'project-showcase/assets/d-04-multi-agent.png'
    assetKind = 'diagram'
    durationSec = 17
    narration = '系统没有把所有能力交给一个万能提示词。编排器先理解用户请求，再调度画像、路径、讲义、代码、考试、岗位、简历和审核等专业智能体。长任务进入队列，状态通过事件流返回前端。'
    focus = @{ x = 50; y = 50; scaleStart = 1.00; scaleEnd = 1.06 }
    stats = @(@{ label = '智能体角色'; value = '专业化' }, @{ label = '任务调度'; value = '队列' })
    callouts = @(@{ text = '拆解、调度、生成、沉淀各有边界'; x = 58; y = 48 })
  },
  @{
    id = 'scene_15'
    chapter = '15 多模态资源'
    title = '生成内容进入学习流程'
    subtitle = '图解、视频、计划和任务互相关联，而不是一次性素材。'
    asset = 'project-showcase/assets/15-multimodal-memory-workflow.png'
    assetKind = 'screenshot'
    durationSec = 16
    narration = '多模态资源不是展示用的装饰。系统可以生成讲义、技术图解、代码练习、延伸阅读、测验和视频，并把它们关联到学习计划、任务和资源台账。'
    focus = @{ x = 50; y = 50; scaleStart = 1.00; scaleEnd = 1.07 }
    stats = @(@{ label = '资源类型'; value = '6+' }, @{ label = '学习联动'; value = '计划' })
    callouts = @(@{ text = '生成结果进入长期学习流程'; x = 60; y = 52 })
  },
  @{
    id = 'scene_16'
    chapter = '16 视频学习链路'
    title = '教学视频和专项计划可以协同'
    subtitle = '视频产物、任务状态和学习路径共同服务一个目标。'
    asset = 'project-showcase/assets/16-multimodal-video-learning-path.png'
    assetKind = 'screenshot'
    durationSec = 16
    narration = '这张实机图展示了视频生成和专项学习计划的联动。视频不是孤立文件，而是由脚本、配音、渲染和资源记录组成的任务结果，完成后继续服务学习路径。'
    focus = @{ x = 50; y = 50; scaleStart = 1.00; scaleEnd = 1.07 }
    stats = @(@{ label = '视频管线'; value = 'Remotion' }, @{ label = '任务结果'; value = '可追踪' })
    callouts = @(@{ text = '本片也由项目视频管线生成'; x = 57; y = 52 })
  },
  @{
    id = 'scene_17'
    chapter = '17 管理后台'
    title = '学生端之外，还有运营和管理视角'
    subtitle = '后台负责岗位、数据、题库和业务状态的集中维护。'
    asset = 'project-showcase/assets/13-admin-dashboard.png'
    assetKind = 'screenshot'
    durationSec = 15
    narration = '管理端提供业务看板和岗位维护能力。学校或运营人员可以看到平台数据、管理岗位、题库和资源，让学生端闭环背后有稳定的数据治理入口。'
    focus = @{ x = 50; y = 50; scaleStart = 1.02; scaleEnd = 1.09 }
    stats = @(@{ label = '管理入口'; value = 'Admin' }, @{ label = '岗位维护'; value = '数据治理' })
    callouts = @(@{ text = '闭环需要后台数据治理支撑'; x = 58; y = 43 })
  },
  @{
    id = 'scene_18'
    chapter = '18 工程架构'
    title = '已落地的工程系统'
    subtitle = 'React、NestJS、MySQL、Redis、队列、搜索和多智能体协同运行。'
    asset = 'project-showcase/assets/d-01-overall-architecture.png'
    assetKind = 'diagram'
    durationSec = 20
    narration = '最后看整体架构。前端由 React、TypeScript、Vite 和可视化组件承载工作台；后端由 NestJS 控制业务边界；MySQL 是核心事实源，Redis、BullMQ、SearXNG、Browserless 和多智能体服务共同支撑长任务与真实岗位检索。智途的价值，是让学习从完成课程，变成可验证、可回溯、可表达的职业能力成长。'
    focus = @{ x = 50; y = 50; scaleStart = 1.00; scaleEnd = 1.06 }
    stats = @(@{ label = '数据库结构'; value = '33 表' }, @{ label = '实机页面'; value = '16+' })
    callouts = @(@{ text = '工程系统支撑完整职业成长闭环'; x = 57; y = 52 })
  }
)

function Get-WavDurationSec {
  param([string]$Path)

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $reader = New-Object System.IO.BinaryReader($stream)
    $riff = [System.Text.Encoding]::ASCII.GetString($reader.ReadBytes(4))
    if ($riff -ne 'RIFF') { throw "Not a RIFF file: $Path" }
    [void]$reader.ReadUInt32()
    $wave = [System.Text.Encoding]::ASCII.GetString($reader.ReadBytes(4))
    if ($wave -ne 'WAVE') { throw "Not a WAVE file: $Path" }

    $byteRate = 0
    $dataSize = 0
    while ($stream.Position -lt $stream.Length) {
      $chunkId = [System.Text.Encoding]::ASCII.GetString($reader.ReadBytes(4))
      $chunkSize = $reader.ReadUInt32()
      if ($chunkId -eq 'fmt ') {
        [void]$reader.ReadUInt16()
        [void]$reader.ReadUInt16()
        [void]$reader.ReadUInt32()
        $byteRate = $reader.ReadUInt32()
        $remaining = [int]$chunkSize - 12
        if ($remaining -gt 0) { [void]$reader.ReadBytes($remaining) }
      } elseif ($chunkId -eq 'data') {
        $dataSize = $chunkSize
        $stream.Position += $chunkSize
      } else {
        $stream.Position += $chunkSize
      }
      if (($chunkSize % 2) -eq 1) { $stream.Position += 1 }
    }

    if ($byteRate -le 0 -or $dataSize -le 0) { throw "Cannot read WAV duration: $Path" }
    return [Math]::Round(($dataSize / $byteRate) + 0.35, 3)
  } finally {
    $stream.Dispose()
  }
}

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'zh-CN' } | Select-Object -First 1
if ($voice) {
  $synth.SelectVoice($voice.VoiceInfo.Name)
}
$synth.Rate = 2
$synth.Volume = 100

$audioSegments = @()
foreach ($scene in $scenes) {
  $wavPath = Join-Path $audioDir "$($scene.id).wav"
  $synth.SetOutputToWaveFile($wavPath)
  $synth.Speak($scene.narration)
  $synth.SetOutputToNull()
  $duration = Get-WavDurationSec -Path $wavPath
  $scene.durationSec = $duration
  $audioSegments += @{
    id = $scene.id
    file_path = $wavPath
    duration_sec = $duration
  }
}
$synth.Dispose()

$manifest = @{
  title = '智途 ZhiPath 项目介绍视频'
  generatedAt = (Get-Date).ToString('s')
  scenes = $scenes
  audioSegments = $audioSegments
}

$manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$total = 0
foreach ($audioSegment in $audioSegments) {
  $total += [double]$audioSegment.duration_sec
}
[PSCustomObject]@{
  Manifest = $manifestPath
  Scenes = $scenes.Count
  DurationSeconds = [Math]::Round($total, 2)
  DurationMinutes = [Math]::Round($total / 60, 2)
  Voice = if ($voice) { $voice.VoiceInfo.Name } else { 'default' }
}
