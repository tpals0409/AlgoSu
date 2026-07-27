/**
 * @file 피드백 생성 DTO — class-validator 검증
 * @domain identity
 * @layer dto
 * @related feedback.service.ts
 */
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { FeedbackCategory } from '../feedback.entity';

export class CreateFeedbackDto {
  @IsUUID('4', { message: '유효한 UUID여야 합니다.' })
  userId!: string;

  @IsEnum(FeedbackCategory, { message: '유효한 피드백 카테고리여야 합니다.' })
  category!: FeedbackCategory;

  @IsString()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsUUID('4', { message: '유효한 UUID여야 합니다.' })
  studyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  browserInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(700000)
  screenshot?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4, { message: '스크린샷은 최대 4장까지 첨부할 수 있습니다.' })
  @IsString({ each: true })
  @MaxLength(700000, { each: true })
  screenshots?: string[];
}
