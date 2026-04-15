/**
 * @file create-submission.dto.ts — 코드 제출 DTO (언어 화이트리스트 + 멱등성 키)
 * @domain submission
 * @layer dto
 * @related submission.service.ts, submission.controller.ts
 */
import {
  IsString,
  IsUUID,
  IsOptional,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

/**
 * 코드 제출 DTO
 *
 * 검증 규칙 (Submission Service 2차 검증):
 * - 코드: 최소 10자 (빈 제출 방지) — Gateway 1차에서 100KB 초과 차단
 * - 언어: 화이트리스트 검증
 * - idempotencyKey: 중복 제출 멱등성 보장
 */
const ALLOWED_LANGUAGES = [
  'python', 'java', 'cpp', 'c', 'javascript', 'typescript',
  'go', 'rust', 'kotlin', 'swift', 'ruby', 'csharp',
] as const;

export class CreateSubmissionDto {
  @IsUUID()
  problemId!: string;

  @IsString()
  @IsIn(ALLOWED_LANGUAGES, { message: '허용되지 않은 언어입니다.' })
  language!: string;

  @IsString()
  @MinLength(10, { message: '코드는 최소 10자 이상이어야 합니다.' })
  @MaxLength(102400, { message: '코드는 100KB를 초과할 수 없습니다.' })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}

export class UpsertDraftDto {
  @IsUUID()
  problemId!: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_LANGUAGES)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(102400)
  code?: string;
}
