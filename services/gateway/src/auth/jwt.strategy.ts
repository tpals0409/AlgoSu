/**
 * @file Passport JWT 전략 — HS256 고정, exp 필수 검증
 * @domain identity
 * @layer guard
 * @related oauth.service.ts, jwt.middleware.ts
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  exp: number;
  iat: number;
}

interface ValidatedUser {
  userId: string;
}

/**
 * Passport JWT 전략
 * - 알고리즘: HS256 고정 ('none' 절대 불허)
 * - exp 검증: ignoreExpiration: false (명시적 설정)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload): ValidatedUser {
    if (!payload.sub) {
      throw new UnauthorizedException('유효하지 않은 토큰 페이로드입니다.');
    }
    if (!payload.exp) {
      throw new UnauthorizedException('토큰에 만료 시간(exp)이 없습니다.');
    }
    return {
      userId: payload.sub,
    };
  }
}
