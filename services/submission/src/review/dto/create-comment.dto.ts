/**
 * @file 코드리뷰 댓글 생성 DTO
 * @domain review
 * @layer dto
 */
import { IsUUID, IsInt, IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  submissionId!: string;

  @IsInt()
  @IsOptional()
  lineNumber?: number | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
