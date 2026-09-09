import { NotFoundException } from '@nestjs/common';
import { PlatformResourcesService } from './platform-resources.service';

describe('PlatformResourcesService', () => {
  it('scopes resource listing by tenant and owner and normalizes JSON', async () => {
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'artifact-1',
            type: 'lecture',
            schemaVersion: '1',
            title: 'React 进阶',
            content: '{"markdown":"hello"}',
            provenance: '{"jobId":"job-1"}',
          },
        ])
        .mockResolvedValueOnce([{ total: '1' }]),
    } as any;
    const service = new PlatformResourcesService(dataSource);

    const result = await service.list(7, 42, 1, 20, 'lecture', 'React');

    expect(result.pageInfo).toEqual({ page: 1, pageSize: 20, total: 1, hasNextPage: false });
    expect(result.items[0]).toMatchObject({
      id: 'artifact-1',
      schemaVersion: 1,
      content: { markdown: 'hello' },
      provenance: { jobId: 'job-1' },
    });
    const listParams = dataSource.query.mock.calls[0][1];
    expect(listParams.slice(0, 4)).toEqual([7, 42, 'lecture', '%React%']);
  });

  it('does not disclose an artifact owned by another tenant or user', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) } as any;
    const service = new PlatformResourcesService(dataSource);

    await expect(service.detail(7, 42, 'artifact-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('artifact.tenant_id = ?'), [
      'artifact-1',
      7,
      42,
    ]);
  });
});

