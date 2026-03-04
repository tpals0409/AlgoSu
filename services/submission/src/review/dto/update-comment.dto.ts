/**
 * @file 코드리뷰 댓글 수정 DTO
 * @domain review
 * @layer dto
 */
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
