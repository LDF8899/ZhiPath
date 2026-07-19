import { BranchService } from './branch.service';

describe('BranchService', () => {
  it('rolls branch head back to the target commit snapshot', async () => {
    const branch = { id: 7, userId: 1, branchName: 'main', branchType: 'main', headCommitId: 20, status: 1 };
    const commit = { id: 10, userId: 1, branchId: 7, snapshotId: 55 };
    const snapshot = {
      id: 55,
      commitId: 10,
      skillsJson: [{ name: 'Git', mastery: 40, trustWeight: 1, source: 'exam' }],
      radarJson: [{ name: '工程化', score: 40 }],
      abilityMetricsJson: { overallScore: 40 },
    };
    const branchRepo = {
      findOne: jest.fn().mockResolvedValue(branch),
      find: jest.fn(),
      save: jest.fn(async (value) => value),
    };
    const commitRepo = { find: jest.fn(), findOne: jest.fn() };
    const planRepo = { findOne: jest.fn() };
    const snapshotService = {
      getSnapshotByCommit: jest.fn().mockResolvedValue(snapshot),
      calculateDelta: jest.fn(),
    };
    const skillService = { addSkill: jest.fn() };
    const learningCommitService = { getCommit: jest.fn().mockResolvedValue(commit), ensureMainBranch: jest.fn() };
    const eventsService = { emit: jest.fn() };
    const service = new BranchService(
      branchRepo as any,
      commitRepo as any,
      planRepo as any,
      snapshotService as any,
      skillService as any,
      learningCommitService as any,
      eventsService as any,
    );

    const result = await service.rollback(1, 10);

    expect(skillService.addSkill).not.toHaveBeenCalled();
    expect(branchRepo.save).toHaveBeenCalledWith(expect.objectContaining({ headCommitId: 10 }));
    expect(result).toEqual({ branch: expect.objectContaining({ headCommitId: 10 }), commit, snapshot, nonDestructive: true });
    expect(eventsService.emit).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'branch_updated' }));
    expect(eventsService.emit).not.toHaveBeenCalledWith(1, expect.objectContaining({ type: 'radar_updated' }));
  });
});
