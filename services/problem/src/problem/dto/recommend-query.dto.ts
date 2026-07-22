/**
 * @file recommend-query.dto.ts — 추천 문제 조회 쿼리 DTO
 * @domain problem
 * @layer dto
 * @related problem.controller.ts, problem.service.ts, query-problem.dto.ts
 */
import {
  IsArray,
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/** 추천 대상 플랫폼 — 문제 추가 모달의 플랫폼 토글과 1:1 대응 */
export const RECOMMEND_PLATFORMS = ['BOJ', 'PROGRAMMERS'] as const;
export type RecommendPlatform = (typeof RECOMMEND_PLATFORMS)[number];

/**
 * GET /recommendations 쿼리 파라미터 DTO
 *
 * 인코딩 계약: query-problem.dto.ts와 동일 패턴 (단일→배열 @Transform 정규화)
 * exclude: 이미 FE에 노출한 후보의 sourceUrl 목록 — 중복 추천 방지
 */
export class RecommendQueryDto {
  /**
   * 반환 추천 개수 — 기본 8, 정수, 1~20
   * ?limit=5 → 5개 반환
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  /**
   * 제외할 후보 sourceUrl 목록 (이미 노출한 후보)
   * - 단일: ?exclude=https://... → ['https://...']
   * - 복수: ?exclude=a&exclude=b → ['a', 'b']
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : [value],
  )
  exclude?: string[];

  /**
   * 추천 대상 플랫폼 — 지정 시 해당 플랫폼 문제만 추천한다.
   * 문제 추가 모달의 플랫폼 토글(PROGRAMMERS/BOJ)에 종속.
   * 미지정 시 전체 플랫폼(하위 호환).
   */
  @IsOptional()
  @IsIn(RECOMMEND_PLATFORMS)
  platform?: RecommendPlatform;
}
