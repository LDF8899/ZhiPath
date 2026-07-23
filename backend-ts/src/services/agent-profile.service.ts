import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentProfile } from '../entities/agent-profile.entity';

const DEFAULT_PROFILES: Array<{
  agentType: AgentProfile['agentType'];
  animalType: string;
  color: string;
  nickname: string;
  displayRole: string;
}> = [
  { agentType: 'lecture', animalType: 'cat', color: '#f9d27c', nickname: 'Lecta', displayRole: 'Lecture Expert' },
  { agentType: 'reading', animalType: 'dog', color: '#c9daf5', nickname: 'Readio', displayRole: 'Reading Guide' },
  { agentType: 'code', animalType: 'fox', color: '#e5d5f5', nickname: 'Codey', displayRole: 'Code Master' },
  { agentType: 'path', animalType: 'panda', color: '#c9f5c0', nickname: 'Patha', displayRole: 'Path Planner' },
  { agentType: 'assess', animalType: 'owl', color: '#ffd5c9', nickname: 'Evalo', displayRole: 'Assessment Expert' },
];

const PROFILE_PRESETS: Record<string, {
  animalType: string;
  color: string;
  nickname: string;
  displayRole: string;
}> = {
  lecture: { animalType: 'cat', color: '#f9d27c', nickname: 'Lecta', displayRole: 'Lecture Expert' },
  reading: { animalType: 'dog', color: '#c9daf5', nickname: 'Readio', displayRole: 'Reading Guide' },
  code: { animalType: 'fox', color: '#e5d5f5', nickname: 'Codey', displayRole: 'Code Master' },
  path: { animalType: 'panda', color: '#c9f5c0', nickname: 'Patha', displayRole: 'Path Planner' },
  assess: { animalType: 'owl', color: '#ffd5c9', nickname: 'Evalo', displayRole: 'Assessment Expert' },
  exam: { animalType: 'dog', color: '#d7ccff', nickname: 'Quizzy', displayRole: 'Exam Expert' },
  skillgap: { animalType: 'duck', color: '#c8d7ff', nickname: 'Gapper', displayRole: 'Gap Analyst' },
  resume: { animalType: 'hamster', color: '#ffd1e8', nickname: 'Resuma', displayRole: 'Resume Advisor' },
  profile: { animalType: 'owl', color: '#cce6ff', nickname: 'Lens', displayRole: 'Profile Analyst' },
  news: { animalType: 'parrot', color: '#c8f5c8', nickname: 'Scout', displayRole: 'News Editor' },
};

@Injectable()
export class AgentProfileService {
  constructor(
    @InjectRepository(AgentProfile) private profileRepo: Repository<AgentProfile>,
  ) {}

  async hireAgent(
    userId: number,
    agentType: string,
    animalType: string,
    color: string,
    nickname: string,
    displayRole: string,
  ): Promise<AgentProfile> {
    const now = Date.now();

    return this.profileRepo.save({
      userId,
      agentType,
      animalType,
      color,
      nickname,
      displayRole,
      stationId: null,
      agentStatus: 'idle',
      status: 1,
      createTime: now,
      updateTime: now,
    });
  }

  async getProfile(userId: number, profileId: number): Promise<AgentProfile | null> {
    return this.profileRepo.findOne({ where: { id: profileId, userId, status: 1 } });
  }

  async softDelete(userId: number, profileId: number): Promise<void> {
    await this.profileRepo.update({ id: profileId, userId }, { status: 0, updateTime: Date.now() });
  }

  async getProfiles(userId: number): Promise<AgentProfile[]> {
    let profiles = await this.profileRepo.find({
      where: { userId, status: 1 },
      order: { agentType: 'ASC' },
    });

    if (profiles.length === 0) {
      profiles = await this.createDefaults(userId);
    }

    return profiles;
  }

  async releaseInactiveStations(userId: number, activeAgentTypes: string[]): Promise<void> {
    const qb = this.profileRepo
      .createQueryBuilder()
      .update(AgentProfile)
      .set({ stationId: null, agentStatus: 'idle', updateTime: Date.now() } as any)
      .where('user_id = :userId', { userId })
      .andWhere('status = :status', { status: 1 })
      .andWhere('station_id IS NOT NULL');

    if (activeAgentTypes.length > 0) {
      qb.andWhere('agent_type NOT IN (:...activeAgentTypes)', { activeAgentTypes });
    }

    await qb.execute();
  }

  async updateProfile(
    userId: number,
    agentType: AgentProfile['agentType'],
    updates: Partial<Pick<AgentProfile, 'animalType' | 'color' | 'nickname' | 'displayRole'>>,
  ): Promise<AgentProfile | null> {
    const profile = await this.profileRepo.findOne({
      where: { userId, agentType, status: 1 },
    });
    if (!profile) return null;

    await this.profileRepo.update(profile.id, {
      ...updates,
      updateTime: Date.now(),
    });
    return this.profileRepo.findOne({ where: { id: profile.id } });
  }

  async assignStation(
    userId: number,
    agentType: AgentProfile['agentType'],
    stationId: number | null,
  ): Promise<AgentProfile | null> {
    const profile = await this.profileRepo.findOne({
      where: { userId, agentType, status: 1 },
    });
    if (!profile) return null;

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

  async updateStatus(
    userId: number,
    agentType: AgentProfile['agentType'],
    agentStatus: 'idle' | 'busy',
    options?: { releaseStation?: boolean },
  ): Promise<void> {
    const updateData: any = { agentStatus, updateTime: Date.now() };

    if (agentStatus === 'idle' && options?.releaseStation) {
      updateData.stationId = null;
    }

    if (agentStatus === 'busy') {
      const profile = await this.profileRepo.findOne({ where: { userId, agentType, status: 1 } });
      if (profile && profile.stationId === null) {
        const allProfiles = await this.profileRepo.find({ where: { userId, status: 1 } });
        const usedStations = allProfiles.filter(p => p.stationId !== null).map(p => p.stationId);
        const maxStation = Math.max(0, ...usedStations as number[]);
        updateData.stationId = maxStation + 1;
      }
    }

    await this.profileRepo.update(
      { userId, agentType, status: 1 },
      updateData,
    );
  }

  async ensureAgent(userId: number, agentType: AgentProfile['agentType']): Promise<AgentProfile> {
    const existing = await this.profileRepo.findOne({
      where: { userId, agentType, status: 1 },
    });
    if (existing) return existing;

    const preset = PROFILE_PRESETS[agentType] || {
      animalType: 'hamster',
      color: '#ff69b4',
      nickname: 'Helper',
      displayRole: 'AI Staff',
    };

    return this.hireAgent(
      userId,
      agentType,
      preset.animalType,
      preset.color,
      preset.nickname,
      preset.displayRole,
    );
  }

  private async createDefaults(userId: number): Promise<AgentProfile[]> {
    const now = Date.now();
    const entities = DEFAULT_PROFILES.map((def) =>
      this.profileRepo.create({
        userId,
        agentType: def.agentType,
        animalType: def.animalType,
        color: def.color,
        nickname: def.nickname,
        displayRole: def.displayRole,
        stationId: null,
        agentStatus: 'idle',
        status: 1,
        createTime: now,
        updateTime: now,
      }),
    );
    return this.profileRepo.save(entities);
  }
}
