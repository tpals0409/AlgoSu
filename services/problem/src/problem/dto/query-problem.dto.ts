/**
 * @file query-problem.dto.ts — 태그 기반 문제 검색 쿼리 DTO
 * @domain problem
 * @layer dto
 * @related problem.controller.ts, problem.service.ts
 */
import {
  IsArray,
  IsString,
  IsIn,
  IsOptional,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * GET /search/tags 쿼리 파라미터 DTO
 *
 * 인코딩 계약: 반복 ?tags=a&tags=b (NestJS @Query 배열 파싱 관례)
 * 단일 ?tags=a는 @Transform으로 배열로 정규화
 * 한글/공백 태그: URL 인코딩 후 전달 — 저장값 그대로 비교 (대소문자 정규화 없음)
 */
export class FindByTagsQueryDto {
  /**
   * 검색할 태그 목록 (1~20개)
   * - 단일: ?tags=DP → ['DP']
   * - 복수: ?tags=DP&tags=그래프 → ['DP', '그래프']
   */
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : [value],
  )
  tags!: string[];

  /**
   * 태그 일치 방식 — 미지정 시 서비스 기본값 'or' 사용
   * - and: 모든 태그를 포함하는 문제만 반환
   * - or: 태그 중 하나라도 포함하는 문제 반환 (기본)
   */
  @IsOptional()
  @IsIn(['and', 'or'])
  mode?: 'and' | 'or';
}
