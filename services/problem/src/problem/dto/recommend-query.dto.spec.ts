import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecommendQueryDto } from './recommend-query.dto';

/**
 * RecommendQueryDto 검증 — limit/exclude transform·경계 케이스
 */
describe('RecommendQueryDto', () => {
  const build = (obj: Record<string, unknown>) =>
    plainToInstance(RecommendQueryDto, obj);

  describe('limit', () => {
    it('미지정: 유효 (기본값은 컨트롤러에서 처리)', async () => {
      const dto = build({});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBeUndefined();
    });

    it('문자열 "5" → 숫자 5로 변환 + 유효', async () => {
      const dto = build({ limit: '5' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(5);
    });

    it('경계 하한 1: 유효', async () => {
      const dto = build({ limit: '1' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('경계 상한 20: 유효', async () => {
      const dto = build({ limit: '20' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('0: Min 위반', async () => {
      const dto = build({ limit: '0' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('21: Max 위반', async () => {
      const dto = build({ limit: '21' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('소수 2.5: IsInt 위반', async () => {
      const dto = build({ limit: '2.5' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isInt');
    });
  });

  describe('exclude', () => {
    it('미지정: 유효', async () => {
      const dto = build({});
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.exclude).toBeUndefined();
    });

    it('단일 문자열 → 배열로 정규화', async () => {
      const dto = build({ exclude: 'https://a.com/1' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.exclude).toEqual(['https://a.com/1']);
    });

    it('배열 그대로 유지', async () => {
      const dto = build({ exclude: ['https://a.com/1', 'https://b.com/2'] });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.exclude).toEqual(['https://a.com/1', 'https://b.com/2']);
    });

    it('101개 초과: ArrayMaxSize 위반', async () => {
      const many = Array.from({ length: 101 }, (_, i) => `https://a.com/${i}`);
      const dto = build({ exclude: many });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('arrayMaxSize');
    });

    it('100개 경계: 유효', async () => {
      const many = Array.from({ length: 100 }, (_, i) => `https://a.com/${i}`);
      const dto = build({ exclude: many });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('숫자 원소 포함: IsString(each) 위반', async () => {
      const dto = build({ exclude: [123] });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('platform', () => {
    it('미지정: 유효', async () => {
      const dto = build({});
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.platform).toBeUndefined();
    });

    it('PROGRAMMERS: 유효', async () => {
      const dto = build({ platform: 'PROGRAMMERS' });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.platform).toBe('PROGRAMMERS');
    });

    it('BOJ: 유효', async () => {
      const dto = build({ platform: 'BOJ' });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.platform).toBe('BOJ');
    });

    it('허용되지 않은 값: IsIn 위반', async () => {
      const dto = build({ platform: 'LEETCODE' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isIn');
    });
  });
});
