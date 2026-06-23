import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentProfile } from '../entities/agent-profile.entity';

/** 默认 Agent 配置 */
const DEFAULT_PROFILES: Array<{
  agentType: AgentProfile['agentType'];
  animalType: string;
  color: string;
  nickname: string;
  displayRole: string;
}> = [
  { agentType: 'lecture', animalType: 'cat', color: '#f9d27c', nickname: '小喵', displayRole: '讲义专家' },
  { agentType: 'reading', animalType: 'dog', color: '#c9daf5', nickname: '旺财', displayRole: '阅读向导' },
  { agentType: 'code', animalType: 'fox', color: '#e5d5f5', nickname: '小狐', displayRole: '代码大师' },
  { agentType: 'path', animalType: 'panda', color: '#c9f5c0', nickname: '团子', displayRole: '路径规划' },
  { agentType: 'assess', animalType: 'owl', color: '#ffd5c9', nickname: '咕咕', displayRole: '评估官' },
];

/**
 * AgentProfile 服务 — 管理用户 Agent 员工配置
 */
@Injectable()
export class AgentProfileService {
  constructor(
    @InjectRepository(AgentProfile) private profileRepo: Repository<AgentProfile>,
  ) {}

  /**
   * 招聘新员工（创建新的 Agent 配置）
   */
  async hireAgent(
    userId: number,
    agentType: string,
    animalType: string,
    color: string,
    nickname: string,
    displayRole: string,
  ): Promise<AgentProfile> {
    const now = Date.now();

    // 找一个空工位
    const existingStations = await this.profileRepo.find({
      where: { userId, status: 1 },
    });
    const usedStations = new Set(existingStations.map(p => p.stationId).filter(Boolean));
    let nextStation: number | null = null;
    for (let i = 1; i <= 20; i++) {
      if (!usedStations.has(i)) { nextStation = i; break; }
    }

    return this.profileRepo.save({
      userId,
      agentType,
      animalType,
      color,
      nickname,
      displayRole,
      stationId: nextStation,
      agentStatus: 'idle',
      status: 1,
      createTime: now,
      updateTime: now,
    });
  }

  /**
   * 获取单个员工
   */
  async getProfile(userId: number, profileId: number): Promise<AgentProfile | null> {
    return this.profileRepo.findOne({ where: { id: profileId, userId, status: 1 } });
  }

  /**
   * 软删除员工
   */
  async softDelete(userId: number, profileId: number): Promise<void> {
    await this.profileRepo.update({ id: profileId, userId }, { status: 0, updateTime: Date.now() });
  }

  /**
   * 获取用户所有 Agent 配置（无则自动创建默认）
   */
  async getProfiles(userId: number): Promise<AgentProfile[]> {
    let profiles = await this.profileRepo.find({
      where: { userId, status: 1 },
      order: { agentType: 'ASC' },
    });

    // 首次访问：自动创建默认配置
    if (profiles.length === 0) {
      profiles = await this.createDefaults(userId);
    }

    return profiles;
  }

  /**
   * 更新单个 Agent 配置
   */
  async updateProfile(
    userId: number,
    agentType: AgentProfile['agentType'],
    updates: Partial<Pick<AgentProfile, 'animalType' | 'color' | 'nickname' | 'displayRole'>>,
  ): Promise<AgentProfile | null> {
    const profile = await this.profileRepo.findOne({
      where: { userId, agentType, status: 1 },
    });
    if (!profile) return null;

    const now = Date.now();
    await this.profileRepo.update(profile.id, {
      ...updates,
      updateTime: now,
    });
    return this.profileRepo.findOne({ where: { id: profile.id } });
  }

  /**
   * 分配/移除工位
   */
  async assignStation(
    userId: number,
    agentType: AgentProfile['agentType'],
    stationId: number | null,
  ): Promise<AgentProfile | null> {
    const profile = await this.profileRepo.findOne({
      where: { userId, agentType, status: 1 },
    });
    if (!profile) return null;

    // 如果目标工位已被其他 agent 占用，先释放
    if (stationId !== null) {
      const existing = await this.profileRepo.findOne({
        where: { userId, stationId, status: 1 },
      });
      if (existing && existing.agentType !== agentType) {
        await this.profileRepo.update(existing.id, { stationId: null, updateTime: Date.now() });
      }
    }

    await this.profileRepo.update(profile.id, { stationId, updateTime: Date.now() });
    return this.profileRepo.findOne({ where: { id: profile.id } });
  }

  /**
   * 更新 Agent 状态（由任务系统调用）
   */
  async updateStatus(
    userId: number,
    agentType: AgentProfile['agentType'],
    agentStatus: 'idle' | 'busy',
  ): Promise<void> {
    const updateData: any = { agentStatus, updateTime: Date.now() };

    // busy 时自动分配工位（如果还在待命区）
    if (agentStatus === 'busy') {
      const profile = await this.profileRepo.findOne({ where: { userId, agentType, status: 1 } });
      console.log(`[AgentProfile] busy check: found=${!!profile}, stationId=${profile?.stationId}`);
      if (profile && profile.stationId === null) {
        const allProfiles = await this.profileRepo.find({ where: { userId, status: 1 } });
        const usedStations = allProfiles.filter(p => p.stationId !== null).map(p => p.stationId);
        const maxStation = Math.max(0, ...usedStations as number[]);
        updateData.stationId = maxStation + 1;
        console.log(`[AgentProfile] assigning station ${updateData.stationId}`);
      }
    }

    const result = await this.profileRepo.update(
      { userId, agentType, status: 1 },
      updateData,
    );
    console.log(`[AgentProfile] updateStatus affected=${result.affected}, data=`, JSON.stringify(updateData));
  }

  /**
   * 创建默认配置
   */
  private async createDefaults(userId: number): Promise<AgentProfile[]> {
    const now = Date.now();
    const entities = DEFAULT_PROFILES.map((def, idx) =>
      this.profileRepo.create({
        userId,
        agentType: def.agentType,
        animalType: def.animalType,
        color: def.color,
        nickname: def.nickname,
        displayRole: def.displayRole,
        stationId: idx < 3 ? idx + 1 : null, // 前3个默认上工位
        agentStatus: 'idle',
        status: 1,
        createTime: now,
        updateTime: now,
      }),
    );
    return this.profileRepo.save(entities);
  }
}
