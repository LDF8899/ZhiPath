import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { TransactionalCommandService } from '../../platform/transactional-command/transactional-command.service';
import { CreateLearningGoalDto } from './dto/create-learning-goal.dto';
import { PageQueryDto } from './dto/page-query.dto';
import { UpdateLearningActivityStatusDto } from './dto/update-learning-activity-status.dto';
import { StartAssessmentAttemptDto } from './dto/start-assessment-attempt.dto';
import { SubmitAssessmentAttemptDto } from './dto/submit-assessment-attempt.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { CreateLearningPathNodeDto } from './dto/create-learning-path-node.dto';
import { CreateLearningPathEdgeDto } from './dto/create-learning-path-edge.dto';
import { CreateLearningActivityDto } from './dto/create-learning-activity.dto';
import { UpdateLearningPathStatusDto } from './dto/update-learning-path-status.dto';
import { LearningDomainRegistry } from '../learning-domain.registry';

@Injectable()
export class PlatformLearningService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly commands: TransactionalCommandService,
    private readonly domainRegistry?: LearningDomainRegistry,
  ) {}

  /** 公共学习领域目录属于平台读模型，不复制到各客户端。 */
  listLearningDomains() {
    return this.domainRegistry?.list() || [];
  }

  getLearningDomain(domainId: string) {
    if (!this.domainRegistry) throw new NotFoundException('学习领域目录未加载');
    return this.domainRegistry.get(domainId);
  }

  async listPaths(tenantId: number, userId: number, query: PageQueryDto) {
    const offset = (query.page - 1) * query.pageSize;
    const [items, countRows] = await Promise.all([
      this.dataSource.query(
        `SELECT p.public_id AS id, p.name, p.path_kind AS pathKind, p.path_kind AS kind,
                p.lifecycle_status AS status, p.version_no AS version,
                p.current_phase AS currentPhase, p.daily_minutes AS dailyMinutes,
                p.legacy_plan_id AS legacyPlanId, p.snapshot_json AS snapshot,
                g.public_id AS goalId, g.goal_type AS goalType, g.title AS goalTitle,
                g.domain_key AS domainKey, p.updated_at AS updatedAt
           FROM learning_paths p JOIN learning_goals g ON g.id = p.goal_id
          WHERE p.tenant_id = ? AND p.user_id = ? AND p.deleted_at IS NULL
          ORDER BY p.updated_at DESC, p.id DESC LIMIT ? OFFSET ?`,
        [tenantId, userId, query.pageSize, offset],
      ),
      this.dataSource.query(
        'SELECT COUNT(*) AS total FROM learning_paths WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL',
        [tenantId, userId],
      ),
    ]);
    const total = Number(countRows[0]?.total || 0);
    return {
      items: items.map((item: any) => ({
        ...item,
        legacyPlanId: item.legacyPlanId === null || item.legacyPlanId === undefined ? null : Number(item.legacyPlanId),
        currentPhase: Number(item.currentPhase || 0),
        version: Number(item.version || 1),
        dailyMinutes: item.dailyMinutes === null || item.dailyMinutes === undefined ? null : Number(item.dailyMinutes),
        snapshot: this.parseJson(item.snapshot),
      })),
      pageInfo: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        hasNextPage: offset + items.length < total,
      },
    };
  }

  async getPath(tenantId: number, userId: number, publicId: string) {
    const paths = await this.dataSource.query(
      `SELECT p.id AS internalId, p.public_id AS id, p.name, p.path_kind AS pathKind, p.path_kind AS kind,
              p.lifecycle_status AS status, p.version_no AS version,
              p.current_phase AS currentPhase, p.daily_minutes AS dailyMinutes,
              p.legacy_plan_id AS legacyPlanId, p.snapshot_json AS snapshot,
              g.public_id AS goalId, g.goal_type AS goalType,
              g.title AS goalTitle, g.domain_key AS domainKey
         FROM learning_paths p JOIN learning_goals g ON g.id = p.goal_id
        WHERE p.public_id = ? AND p.tenant_id = ? AND p.user_id = ? AND p.deleted_at IS NULL`,
      [publicId, tenantId, userId],
    );
    if (!paths.length) throw new NotFoundException('学习路径不存在');
    const path = paths[0];
    const [nodes, edges] = await Promise.all([
      this.dataSource.query(
        `SELECT n.public_id AS id, parent.public_id AS parentId, c.public_id AS competencyId,
                n.node_key AS nodeKey, n.node_type AS type, n.title, n.position_no AS position,
                n.lifecycle_status AS status, n.metadata_json AS metadata
           FROM learning_path_nodes n
           LEFT JOIN learning_path_nodes parent ON parent.id = n.parent_node_id
           LEFT JOIN competencies c ON c.id = n.competency_id
          WHERE n.path_id = ? ORDER BY n.position_no, n.id`,
        [path.internalId],
      ),
      this.dataSource.query(
        `SELECT source.public_id AS fromId, target.public_id AS toId, edge.edge_type AS type
           FROM learning_path_edges edge
           JOIN learning_path_nodes source ON source.id = edge.from_node_id
           JOIN learning_path_nodes target ON target.id = edge.to_node_id
          WHERE edge.path_id = ? ORDER BY edge.id`,
        [path.internalId],
      ),
    ]);
    delete path.internalId;
    return {
      ...path,
      legacyPlanId: path.legacyPlanId === null || path.legacyPlanId === undefined ? null : Number(path.legacyPlanId),
      currentPhase: Number(path.currentPhase || 0),
      version: Number(path.version || 1),
      dailyMinutes: path.dailyMinutes === null || path.dailyMinutes === undefined ? null : Number(path.dailyMinutes),
      snapshot: this.parseJson(path.snapshot),
      nodes,
      edges,
    };
  }

  async createPathNode(input: {
    tenantId: number;
    userId: number;
    clientApp: string;
    requestId: string;
    idempotencyKey: string;
    ipAddress?: string;
    pathId: string;
    dto: CreateLearningPathNodeDto;
  }) {
    return this.commands.execute(
      input,
      '/api/v1/learning-paths/:id/nodes',
      { pathId: input.pathId, ...input.dto },
      201,
      async ({ runner, emit, audit }) => {
        const paths = await runner.query(
          `SELECT id, version_no AS version FROM learning_paths
            WHERE public_id = ? AND tenant_id = ? AND user_id = ? AND deleted_at IS NULL
            FOR UPDATE`,
          [input.pathId, input.tenantId, input.userId],
        );
        if (!paths.length) throw new NotFoundException('学习路径不存在');
        const path = paths[0];
        const parent = input.dto.parentId
          ? await runner.query(
              `SELECT id FROM learning_path_nodes
                WHERE public_id = ? AND tenant_id = ? AND path_id = ?`,
              [input.dto.parentId, input.tenantId, path.id],
            )
          : [];
        if (input.dto.parentId && !parent.length) throw new NotFoundException('父节点不属于当前学习路径');
        const competency = input.dto.competencyId
          ? await runner.query(
              'SELECT id FROM competencies WHERE public_id = ? AND tenant_id = ?',
              [input.dto.competencyId, input.tenantId],
            )
          : [];
        if (input.dto.competencyId && !competency.length) throw new NotFoundException('能力不存在');

        const nodeId = randomUUID();
        try {
          await runner.query(
            `INSERT INTO learning_path_nodes
              (public_id, tenant_id, path_id, parent_node_id, competency_id, node_key,
               node_type, title, position_no, lifecycle_status, metadata_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              nodeId,
              input.tenantId,
              path.id,
              parent[0]?.id || null,
              competency[0]?.id || null,
              input.dto.nodeKey,
              input.dto.type,
              input.dto.title,
              input.dto.position,
              input.dto.status || 'planned',
              JSON.stringify(input.dto.metadata || {}),
            ],
          );
        } catch (error: any) {
          if (error?.code === 'ER_DUP_ENTRY' || error?.driverError?.code === 'ER_DUP_ENTRY') {
            throw new ConflictException('当前路径已存在相同 nodeKey');
          }
          throw error;
        }
        await runner.query(
          'UPDATE learning_paths SET version_no = version_no + 1, updated_at = NOW(3) WHERE id = ?',
          [path.id],
        );
        const response = {
          id: nodeId,
          pathId: input.pathId,
          parentId: input.dto.parentId || null,
          competencyId: input.dto.competencyId || null,
          nodeKey: input.dto.nodeKey,
          type: input.dto.type,
          title: input.dto.title,
          position: input.dto.position,
          status: input.dto.status || 'planned',
          pathVersion: Number(path.version) + 1,
        };
        await emit('learning_path', input.pathId, 'learning.path.node_added.v1', response);
        await audit('learning_path.node.create', 'learning_path_node', nodeId, response);
        return response;
      },
    );
  }

  async updatePathStatus(input: {
    tenantId: number;
    userId: number;
    clientApp: string;
    requestId: string;
    idempotencyKey: string;
    ipAddress?: string;
    pathId: string;
    dto: UpdateLearningPathStatusDto;
  }) {
    return this.commands.execute(
      input,
      '/api/v1/learning-paths/:id/status',
      { pathId: input.pathId, ...input.dto },
      200,
      async ({ runner, emit, audit }) => {
        const paths = await runner.query(
          `SELECT id, legacy_plan_id AS legacyPlanId, path_kind AS pathKind
             FROM learning_paths
            WHERE public_id = ? AND tenant_id = ? AND user_id = ? AND deleted_at IS NULL
            FOR UPDATE`,
          [input.pathId, input.tenantId, input.userId],
        );
        if (!paths.length) throw new NotFoundException('学习路径不存在');
        const path = paths[0];
        if (input.dto.status === 'active' && path.pathKind === 'main') {
          await runner.query(
            `UPDATE learning_paths
                SET lifecycle_status = 'archived', updated_at = NOW(3)
              WHERE tenant_id = ? AND user_id = ? AND path_kind = 'main'
                AND lifecycle_status = 'active' AND id <> ?`,
            [input.tenantId, input.userId, path.id],
          );
          await runner.query(
            `UPDATE learning_plans_v3
                SET plan_status = 'archived', schedule_enabled = 0, update_time = ?
              WHERE user_id = ? AND plan_type = 'main' AND plan_status = 'active' AND id <> ?`,
            [Date.now(), input.userId, path.legacyPlanId || 0],
          );
        }
        await runner.query(
          `UPDATE learning_paths
              SET lifecycle_status = ?, updated_at = NOW(3)
            WHERE id = ? AND tenant_id = ? AND user_id = ?`,
          [input.dto.status, path.id, input.tenantId, input.userId],
        );
        if (path.legacyPlanId) {
          await runner.query(
            `UPDATE learning_plans_v3
                SET plan_status = ?, schedule_enabled = ?, update_time = ?
              WHERE id = ? AND user_id = ?`,
            [input.dto.status, input.dto.status === 'active' ? 1 : 0, Date.now(), path.legacyPlanId, input.userId],
          );
        }
        const response = { id: input.pathId, status: input.dto.status };
        await emit('learning_path', input.pathId, 'learning.path.status_changed.v1', response);
        await audit('learning_path.status.update', 'learning_path', input.pathId, response);
        return response;
      },
    );
  }

  async createPathEdge(input: {
    tenantId: number;
    userId: number;
    clientApp: string;
    requestId: string;
    idempotencyKey: string;
    ipAddress?: string;
    pathId: string;
    dto: CreateLearningPathEdgeDto;
  }) {
    return this.commands.execute(
      input,
      '/api/v1/learning-paths/:id/edges',
      { pathId: input.pathId, ...input.dto },
      201,
      async ({ runner, emit, audit }) => {
        const paths = await runner.query(
          `SELECT id, version_no AS version FROM learning_paths
            WHERE public_id = ? AND tenant_id = ? AND user_id = ? AND deleted_at IS NULL
            FOR UPDATE`,
          [input.pathId, input.tenantId, input.userId],
        );
        if (!paths.length) throw new NotFoundException('学习路径不存在');
        const path = paths[0];
        const nodes = await runner.query(
          `SELECT id, public_id AS publicId FROM learning_path_nodes
            WHERE path_id = ? AND tenant_id = ? AND public_id IN (?, ?)`,
          [path.id, input.tenantId, input.dto.fromNodeId, input.dto.toNodeId],
        );
        if (nodes.length !== 2 || input.dto.fromNodeId === input.dto.toNodeId) {
          throw new ConflictException('边的起点和终点必须是当前路径中的两个不同节点');
        }
        const nodeByPublicId = new Map(nodes.map((node: any) => [node.publicId, node.id]));
        try {
          await runner.query(
            `INSERT INTO learning_path_edges (tenant_id, path_id, from_node_id, to_node_id, edge_type)
             VALUES (?, ?, ?, ?, ?)`,
            [
              input.tenantId,
              path.id,
              nodeByPublicId.get(input.dto.fromNodeId),
              nodeByPublicId.get(input.dto.toNodeId),
              input.dto.type || 'next',
            ],
          );
        } catch (error: any) {
          if (error?.code === 'ER_DUP_ENTRY' || error?.driverError?.code === 'ER_DUP_ENTRY') {
            throw new ConflictException('该路径关系已经存在');
          }
          throw error;
        }
        await runner.query(
          'UPDATE learning_paths SET version_no = version_no + 1, updated_at = NOW(3) WHERE id = ?',
          [path.id],
        );
        const response = {
          pathId: input.pathId,
          fromNodeId: input.dto.fromNodeId,
          toNodeId: input.dto.toNodeId,
          type: input.dto.type || 'next',
          pathVersion: Number(path.version) + 1,
        };
        await emit('learning_path', input.pathId, 'learning.path.edge_added.v1', response);
        await audit('learning_path.edge.create', 'learning_path', input.pathId, response);
        return response;
      },
    );
  }

  async listCompetencies(tenantId: number, userId: number) {
    return this.dataSource.query(
      `SELECT c.public_id AS id, c.competency_key AS competencyKey, c.name,
              c.domain_key AS domainKey, state.mastery_percent AS masteryPercent,
              state.confidence, state.evidence_version AS evidenceVersion,
              state.calculated_at AS calculatedAt
         FROM user_competency_states state
         JOIN competencies c ON c.id = state.competency_id
        WHERE state.tenant_id = ? AND state.user_id = ?
        ORDER BY state.mastery_percent DESC, c.name`,
      [tenantId, userId],
    );
  }

  async listActivities(tenantId: number, userId: number, query: PageQueryDto) {
    const offset = (query.page - 1) * query.pageSize;
    const [items, countRows] = await Promise.all([
      this.dataSource.query(
        `SELECT activity.public_id AS id, path.public_id AS pathId,
                node.public_id AS pathNodeId, competency.public_id AS competencyId,
                activity.activity_type AS type, activity.title,
                activity.activity_status AS status, activity.planned_date AS plannedDate,
                activity.estimated_minutes AS estimatedMinutes,
                activity.actual_minutes AS actualMinutes, activity.priority,
                activity.started_at AS startedAt, activity.completed_at AS completedAt,
                activity.updated_at AS updatedAt,
                activity.legacy_task_id AS legacyTaskId,
                path.legacy_plan_id AS legacyPlanId, path.path_kind AS pathKind
           FROM learning_activities activity
           JOIN learning_paths path ON path.id = activity.path_id
           LEFT JOIN learning_path_nodes node ON node.id = activity.path_node_id
           LEFT JOIN competencies competency ON competency.id = activity.competency_id
          WHERE activity.tenant_id = ? AND activity.user_id = ? AND activity.deleted_at IS NULL
          ORDER BY COALESCE(activity.planned_date, DATE(activity.created_at)) DESC,
                   activity.priority DESC, activity.id DESC
          LIMIT ? OFFSET ?`,
        [tenantId, userId, query.pageSize, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) AS total FROM learning_activities
          WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL`,
        [tenantId, userId],
      ),
    ]);
    const total = Number(countRows[0]?.total || 0);
    return {
      items,
      pageInfo: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        hasNextPage: offset + items.length < total,
      },
    };
  }

  async createActivity(input: {
    tenantId: number;
    userId: number;
    clientApp: string;
    requestId: string;
    idempotencyKey: string;
    ipAddress?: string;
    dto: CreateLearningActivityDto;
  }) {
    return this.commands.execute(
      input,
      '/api/v1/learning-activities',
      input.dto,
      201,
      async ({ runner, emit, audit }) => {
        const paths = await runner.query(
          `SELECT id, path_kind AS pathKind, legacy_plan_id AS legacyPlanId
             FROM learning_paths
            WHERE public_id = ? AND tenant_id = ? AND user_id = ? AND deleted_at IS NULL
            FOR UPDATE`,
          [input.dto.pathId, input.tenantId, input.userId],
        );
        if (!paths.length) throw new NotFoundException('学习路径不存在');
        const path = paths[0];
        const nodes = input.dto.pathNodeId
          ? await runner.query(
              `SELECT id FROM learning_path_nodes
                WHERE public_id = ? AND tenant_id = ? AND path_id = ?`,
              [input.dto.pathNodeId, input.tenantId, path.id],
            )
          : [];
        if (input.dto.pathNodeId && !nodes.length) throw new NotFoundException('路径节点不属于当前学习路径');
        const competencies = input.dto.competencyId
          ? await runner.query(
              'SELECT id FROM competencies WHERE public_id = ? AND tenant_id = ?',
              [input.dto.competencyId, input.tenantId],
            )
          : [];
        if (input.dto.competencyId && !competencies.length) throw new NotFoundException('能力不存在');

        const nowMs = Date.now();
        let legacyTaskId: number | null = null;
        if (path.legacyPlanId) {
          const legacyInsert = await runner.query(
            `INSERT INTO learning_tasks_v3
              (user_id, plan_id, skill_name, task_type, task_status, estimated_min,
               priority, plan_date, status, is_active, create_time, update_time)
             VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, 1, 1, ?, ?)`,
            [
              input.userId,
              path.legacyPlanId,
              input.dto.title,
              path.pathKind === 'side' ? 'side' : 'main',
              input.dto.estimatedMinutes || null,
              input.dto.priority || 5,
              input.dto.plannedDate || null,
              nowMs,
              nowMs,
            ],
          );
          legacyTaskId = Number(legacyInsert.insertId);
        }
        const activityId = randomUUID();
        await runner.query(
          `INSERT INTO learning_activities
            (public_id, tenant_id, user_id, path_id, path_node_id, competency_id,
             activity_type, title, activity_status, planned_date, estimated_minutes,
             priority, legacy_task_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?)`,
          [
            activityId,
            input.tenantId,
            input.userId,
            path.id,
            nodes[0]?.id || null,
            competencies[0]?.id || null,
            input.dto.type,
            input.dto.title,
            input.dto.plannedDate || null,
            input.dto.estimatedMinutes || null,
            input.dto.priority || 5,
            legacyTaskId,
          ],
        );
        const response = {
          id: activityId,
          pathId: input.dto.pathId,
          pathNodeId: input.dto.pathNodeId || null,
          competencyId: input.dto.competencyId || null,
          type: input.dto.type,
          title: input.dto.title,
          status: 'planned',
          plannedDate: input.dto.plannedDate || null,
          estimatedMinutes: input.dto.estimatedMinutes || null,
          priority: input.dto.priority || 5,
        };
        await emit('learning_activity', activityId, 'learning.activity.created.v1', response);
        await audit('learning_activity.create', 'learning_activity', activityId, response);
        return response;
      },
    );
  }

  async updateActivityStatus(input: {
    tenantId: number;
    userId: number;
    clientApp: string;
    requestId: string;
    idempotencyKey: string;
    ipAddress?: string;
    activityId: string;
    dto: UpdateLearningActivityStatusDto;
  }) {
    return this.commands.execute(
      input,
      '/api/v1/learning-activities/:id/status',
      { activityId: input.activityId, ...input.dto },
      200,
      async ({ runner, emit, audit }) => {
        const rows = await runner.query(
          `SELECT id, public_id AS publicId, activity_status AS currentStatus,
                  legacy_task_id AS legacyTaskId, actual_minutes AS actualMinutes
             FROM learning_activities
            WHERE public_id = ? AND tenant_id = ? AND user_id = ? AND deleted_at IS NULL
            FOR UPDATE`,
          [input.activityId, input.tenantId, input.userId],
        );
        if (!rows.length) throw new NotFoundException('学习活动不存在');
        const activity = rows[0];
        this.assertActivityTransition(activity.currentStatus, input.dto.status);

        const actualMinutes = input.dto.actualMinutes ?? activity.actualMinutes ?? null;
        await runner.query(
          `UPDATE learning_activities
              SET activity_status = ?, actual_minutes = ?,
                  started_at = CASE WHEN ? = 'in_progress' THEN COALESCE(started_at, NOW(3)) ELSE started_at END,
                  completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, NOW(3))
                                      WHEN ? IN ('planned', 'ready', 'in_progress') THEN NULL
                                      ELSE completed_at END,
                  updated_at = NOW(3)
            WHERE id = ?`,
          [input.dto.status, actualMinutes, input.dto.status, input.dto.status, input.dto.status, activity.id],
        );

        if (activity.legacyTaskId) {
          const legacyStatus: Record<string, string> = {
            planned: 'pending',
            ready: 'pending',
            in_progress: 'in_progress',
            completed: 'done',
            skipped: 'skipped',
            cancelled: 'skipped',
          };
          const nowMs = Date.now();
          await runner.query(
            `UPDATE learning_tasks_v3
                SET task_status = ?, actual_min = ?,
                    start_time = CASE WHEN ? = 'in_progress' THEN COALESCE(start_time, ?) ELSE start_time END,
                    complete_time = CASE WHEN ? = 'completed' THEN COALESCE(complete_time, ?)
                                         WHEN ? IN ('planned', 'ready', 'in_progress') THEN NULL
                                         ELSE complete_time END,
                    is_active = ?, status = ?, update_time = ?
              WHERE id = ? AND user_id = ?`,
            [
              legacyStatus[input.dto.status],
              actualMinutes,
              input.dto.status,
              nowMs,
              input.dto.status,
              nowMs,
              input.dto.status,
              input.dto.status === 'cancelled' ? 0 : 1,
              input.dto.status === 'cancelled' ? 0 : 1,
              nowMs,
              activity.legacyTaskId,
              input.userId,
            ],
          );
        }

        const response = {
          id: activity.publicId,
          previousStatus: activity.currentStatus,
          status: input.dto.status,
          actualMinutes,
        };
        await emit('learning_activity', input.activityId, 'learning.activity.status_changed.v1', response);
        await audit('learning_activity.status.update', 'learning_activity', input.activityId, response);
        return response;
      },
    );
  }

  async listAttempts(tenantId: number, userId: number, query: PageQueryDto) {
    const offset = (query.page - 1) * query.pageSize;
    const items = await this.dataSource.query(
      `SELECT a.public_id AS id, a.source_legacy_id AS legacyExamId,
              a.definition_id AS definitionInternalId,
              definition.public_id AS definitionId,
              definition.settings_json AS definitionSettings,
              a.assessment_kind AS kind, a.attempt_status AS status,
              c.name AS competency, a.started_at AS startedAt, a.completed_at AS completedAt,
              score.normalized_score AS score, score.passed
         FROM assessment_attempts a
         LEFT JOIN assessment_definitions definition ON definition.id = a.definition_id
         LEFT JOIN competencies c ON c.id = a.competency_id
         LEFT JOIN assessment_scores score ON score.attempt_id = a.id
        WHERE a.tenant_id = ? AND a.user_id = ?
        ORDER BY COALESCE(a.completed_at, a.started_at) DESC, a.id DESC LIMIT ? OFFSET ?`,
      [tenantId, userId, query.pageSize, offset],
    );
    return {
      items: items.map((item: any) => ({
        ...item,
        definitionSettings: this.parseJson(item.definitionSettings),
      })),
      pageInfo: { page: query.page, pageSize: query.pageSize, hasNextPage: items.length === query.pageSize },
    };
  }

  /**
   * 兼容旧考试记录的规范化启动入口。
   * 旧页面仍可能携带 exam_records_v3.id，但真正创建的作答尝试始终落在
   * assessment_attempts，并通过 source_legacy_id 保留历史可追溯关系。
   */
  async startLegacyExam(input: {
    tenantId: number;
    userId: number;
    clientApp: string;
    requestId: string;
    idempotencyKey: string;
    ipAddress?: string;
    legacyExamId: number;
    count?: number;
  }) {
    const rows = await this.dataSource.query(
      `SELECT exam_type AS examType
         FROM exam_records_v3
        WHERE id = ? AND user_id = ?
        LIMIT 1`,
      [input.legacyExamId, input.userId],
    );
    if (!rows.length) throw new NotFoundException('历史考试记录不存在');
    const definitions = await this.dataSource.query(
      `SELECT public_id AS id, settings_json AS settings
         FROM assessment_definitions
        WHERE tenant_id = ? AND assessment_kind = 'exam' AND status = 'published'
        ORDER BY id DESC`,
      [input.tenantId],
    );
    const definition = definitions.find((item: any) => {
      const settings = this.parseJson(item.settings) || {};
      return Number(settings.legacyExamType || 1) === Number(rows[0].examType);
    }) || definitions[0];
    if (!definition) throw new ConflictException('当前租户没有可用的考试定义');
    return this.startAssessment({
      tenantId: input.tenantId,
      userId: input.userId,
      clientApp: input.clientApp,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      ipAddress: input.ipAddress,
      definitionId: definition.id,
      dto: {
        count: input.count,
        metadata: { legacyExamId: input.legacyExamId },
      },
    });
  }

  async listAssessments(tenantId: number, query: PageQueryDto) {
    const offset = (query.page - 1) * query.pageSize;
    const [items, countRows] = await Promise.all([
      this.dataSource.query(
        `SELECT definition.public_id AS id, definition.definition_key AS definitionKey,
                definition.title, definition.assessment_kind AS kind,
                definition.version_no AS version, definition.settings_json AS settings,
                COUNT(item.id) AS itemCount
           FROM assessment_definitions definition
           LEFT JOIN assessment_items item ON item.definition_id = definition.id
          WHERE definition.tenant_id = ? AND definition.status = 'published'
          GROUP BY definition.id
          ORDER BY definition.id DESC LIMIT ? OFFSET ?`,
        [tenantId, query.pageSize, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) AS total FROM assessment_definitions
          WHERE tenant_id = ? AND status = 'published'`,
        [tenantId],
      ),
    ]);
    const total = Number(countRows[0]?.total || 0);
    return {
      items: items.map((item: any) => ({ ...item, itemCount: Number(item.itemCount), settings: this.parseJson(item.settings) })),
      pageInfo: { page: query.page, pageSize: query.pageSize, total, hasNextPage: offset + items.length < total },
    };
  }

  async listEvidence(tenantId: number, userId: number, query: PageQueryDto) {
    const offset = (query.page - 1) * query.pageSize;
    const [items, countRows] = await Promise.all([
      this.dataSource.query(
      `SELECT e.public_id AS id, e.evidence_type AS type, e.summary, e.confidence,
              e.visibility, e.source_type AS sourceType, e.source_id AS sourceId,
              e.occurred_at AS occurredAt, c.public_id AS competencyId, c.name AS competency
         FROM evidence_items e
         LEFT JOIN evidence_links link ON link.evidence_item_id = e.id
         LEFT JOIN competencies c ON c.id = link.competency_id
        WHERE e.tenant_id = ? AND e.owner_user_id = ?
        ORDER BY e.occurred_at DESC, e.id DESC LIMIT ? OFFSET ?`,
      [tenantId, userId, query.pageSize, offset],
      ),
      this.dataSource.query(
        'SELECT COUNT(*) AS total FROM evidence_items WHERE tenant_id = ? AND owner_user_id = ?',
        [tenantId, userId],
      ),
    ]);
    const total = Number(countRows[0]?.total || 0);
    return { items, pageInfo: { page: query.page, pageSize: query.pageSize, total, hasNextPage: offset + items.length < total } };
  }

  async searchEvidence(tenantId: number, userId: number, queryText: string, limit = 20) {
    const q = String(queryText || '').trim();
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const pattern = `%${q}%`;
    const items = await this.dataSource.query(
      `SELECT e.public_id AS id, e.evidence_type AS type, e.summary, e.confidence,
              e.visibility, e.source_type AS sourceType, e.source_id AS sourceId,
              e.occurred_at AS occurredAt, c.public_id AS competencyId, c.name AS competency
         FROM evidence_items e
         LEFT JOIN evidence_links link ON link.evidence_item_id = e.id
         LEFT JOIN competencies c ON c.id = link.competency_id
        WHERE e.tenant_id = ? AND e.owner_user_id = ?
          AND (? = '' OR e.summary LIKE ? OR e.evidence_type LIKE ? OR c.name LIKE ?)
        ORDER BY e.occurred_at DESC, e.id DESC LIMIT ?`,
      [tenantId, userId, q, pattern, pattern, pattern, take],
    );
    return { query: q, total: items.length, items };
  }

  async startAssessment(input: {
    tenantId: number;
    userId: number;
    clientApp: string;
    requestId: string;
    idempotencyKey: string;
    ipAddress?: string;
    definitionId: string;
    dto: StartAssessmentAttemptDto;
  }) {
    return this.commands.execute(
      input,
      '/api/v1/assessments/:definitionId/attempts',
      { definitionId: input.definitionId, ...input.dto },
      201,
      async ({ runner, emit, audit }) => {
        const definitions = await runner.query(
          `SELECT id, public_id AS publicId, title, assessment_kind AS kind, settings_json AS settings
             FROM assessment_definitions
            WHERE public_id = ? AND tenant_id = ? AND status = 'published'`,
          [input.definitionId, input.tenantId],
        );
        if (!definitions.length) throw new NotFoundException('测评定义不存在或未发布');
        const definition = definitions[0];
        const items = await runner.query(
          `SELECT public_id AS id, item_type AS type, prompt_text AS prompt,
                  content_json AS content, difficulty, position_no AS position,
                  legacy_question_id AS legacyQuestionId
             FROM assessment_items
            WHERE definition_id = ? AND tenant_id = ?
            ORDER BY position_no, id`,
          [definition.id, input.tenantId],
        );
        if (!items.length) throw new ConflictException('测评定义没有可用题目');
        const frozenItems = input.dto.count ? items.slice(0, Math.min(input.dto.count, items.length)) : items;

        const settings = this.parseJson(definition.settings) || {};
        const nowMs = Date.now();
        const legacyInsert = await runner.query(
          `INSERT INTO exam_records_v3
            (user_id, exam_type, question_ids, status, create_time, update_time)
           VALUES (?, ?, ?, 1, ?, ?)`,
          [
            input.userId,
            Number(settings.legacyExamType || 1),
            JSON.stringify(frozenItems.map((item: any) => item.legacyQuestionId).filter(Boolean)),
            nowMs,
            nowMs,
          ],
        );
        const attemptId = randomUUID();
        await runner.query(
          `INSERT INTO assessment_attempts
            (public_id, tenant_id, user_id, definition_id, assessment_kind, attempt_status,
             source_type, source_legacy_id, started_at, metadata_json)
           VALUES (?, ?, ?, ?, ?, 'started', 'exam_record', ?, NOW(3), ?)`,
          [
            attemptId,
            input.tenantId,
            input.userId,
            definition.id,
            definition.kind,
            legacyInsert.insertId,
            JSON.stringify({
              ...(input.dto.metadata || {}),
              itemIds: frozenItems.map((item: any) => item.id),
            }),
          ],
        );
        const response = {
          id: attemptId,
          definition: {
            id: definition.publicId,
            title: definition.title,
            kind: definition.kind,
            settings,
          },
          status: 'started',
          items: frozenItems.map(({ legacyQuestionId: _legacyQuestionId, ...item }: any) => ({
            ...item,
            content: this.parseJson(item.content),
          })),
        };
        await emit('assessment_attempt', attemptId, 'assessment.attempt.started.v1', {
          id: attemptId,
          definitionId: definition.publicId,
          itemCount: frozenItems.length,
        });
        await audit('assessment_attempt.start', 'assessment_attempt', attemptId, {
          definitionId: definition.publicId,
          itemCount: frozenItems.length,
        });
        return response;
      },
    );
  }

  async submitAssessment(input: {
    tenantId: number;
    userId: number;
    clientApp: string;
    requestId: string;
    idempotencyKey: string;
    ipAddress?: string;
    attemptId: string;
    dto: SubmitAssessmentAttemptDto;
  }) {
    return this.commands.execute(
      input,
      '/api/v1/assessments/attempts/:id/submit',
      { attemptId: input.attemptId, responses: input.dto.responses },
      200,
      async ({ runner, emit, audit }) => {
        const attempts = await runner.query(
          `SELECT attempt.id, attempt.public_id AS publicId, attempt.definition_id AS definitionId,
                  attempt.attempt_status AS status, attempt.assessment_kind AS kind,
                  attempt.source_legacy_id AS legacyId, attempt.metadata_json AS metadata,
                  definition.settings_json AS settings
             FROM assessment_attempts attempt
             LEFT JOIN assessment_definitions definition ON definition.id = attempt.definition_id
            WHERE attempt.public_id = ? AND attempt.tenant_id = ? AND attempt.user_id = ?
            FOR UPDATE`,
          [input.attemptId, input.tenantId, input.userId],
        );
        if (!attempts.length) throw new NotFoundException('测评尝试不存在');
        const attempt = attempts[0];
        if (attempt.status !== 'started') throw new ConflictException('测评尝试已提交或当前状态不可提交');

        const responseByItem = new Map<string, unknown>();
        for (const response of input.dto.responses) {
          if (responseByItem.has(response.itemId)) throw new ConflictException('同一道题不能重复提交');
          responseByItem.set(response.itemId, response.response);
        }
        const itemIds = [...responseByItem.keys()];
        const metadata = this.parseJson(attempt.metadata) || {};
        const frozenItemIds: string[] = Array.isArray(metadata.itemIds) ? metadata.itemIds : [];
        if (
          frozenItemIds.length &&
          (frozenItemIds.length !== itemIds.length || frozenItemIds.some((id) => !responseByItem.has(id)))
        ) {
          throw new ConflictException('必须提交本次测评冻结的全部题目，不能缺题或增加题目');
        }
        const placeholders = itemIds.map(() => '?').join(',');
        const items = await runner.query(
          `SELECT id, public_id AS publicId, competency_id AS competencyId, answer_json AS answer
             FROM assessment_items
            WHERE definition_id = ? AND tenant_id = ? AND public_id IN (${placeholders})`,
          [attempt.definitionId, input.tenantId, ...itemIds],
        );
        if (items.length !== itemIds.length) throw new ConflictException('提交内容包含不属于当前测评的题目');

        let correctCount = 0;
        let autoGradableCount = 0;
        const gradedResponses: Array<Record<string, unknown>> = [];
        const competencyScores = new Map<number, { correct: number; total: number }>();
        for (const item of items) {
          const provided = responseByItem.get(item.publicId);
          const expected = this.extractExpectedAnswer(this.parseJson(item.answer));
          const actual = this.extractProvidedAnswer(provided);
          const autoGradable = expected !== undefined && expected !== null;
          const isCorrect = autoGradable ? this.answersEqual(expected, actual) : null;
          if (autoGradable) autoGradableCount += 1;
          if (isCorrect === true) correctCount += 1;
          await runner.query(
            `INSERT INTO assessment_responses
              (tenant_id, attempt_id, item_id, response_json, is_correct, score)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              input.tenantId,
              attempt.id,
              item.id,
              JSON.stringify({ value: provided }),
              isCorrect === null ? null : isCorrect ? 1 : 0,
              isCorrect === null ? null : isCorrect ? 1 : 0,
            ],
          );
          gradedResponses.push({ itemId: item.publicId, correct: isCorrect });
          if (item.competencyId) {
            const current = competencyScores.get(Number(item.competencyId)) || { correct: 0, total: 0 };
            current.total += 1;
            if (isCorrect === true) current.correct += 1;
            competencyScores.set(Number(item.competencyId), current);
          }
        }

        const fullyAutoGraded = autoGradableCount === items.length;
        const normalizedScore = autoGradableCount
          ? Number(((correctCount / autoGradableCount) * 100).toFixed(2))
          : 0;
        const settings = this.parseJson(attempt.settings) || {};
        const passScore = Number(settings.passScore || 60);
        const passed = fullyAutoGraded ? normalizedScore >= passScore : null;
        const attemptStatus = fullyAutoGraded ? 'graded' : 'submitted';
        const distinctCompetencies = [...competencyScores.keys()];
        const scoreCompetencyId = distinctCompetencies.length === 1 ? distinctCompetencies[0] : null;
        await runner.query(
          `INSERT INTO assessment_scores
            (tenant_id, attempt_id, competency_id, score, max_score, normalized_score, passed, confidence, feedback_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0.900, ?)`,
          [
            input.tenantId,
            attempt.id,
            scoreCompetencyId,
            correctCount,
            autoGradableCount,
            normalizedScore,
            passed === null ? null : passed ? 1 : 0,
            JSON.stringify({ passScore, fullyAutoGraded, responses: gradedResponses }),
          ],
        );
        await runner.query(
          `UPDATE assessment_attempts
              SET attempt_status = ?, completed_at = NOW(3)
            WHERE id = ?`,
          [attemptStatus, attempt.id],
        );
        for (const [competencyId, value] of competencyScores) {
          const mastery = Number(((value.correct / value.total) * 100).toFixed(2));
          await runner.query(
            `INSERT INTO user_competency_states
              (tenant_id, user_id, competency_id, mastery_percent, confidence, evidence_version, calculated_at)
             VALUES (?, ?, ?, ?, 0.700, 1, NOW(3))
             ON DUPLICATE KEY UPDATE
               mastery_percent = ROUND(mastery_percent * 0.700 + VALUES(mastery_percent) * 0.300, 2),
               confidence = LEAST(1.000, confidence + 0.050),
               evidence_version = evidence_version + 1,
               calculated_at = NOW(3)`,
            [input.tenantId, input.userId, competencyId, mastery],
          );
        }

        const evidenceId = randomUUID();
        const evidenceInsert = await runner.query(
          `INSERT INTO evidence_items
            (public_id, tenant_id, owner_user_id, evidence_type, summary, content_json,
             content_hash, confidence, visibility, source_type, source_id, occurred_at)
           VALUES (?, ?, ?, 'exam_answer', ?, ?, ?, 0.900, 'private',
                   'assessment_attempt', ?, NOW(3))`,
          [
            evidenceId,
            input.tenantId,
            input.userId,
            fullyAutoGraded
              ? `测评得分 ${normalizedScore}，${passed ? '通过' : '未通过'}`
              : '测评已提交，包含待人工评分题目',
            JSON.stringify({ score: normalizedScore, passed, fullyAutoGraded, responses: gradedResponses }),
            this.contentHash({ attemptId: input.attemptId, responses: input.dto.responses }),
            input.attemptId,
          ],
        );
        await runner.query(
          `INSERT INTO evidence_links
            (tenant_id, evidence_item_id, link_type, competency_id, assessment_attempt_id)
           VALUES (?, ?, 'assessment', ?, ?)`,
          [input.tenantId, evidenceInsert.insertId, scoreCompetencyId, attempt.id],
        );

        if (attempt.legacyId) {
          await runner.query(
            `UPDATE exam_records_v3
                SET score = ?, passed = ?, answers = ?, wrong_analysis = ?, update_time = ?
              WHERE id = ? AND user_id = ?`,
            [
              fullyAutoGraded ? normalizedScore : null,
              passed === null ? null : passed ? 1 : 0,
              JSON.stringify(input.dto.responses),
              JSON.stringify(gradedResponses.filter((response) => !response.correct)),
              Date.now(),
              attempt.legacyId,
              input.userId,
            ],
          );
        }

        const response = {
          id: input.attemptId,
          status: attemptStatus,
          score: normalizedScore,
          passed,
          correctCount,
          totalCount: items.length,
          autoGradableCount,
          evidenceId,
          responses: gradedResponses,
        };
        await emit(
          'assessment_attempt',
          input.attemptId,
          fullyAutoGraded ? 'assessment.attempt.graded.v1' : 'assessment.attempt.submitted.v1',
          response,
        );
        await emit('evidence_item', evidenceId, 'evidence.created.v1', {
          id: evidenceId,
          sourceType: 'assessment_attempt',
          sourceId: input.attemptId,
        });
        await audit('assessment_attempt.submit', 'assessment_attempt', input.attemptId, {
          score: normalizedScore,
          passed,
          evidenceId,
        });
        return response;
      },
    );
  }

  async createGoalAndPath(input: {
    tenantId: number;
    userId: number;
    clientApp: string;
    requestId: string;
    idempotencyKey: string;
    ipAddress?: string;
    dto: CreateLearningGoalDto;
  }) {
    return this.commands.execute(
      input,
      '/api/v1/learning-goals',
      input.dto,
      201,
      async ({ runner, emit, audit }) => {
      const nowMs = Date.now();
      const pathName = input.dto.pathName || input.dto.title;
      const starter = input.dto.starterPathId && this.domainRegistry
        ? this.domainRegistry.resolvePath(input.dto.domainKey, input.dto.goalType as any, input.dto.starterPathId).starterPath
        : null;
      const snapshot = {
        phases: (starter?.phases || []).map((phase: any, index: number) => ({
          name: phase.name,
          index,
          skills: (phase.abilities || []).map((ability: any) => ({
            id: ability.id,
            name: ability.name,
            estimatedMin: ability.estimatedMin,
            priority: ability.priority,
            status: 'pending',
          })),
        })),
      };
      const legacyInsert = await runner.query(
        `INSERT INTO learning_plans_v3
          (user_id, plan_name, plan_type, plan_status, schedule_enabled, path_data,
           current_phase, daily_hours, status, create_time, update_time, domain_id, goal_type, goal_title)
         VALUES (?, ?, ?, 'active', 1, ?, 0, ?, 1, ?, ?, ?, ?, ?)`,
        [
          input.userId,
          pathName,
          input.dto.pathKind || 'main',
          JSON.stringify(snapshot),
          (input.dto.dailyMinutes || 60) / 60,
          nowMs,
          nowMs,
          input.dto.domainKey,
          input.dto.goalType,
          input.dto.title,
        ],
      );
      const legacyPlanId = Number(legacyInsert.insertId);
      const goalId = randomUUID();
      const pathId = randomUUID();
      const goalInsert = await runner.query(
        `INSERT INTO learning_goals
          (public_id, tenant_id, user_id, goal_type, title, domain_key, status, legacy_plan_id)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
        [goalId, input.tenantId, input.userId, input.dto.goalType, input.dto.title, input.dto.domainKey, legacyPlanId],
      );
      await runner.query(
        `INSERT INTO learning_paths
          (public_id, tenant_id, user_id, goal_id, name, path_kind, lifecycle_status,
           daily_minutes, snapshot_json, legacy_plan_id)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        [
          pathId,
          input.tenantId,
          input.userId,
          goalInsert.insertId,
          pathName,
          input.dto.pathKind || 'main',
          input.dto.dailyMinutes || 60,
          JSON.stringify(snapshot),
          legacyPlanId,
        ],
      );
      if (starter) {
        let position = 0;
        let previousNodeId: number | null = null;
        for (const phase of starter.phases) {
          for (const ability of phase.abilities) {
            const competencyRows = await runner.query(
              'SELECT id, public_id AS publicId FROM competencies WHERE tenant_id = ? AND competency_key = ? LIMIT 1',
              [input.tenantId, ability.id],
            );
            let competencyId: number;
            let competencyPublicId: string;
            if (competencyRows.length) {
              competencyId = Number(competencyRows[0].id);
              competencyPublicId = competencyRows[0].publicId;
            } else {
              competencyPublicId = randomUUID();
              const inserted = await runner.query(
                `INSERT INTO competencies (public_id, tenant_id, competency_key, name, domain_key, description)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [competencyPublicId, input.tenantId, ability.id, ability.name, input.dto.domainKey, null],
              );
              competencyId = Number(inserted.insertId);
            }
            const nodePublicId = randomUUID();
            const nodeInsert = await runner.query(
              `INSERT INTO learning_path_nodes
                (public_id, tenant_id, path_id, parent_node_id, competency_id, node_key,
                 node_type, title, position_no, lifecycle_status, metadata_json)
               VALUES (?, ?, (SELECT id FROM learning_paths WHERE public_id = ?), ?, ?, ?, 'competency', ?, ?, 'planned', ?)`,
              [
                nodePublicId,
                input.tenantId,
                pathId,
                previousNodeId,
                competencyId,
                ability.id,
                ability.name,
                position++,
                JSON.stringify({ estimatedMin: ability.estimatedMin, priority: ability.priority, phase: phase.name }),
              ],
            );
            const nodeId = Number(nodeInsert.insertId);
            let legacyTaskId: number | null = null;
            if (legacyPlanId) {
              const taskInsert = await runner.query(
                `INSERT INTO learning_tasks_v3
                  (user_id, plan_id, skill_name, task_type, task_status, estimated_min,
                   priority, plan_date, status, is_active, create_time, update_time)
                 VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, 1, 1, ?, ?)`,
                [
                  input.userId,
                  legacyPlanId,
                  ability.name,
                  input.dto.pathKind === 'side' ? 'side' : 'main',
                  ability.estimatedMin || null,
                  ability.priority || 5,
                  new Date().toISOString().slice(0, 10),
                  nowMs,
                  nowMs,
                ],
              );
              legacyTaskId = Number(taskInsert.insertId);
            }
            await runner.query(
              `INSERT INTO learning_activities
                (public_id, tenant_id, user_id, path_id, path_node_id, competency_id,
                 activity_type, title, activity_status, planned_date, estimated_minutes,
                 priority, legacy_task_id)
               VALUES (?, ?, ?, (SELECT id FROM learning_paths WHERE public_id = ?), ?, ?, 'learning', ?, 'planned', ?, ?, ?, ?)`,
              [
                randomUUID(),
                input.tenantId,
                input.userId,
                pathId,
                nodeId,
                competencyId,
                ability.name,
                new Date().toISOString().slice(0, 10),
                ability.estimatedMin || null,
                ability.priority || 5,
                legacyTaskId,
              ],
            );
            if (previousNodeId) {
              await runner.query(
                `INSERT INTO learning_path_edges (tenant_id, path_id, from_node_id, to_node_id, edge_type)
                 VALUES (?, (SELECT id FROM learning_paths WHERE public_id = ?), ?, ?, 'next')`,
                [input.tenantId, pathId, previousNodeId, nodeId],
              );
            }
            previousNodeId = nodeId;
          }
        }
        if (position > 0) {
          await runner.query('UPDATE learning_paths SET version_no = version_no + 1 WHERE public_id = ?', [pathId]);
        }
      }
      const response = {
        goal: { id: goalId, type: input.dto.goalType, title: input.dto.title, domainKey: input.dto.domainKey },
        path: { id: pathId, name: pathName, kind: input.dto.pathKind || 'main', status: 'active' },
      };
      await emit('learning_goal', goalId, 'learning.goal.created.v1', response);
      await audit('learning_goal.create', 'learning_goal', goalId, { pathId });
      return response;
      },
    );
  }

  async createEvidence(input: {
    tenantId: number;
    userId: number;
    clientApp: string;
    requestId: string;
    idempotencyKey: string;
    ipAddress?: string;
    dto: CreateEvidenceDto;
  }) {
    return this.commands.execute(
      input,
      '/api/v1/evidence',
      input.dto,
      201,
      async ({ runner, emit, audit }) => {
        const resolve = async (
          table: string,
          publicId: string | undefined,
          ownerColumn?: string,
        ): Promise<any | null> => {
          if (!publicId) return null;
          const allowedTables = new Set([
            'competencies',
            'learning_goals',
            'learning_activities',
            'assessment_attempts',
          ]);
          if (!allowedTables.has(table)) throw new Error('Unsupported evidence link table');
          const ownerClause = ownerColumn ? ` AND ${ownerColumn} = ?` : '';
          const rows = await runner.query(
            `SELECT * FROM ${table} WHERE public_id = ? AND tenant_id = ?${ownerClause}`,
            ownerColumn ? [publicId, input.tenantId, input.userId] : [publicId, input.tenantId],
          );
          if (!rows.length) throw new NotFoundException(`证据关联对象不存在：${publicId}`);
          return rows[0];
        };

        const competency = await resolve('competencies', input.dto.competencyId);
        const goal = await resolve('learning_goals', input.dto.learningGoalId, 'user_id');
        const activity = await resolve('learning_activities', input.dto.learningActivityId, 'user_id');
        const attempt = await resolve('assessment_attempts', input.dto.assessmentAttemptId, 'user_id');

        let legacyEvidenceId: number | null = null;
        if (attempt?.source_legacy_id) {
          const legacyInsert = await runner.query(
            `INSERT INTO evaluation_evidence_v3
              (user_id, attempt_id, evidence_type, source_type, source_id, skill_name,
               summary, payload_json, status, create_time, update_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [
              input.userId,
              attempt.source_legacy_id,
              input.dto.evidenceType,
              input.dto.sourceType || 'assessment_attempt',
              input.dto.sourceId || input.dto.assessmentAttemptId,
              competency?.name || null,
              input.dto.summary,
              JSON.stringify(input.dto.content || {}),
              Date.now(),
              Date.now(),
            ],
          );
          legacyEvidenceId = Number(legacyInsert.insertId);
        }

        const evidenceId = randomUUID();
        const evidenceInsert = await runner.query(
          `INSERT INTO evidence_items
            (public_id, tenant_id, owner_user_id, evidence_type, summary, content_json,
             content_hash, confidence, visibility, source_type, source_id,
             source_legacy_evidence_id, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            evidenceId,
            input.tenantId,
            input.userId,
            input.dto.evidenceType,
            input.dto.summary,
            JSON.stringify(input.dto.content || {}),
            this.contentHash(input.dto.content || {}),
            input.dto.confidence ?? 0.7,
            input.dto.visibility || 'private',
            input.dto.sourceType || null,
            input.dto.sourceId || null,
            legacyEvidenceId,
            input.dto.occurredAt ? new Date(input.dto.occurredAt) : new Date(),
          ],
        );
        if (competency || goal || activity || attempt) {
          const linkType = attempt
            ? 'assessment'
            : activity
              ? 'activity'
              : goal
                ? 'goal'
                : 'competency';
          await runner.query(
            `INSERT INTO evidence_links
              (tenant_id, evidence_item_id, link_type, competency_id, learning_goal_id,
               learning_activity_id, assessment_attempt_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              input.tenantId,
              evidenceInsert.insertId,
              linkType,
              competency?.id || null,
              goal?.id || null,
              activity?.id || null,
              attempt?.id || null,
            ],
          );
        }
        const response = {
          id: evidenceId,
          type: input.dto.evidenceType,
          summary: input.dto.summary,
          confidence: input.dto.confidence ?? 0.7,
          visibility: input.dto.visibility || 'private',
          links: {
            competencyId: input.dto.competencyId || null,
            learningGoalId: input.dto.learningGoalId || null,
            learningActivityId: input.dto.learningActivityId || null,
            assessmentAttemptId: input.dto.assessmentAttemptId || null,
          },
        };
        await emit('evidence_item', evidenceId, 'evidence.created.v1', response);
        await audit('evidence.create', 'evidence_item', evidenceId, response);
        return response;
      },
    );
  }

  private assertActivityTransition(current: string, next: string) {
    if (current === next) return;
    const transitions: Record<string, string[]> = {
      planned: ['ready', 'in_progress', 'completed', 'skipped', 'cancelled'],
      ready: ['planned', 'in_progress', 'completed', 'skipped', 'cancelled'],
      in_progress: ['ready', 'completed', 'skipped', 'cancelled'],
      completed: [],
      skipped: ['ready', 'in_progress'],
      cancelled: ['planned'],
    };
    if (!transitions[current]?.includes(next)) {
      throw new ConflictException(`学习活动状态不能从 ${current} 变更为 ${next}`);
    }
  }

  private parseJson(value: any): any {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private extractExpectedAnswer(answer: any): unknown {
    if (answer && typeof answer === 'object') {
      return answer.correct ?? answer.answer ?? answer.value;
    }
    return answer;
  }

  private extractProvidedAnswer(response: unknown): unknown {
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const value = response as Record<string, unknown>;
      return value.answer ?? value.value ?? value.selected ?? response;
    }
    return response;
  }

  private answersEqual(expected: unknown, actual: unknown): boolean {
    if (Array.isArray(expected) && Array.isArray(actual)) {
      return JSON.stringify([...expected].sort()) === JSON.stringify([...actual].sort());
    }
    return String(expected).trim().toLowerCase() === String(actual).trim().toLowerCase();
  }

  private contentHash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
