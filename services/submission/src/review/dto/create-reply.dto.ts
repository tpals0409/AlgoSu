/**
 * @file 코드리뷰 답글 생성 DTO
 * @domain review
 * @layer dto
 */
import { IsUUID, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateReplyDto {
  @IsUUID()
  commentPublicId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
