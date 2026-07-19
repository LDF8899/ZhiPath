import { LearningCommitService } from './learning-commit.service';

describe('LearningCommitService', () => {
  function setup() {
    let commitId = 100;
    const branch = { id: 7, userId: 1, branchName: 'main', branchType: 'main', headCommitId: 99, baseCommitId: 99, status: 1 };
    const branchRepo = {
      findOne: jest.fn().mockResolvedValue(branch),
      save: jest.fn(async (value) => ({ ...branch, ...value })),
    };
    const commitRepo = {
      save: jest.fn(async (value) => ({ ...value, id: value.id || commitId++ })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    const skillService = {
      getSkill: jest.fn().mockResolvedValue(null),
      addSkill: jest.fn().mockResolvedValue({ id: 1 }),
      setMastery: jest.fn(),
      updateMastery: jest.fn().mockResolvedValue({ id: 1 }),
      getEffectiveSkills: jest.fn().mockResolvedValue([{ name: 'Git', masteryPct: 30, trustWeight: 1, effectiveScore: 30, source: 'exam' }]),
    };
    const snapshotService = {
      getSnapshotByCommit: jest.fn().mockResolvedValue(null),
      getLatestSnapshot: jest.fn(),
      saveSnapshot: jest.fn(async (input) => ({
        id: 200,
        commitId: input.commitId,
        totalMastery: 30,
        depthScore: 30,
        breadthScore: 17,
        radarJson: [{ name: '工程化', score: 30 }],
        abilityMetricsJson: { overallScore: 30 },
        matchSummaryJson: input.matchSummary,
        skillsJson: input.skills,
      })),
      calculateDelta: jest.fn().mockReturnValue({
        skillChanges: [{ name: 'Git', before: 0, after: 30, delta: 30 }],
        metricsChange: { overallScore: 30, matchScore: 12, depthScore: 30, breadthScore: 17 },
        radarChanges: [{ dimension: '工程化', before: 0, after: 30, delta: 30 }],
      }),
      normalizeSkills: jest.fn((skills) => skills || []),
    };
    const matchAgentService = {
      calculateForAllJobs: jest.fn().mockResolvedValue([{ jobId: 1, jobTitle: 'FE', matchScore: 12, canApply: false }]),
    };
    const eventsService = { emit: jest.fn() };
    const service = new LearningCommitService(
      branchRepo as any,
      commitRepo as any,
      skillService as any,
      snapshotService as any,
      matchAgentService as any,
      eventsService as any,
    );
    return { service, branchRepo, commitRepo, skillService, snapshotService, matchAgentService, eventsService, branch };
  }

  it('creates commit, snapshot, delta and moves branch head', async () => {
    const { service, branchRepo, commitRepo, skillService, snapshotService, matchAgentService, eventsService } = setup();

    const result = await service.commitSkill(1, 7, {
      type: 'lecture_read',
      skillName: 'Git',
      delta: 30,
      message: 'lecture read: Git',
    });

    expect(skillService.addSkill).toHaveBeenCalledWith(1, 'Git', 'exam', 0.7, 0);
    expect(skillService.updateMastery).toHaveBeenCalledWith(1, 'Git', 30);
    expect(matchAgentService.calculateForAllJobs).toHaveBeenCalledWith(1, 'learning_commit');
    expect(snapshotService.saveSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      branchId: 7,
      commitId: result.commit.id,
    }));
    expect(commitRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      snapshotId: 200,
      deltaJson: result.delta,
    }));
    expect(branchRepo.save).toHaveBeenCalledWith(expect.objectContaining({ headCommitId: result.commit.id }));
    expect(eventsService.emit).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'commit_created' }));
    expect(eventsService.emit).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'radar_updated' }));
  });

  it('keeps plan branch changes isolated from the canonical skill store', async () => {
    const { service, branchRepo, skillService, snapshotService, matchAgentService, eventsService, branch } = setup();
    branch.branchType = 'plan';
    await service.commitSkill(1, 7, {
      type: 'quiz_passed',
      skillName: 'Git',
      delta: 25,
      source: 'exam',
      trustWeight: 1,
    });

    expect(skillService.addSkill).not.toHaveBeenCalled();
    expect(skillService.updateMastery).not.toHaveBeenCalled();
    expect(matchAgentService.calculateForAllJobs).not.toHaveBeenCalled();
    expect(branchRepo.save).toHaveBeenCalled();
    expect(eventsService.emit).not.toHaveBeenCalledWith(1, expect.objectContaining({ type: 'radar_updated' }));
  });
});
