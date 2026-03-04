import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const JWT_SECRET = 'test-jwt-secret-key';
  let strategy: JwtStrategy;

  beforeEach(() => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(JWT_SECRET),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(configService);
  });

  describe('constructor', () => {
    it('ConfigService에서 JWT_SECRET을 가져와 초기화', () => {
      expect(strategy).toBeDefined();
    });

    it('JWT_SECRET이 없으면 예외 발생', () => {
      const configService = {
        getOrThrow: jest.fn().mockImplementation(() => {
          throw new Error('missing');
        }),
      } as unknown as ConfigService;

      expect(() => new JwtStrategy(configService)).toThrow();
    });
  });

  describe('validate', () => {
    it('유효한 페이로드 — userId 반환', () => {
      const result = strategy.validate({
        sub: 'user-uuid-1234',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      expect(result).toEqual({ userId: 'user-uuid-1234' });
    });

    it('sub가 없는 페이로드 → UnauthorizedException', () => {
      expect(() =>
        strategy.validate({
          sub: '',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toThrow(UnauthorizedException);
      expect(() =>
        strategy.validate({
          sub: '',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toThrow('유효하지 않은 토큰 페이로드입니다.');
    });

    it('exp가 없는 페이로드 → UnauthorizedException', () => {
      expect(() =>
        strategy.validate({
          sub: 'user-uuid-1234',
          exp: 0,
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toThrow(UnauthorizedException);
      expect(() =>
        strategy.validate({
          sub: 'user-uuid-1234',
          exp: 0,
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toThrow('토큰에 만료 시간(exp)이 없습니다.');
    });

    it('sub와 exp 모두 없으면 sub 검증이 먼저 실패', () => {
      expect(() =>
        strategy.validate({
          sub: '',
          exp: 0,
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toThrow('유효하지 않은 토큰 페이로드입니다.');
    });
  });
});
