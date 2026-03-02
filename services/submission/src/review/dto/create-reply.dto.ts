/**
 * @file 코드리뷰 답글 생성 DTO
 * @domain review
 * @layer dto
 */
import { IsInt, IsString, MaxLength } from 'class-validator';

export class CreateReplyDto {
  @IsInt()
  commentId!: number;

  @IsString()
  @MaxLength(5000)
  content!: string;
}
