/**
 * @file 코드리뷰 답글 수정 DTO
 * @domain review
 * @layer dto
 */
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
