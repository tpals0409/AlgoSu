/**
 * @file 코드리뷰 댓글 생성 DTO
 * @domain review
 * @layer dto
 */
import { IsUUID, IsInt, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  submissionId!: string;

  @IsInt()
  @IsOptional()
  lineNumber?: number | null;

  @IsString()
  @MaxLength(5000)
  content!: string;
}
