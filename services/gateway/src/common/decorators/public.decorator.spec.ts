/**
 * @file public.decorator.spec.ts — @Public() 데코레이터 메타데이터 부착 검증
 * @domain common
 * @layer test
 * @related public.decorator.ts, public-routes.spec.ts
 */

import { Reflector } from '@nestjs/core';
import { Controller, Get } from '@nestjs/common';
import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('@Public() 데코레이터', () => {
  const reflector = new Reflector();

  it('IS_PUBLIC_KEY 상수는 algosu 네임스페이스를 사용한다', () => {
    expect(IS_PUBLIC_KEY).toBe('algosu:isPublic');
  });

  it('컨트롤러 클래스에 부착 시 메타데이터가 true로 설정된다', () => {
    @Public()
    @Controller('class-target')
    class ClassTarget {
      @Get()
      handler(): string {
        return 'ok';
      }
    }

    const value = reflector.get<boolean>(IS_PUBLIC_KEY, ClassTarget);
    expect(value).toBe(true);
  });

  it('핸들러에 부착 시 메타데이터가 true로 설정된다', () => {
    @Controller('handler-target')
    class HandlerTarget {
      @Public()
      @Get('open')
      open(): string {
        return 'ok';
      }

      @Get('private')
      privateHandler(): string {
        return 'ok';
      }
    }

    const target = new HandlerTarget();
    const openMeta = reflector.get<boolean>(IS_PUBLIC_KEY, target.open);
    const privateMeta = reflector.get<boolean>(IS_PUBLIC_KEY, target.privateHandler);

    expect(openMeta).toBe(true);
    expect(privateMeta).toBeUndefined();
  });
});
