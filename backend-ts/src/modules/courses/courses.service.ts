import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseChapter } from '../../entities/course-chapter.entity';
import { CourseAbility } from '../../entities/course-ability.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LlmService } from '../../services/llm.service';
import { extractJson } from '../../common/json-repair';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(CourseChapter) private chapterRepo: Repository<CourseChapter>,
    @InjectRepository(CourseAbility) private abilityRepo: Repository<CourseAbility>,
    @InjectRepository(LearningPlan) private planRepo: Repository<LearningPlan>,
    private llmService: LlmService,
  ) {}

  // ────────────────────────────────────────
  //  章节 CRUD
  // ────────────────────────────────────────

  /** 获取章节树 */
  async getChapters(planId: number, userId: number) {
    const chapters = await this.chapterRepo.find({
      where: { planId, userId, status: 1 },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return this.buildTree(chapters, null);
  }

  /** AI 生成章节目录 */
  async generateChapters(planId: number, userId: number) {
    const plan = await this.planRepo.findOne({ where: { id: planId, userId } });
    if (!plan) throw new NotFoundException('学习计划不存在');

    const phases = plan.pathData?.phases || plan.pathData?.skills || [];
    if (!phases.length) throw new BadRequestException('计划中没有阶段数据');

    // 清除旧章节（软删除）
    await this.chapterRepo.update({ planId, userId, status: 1 }, { status: 0, updateTime: Date.now() });

    const now = Date.now();
    const allChapters: CourseChapter[] = [];
    let sortOrder = 0;

    for (const phase of phases) {
      const phaseName = phase.name || phase.phaseName || phase.skillName || '未命名阶段';
      const skills = phase.skills || phase.items || [];

      // 创建阶段节点（level 1）
      const phaseChapter = await this.chapterRepo.save({
        userId,
        planId,
        name: phaseName,
        level: 1,
        parentId: null,
        sortOrder: sortOrder++,
        skillName: phaseName,
        status: 1,
        createTime: now,
        updateTime: now,
      });
      allChapters.push(phaseChapter);

      // 如果有子技能，为每个技能创建子章节
      if (skills.length > 0) {
        for (const skill of skills) {
          const skillName = typeof skill === 'string' ? skill : skill.name || skill.skillName || '未命名';
          // 尝试 AI 生成子章节
          let children: { name: string }[] = [];
          try {
            children = await this.generateSubChapters(skillName);
          } catch {
            // AI 失败时用默认子章节
            children = [{ name: `${skillName}基础` }, { name: `${skillName}进阶` }];
          }

          for (const child of children) {
            allChapters.push(
              await this.chapterRepo.save({
                userId,
                planId,
                name: child.name,
                level: 2,
                parentId: phaseChapter.id,
                sortOrder: sortOrder++,
                skillName,
                status: 1,
                createTime: now,
                updateTime: now,
              }),
            );
          }
        }
      }
    }

    return allChapters;
  }

  /** 解析树形文本为章节列表 */
  async parseTreeText(planId: number, userId: number, treeText: string) {
    if (!treeText?.trim()) throw new BadRequestException('treeText 不能为空');

    const nodes = this.buildChapterNodesFromTree(treeText);

    // 清除旧章节
    await this.chapterRepo.update({ planId, userId, status: 1 }, { status: 0, updateTime: Date.now() });

    const now = Date.now();
    const saved: CourseChapter[] = [];
    const idMap = new Map<number, number>(); // tmpId → realId
    let sortOrder = 0;

    for (const node of nodes) {
      const parentId = node.parentTmpId != null ? idMap.get(node.parentTmpId) ?? null : null;
      const entity = await this.chapterRepo.save({
        userId,
        planId,
        name: node.name,
        level: node.level,
        parentId,
        sortOrder: sortOrder++,
        status: 1,
        createTime: now,
        updateTime: now,
      });
      idMap.set(node.tmpId, entity.id);
      saved.push(entity);
    }

    return saved;
  }

  /** 更新章节 */
  async updateChapter(id: number, data: Partial<CourseChapter>) {
    const chapter = await this.chapterRepo.findOne({ where: { id, status: 1 } });
    if (!chapter) throw new NotFoundException('章节不存在');

    const allowed = ['name', 'sortOrder', 'skillName', 'abilityId'];
    for (const key of allowed) {
      if (data[key] !== undefined) (chapter as any)[key] = data[key];
    }
    chapter.updateTime = Date.now();
    return this.chapterRepo.save(chapter);
  }

  /** 删除章节（软删除） */
  async deleteChapter(id: number) {
    const chapter = await this.chapterRepo.findOne({ where: { id, status: 1 } });
    if (!chapter) throw new NotFoundException('章节不存在');

    // 同时软删除子章节
    await this.chapterRepo.update({ parentId: id, status: 1 }, { status: 0, updateTime: Date.now() });
    chapter.status = 0;
    chapter.updateTime = Date.now();
    return this.chapterRepo.save(chapter);
  }

  // ────────────────────────────────────────
  //  能力点 CRUD
  // ────────────────────────────────────────

  /** 获取能力点列表 */
  async getAbilities(planId: number, userId: number) {
    return this.abilityRepo.find({
      where: { planId, userId, status: 1 },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  /** AI 生成能力点 */
  async generateAbilities(planId: number, userId: number) {
    const plan = await this.planRepo.findOne({ where: { id: planId, userId } });
    if (!plan) throw new NotFoundException('学习计划不存在');

    const direction = plan.planName || '通用技能';
    const prompt = `请为学习方向"${direction}"生成4-8个能力点，name不超过8个字, description不超过50个字，输出JSON数组 [{name, description}]`;

    const raw = await this.llmService.chatCompletion(
      [{ role: 'user', content: prompt }],
      { tier: 'flash', temperature: 0.7 },
    );

    const abilities = extractJson(raw) as { name: string; description: string }[];
    if (!Array.isArray(abilities)) throw new Error('AI 返回格式错误');

    // 清除旧能力点
    await this.abilityRepo.update({ planId, userId, status: 1 }, { status: 0, updateTime: Date.now() });

    const now = Date.now();
    const saved: CourseAbility[] = [];
    for (let i = 0; i < abilities.length; i++) {
      const a = abilities[i];
      saved.push(
        await this.abilityRepo.save({
          userId,
          planId,
          name: a.name?.slice(0, 50) || `能力${i + 1}`,
          description: a.description?.slice(0, 200) || null,
          sortOrder: i,
          status: 1,
          createTime: now,
          updateTime: now,
        }),
      );
    }

    return saved;
  }

  /** 保存能力点 + AI 匹配章节映射 */
  async saveAbilities(planId: number, userId: number, abilities: { name: string; description?: string }[]) {
    if (!abilities?.length) throw new BadRequestException('能力点列表不能为空');

    // 清除旧能力点
    await this.abilityRepo.update({ planId, userId, status: 1 }, { status: 0, updateTime: Date.now() });

    const now = Date.now();
    const saved: CourseAbility[] = [];
    for (let i = 0; i < abilities.length; i++) {
      const a = abilities[i];
      saved.push(
        await this.abilityRepo.save({
          userId,
          planId,
          name: a.name?.slice(0, 50) || `能力${i + 1}`,
          description: a.description?.slice(0, 200) || null,
          sortOrder: i,
          status: 1,
          createTime: now,
          updateTime: now,
        }),
      );
    }

    // 异步匹配章节映射（不阻塞返回）
    this.matchChapterAbility(planId).catch((e) =>
      console.error('[Courses] matchChapterAbility after save failed:', e.message),
    );

    return saved;
  }

  /** AI 匹配章节-能力映射（多轮重试） */
  async matchChapterAbility(planId: number, maxRetries = 3) {
    const chapters = await this.chapterRepo.find({ where: { planId, status: 1 } });
    const abilities = await this.abilityRepo.find({ where: { planId, status: 1 } });

    if (!chapters.length || !abilities.length) {
      return { matched: 0, message: '章节或能力点为空' };
    }

    const chapterList = chapters.map((c) => `[${c.id}] ${c.name}`).join('\n');
    const abilityList = abilities.map((a) => `[${a.id}] ${a.name}`).join('\n');

    const prompt = `你是一个课程规划专家。请将以下章节与能力点进行匹配映射。

章节列表：
${chapterList}

能力点列表：
${abilityList}

请输出JSON数组，每个元素格式: {"chapterId": 章节ID, "abilityId": 能力点ID}
只匹配有明确关联的章节，一个章节最多匹配一个能力点。输出纯JSON数组。`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const raw = await this.llmService.chatCompletion(
          [{ role: 'user', content: prompt }],
          { tier: 'flash', temperature: 0.3 },
        );

        const mappings = extractJson(raw) as { chapterId: number; abilityId: number }[];
        if (!Array.isArray(mappings)) continue;

        const abilityIds = new Set(abilities.map((a) => a.id));
        let matched = 0;

        for (const m of mappings) {
          const chapter = chapters.find((c) => c.id === m.chapterId);
          if (chapter && abilityIds.has(m.abilityId)) {
            chapter.abilityId = m.abilityId;
            chapter.updateTime = Date.now();
            await this.chapterRepo.save(chapter);
            matched++;
          }
        }

        return { matched, total: mappings.length };
      } catch (e: any) {
        console.warn(`[Courses] matchChapterAbility attempt ${attempt + 1} failed:`, e.message);
        if (attempt === maxRetries - 1) throw e;
      }
    }

    return { matched: 0, message: '匹配失败，已用完重试次数' };
  }

  // ────────────────────────────────────────
  //  私有辅助方法
  // ────────────────────────────────────────

  /** 构建树形结构 */
  private buildTree(chapters: CourseChapter[], parentId: number | null): any[] {
    return chapters
      .filter((c) => c.parentId === parentId)
      .map((c) => ({
        ...c,
        children: this.buildTree(chapters, c.id),
      }));
  }

  /** 调用 LLM 为单个技能生成子章节 */
  private async generateSubChapters(skillName: string): Promise<{ name: string }[]> {
    const prompt = `请为技能"${skillName}"生成3-5个学习章节，输出JSON数组 [{name, children: [{name}]}]
要求：
1. 从基础到进阶排列
2. 每个章节name不超过20个字
3. children是可选的子节
4. 输出纯JSON，不要解释`;

    const raw = await this.llmService.chatCompletion(
      [{ role: 'user', content: prompt }],
      { tier: 'flash', temperature: 0.7 },
    );

    const result = extractJson(raw);
    if (Array.isArray(result)) {
      // 展开带 children 的结构为扁平列表
      const flat: { name: string }[] = [];
      for (const item of result) {
        flat.push({ name: item.name });
        if (Array.isArray(item.children)) {
          for (const child of item.children) {
            flat.push({ name: child.name });
          }
        }
      }
      return flat;
    }
    return [{ name: `${skillName}基础` }, { name: `${skillName}进阶` }];
  }

  /**
   * 解析树形文本为节点列表 — 移植自 cqcet _build_chapter_nodes_from_tree
   *
   * 支持格式：
   * - Markdown 标题: # / ## / ###
   * - 列表: - / * / 1.
   * - 树形符号: ├ └ │ ─
   *
   * 用栈维护父子关系，限制3层深度
   */
  private buildChapterNodesFromTree(text: string): {
    tmpId: number;
    name: string;
    level: number;
    parentTmpId: number | null;
  }[] {
    const lines = text.split('\n').filter((l) => l.trim());
    const nodes: { tmpId: number; name: string; level: number; parentTmpId: number | null }[] = [];
    const stack: { tmpId: number; level: number }[] = [];
    let tmpIdCounter = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let level = 0;
      let name = '';

      // Markdown 标题: # / ## / ###
      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        level = headingMatch[1].length;
        name = headingMatch[2].trim();
      }
      // 树形符号: ├── / └── / │   等
      else if (/^[│├└─\s]+$/.test(trimmed.substring(0, trimmed.search(/[^\s│├└─]/) >= 0 ? trimmed.search(/[^\s│├└─]/) : trimmed.length)) && trimmed.search(/[^\s│├└─]/) >= 0) {
        const prefixLen = trimmed.search(/[^\s│├└─]/);
        // 根据前缀中 └├ 的数量判断层级
        const branchCount = (trimmed.substring(0, prefixLen).match(/[├└]/g) || []).length;
        level = branchCount > 0 ? branchCount : Math.floor(prefixLen / 4) + 1;
        name = trimmed.substring(prefixLen).replace(/^[-*]\s*/, '').trim();
      }
      // 列表项: - / * / 1.
      else if (/^[-*]\s+(.+)$/.test(trimmed)) {
        name = trimmed.replace(/^[-*]\s+/, '').trim();
        // 根据缩进判断层级
        const indent = line.length - line.trimStart().length;
        level = indent >= 4 ? 2 : 1;
      } else if (/^\d+[.)]\s+(.+)$/.test(trimmed)) {
        name = trimmed.replace(/^\d+[.)]\s+/, '').trim();
        const indent = line.length - line.trimStart().length;
        level = indent >= 4 ? 2 : 1;
      }
      // 纯文本（无特殊前缀）— 根据缩进判断
      else {
        name = trimmed;
        const indent = line.length - line.trimStart().length;
        level = indent >= 8 ? 3 : indent >= 4 ? 2 : 1;
      }

      // 限制3层
      level = Math.min(level, 3);
      if (!name) continue;

      // 栈维护父子关系
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parentTmpId = stack.length > 0 ? stack[stack.length - 1].tmpId : null;
      const node = { tmpId: tmpIdCounter++, name, level, parentTmpId };
      nodes.push(node);
      stack.push({ tmpId: node.tmpId, level });
    }

    return nodes;
  }
}
