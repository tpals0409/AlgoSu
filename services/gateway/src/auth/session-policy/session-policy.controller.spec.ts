import { Test, TestingModule } from '@nestjs/testing';
import { SessionPolicyController } from './session-policy.controller';
import { SessionPolicyService, ClientSessionPolicyDto } from './session-policy.service';

describe('SessionPolicyController', () => {
  let controller: SessionPolicyController;
  let service: { getClientPolicy: jest.Mock };

  const dto: ClientSessionPolicyDto = {
    accessTokenTtlMs: 7_200_000,
    heartbeatIntervalMs: 600_000,
    sessionTimeoutMs: 7_500_000,
    refreshThresholdMs: 3_600_000,
  };

  beforeEach(async () => {
    service = { getClientPolicy: jest.fn().mockReturnValue(dto) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionPolicyController],
      providers: [{ provide: SessionPolicyService, useValue: service }],
    }).compile();

    controller = module.get<SessionPolicyController>(SessionPolicyController);
  });

  it('GET /auth/session-policy → SessionPolicyService.getClientPolicy() 반환', () => {
    const result = controller.getPolicy();
    expect(result).toBe(dto);
    expect(service.getClientPolicy).toHaveBeenCalledTimes(1);
  });
});
