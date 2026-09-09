import { ClientOriginPolicyService } from './client-origin-policy.service';

describe('ClientOriginPolicyService', () => {
  it('loads active client origins and rejects unknown or unsafe origins', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([
        { allowedOrigins: ['https://campus.example.com', 'http://localhost:5173'] },
      ]),
    };
    const service = new ClientOriginPolicyService(repository as any);

    await expect(service.isAllowed('https://campus.example.com')).resolves.toBe(true);
    await expect(service.isAllowed('https://unknown.example.com')).resolves.toBe(false);
    await expect(service.isAllowed('javascript:alert(1)')).resolves.toBe(false);
    expect(repository.find).toHaveBeenCalledWith({ where: { status: 'active' } });
  });
});
