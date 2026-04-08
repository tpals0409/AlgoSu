/**
 * @file 피드백 상태 변경 DTO — class-validator 검증
 * @domain identity
 * @layer dto
 * @related feedback.service.ts
 */
import { IsEnum } from 'class-validator';
import { FeedbackStatus } from '../feedback.entity';

export class UpdateFeedbackStatusDto {
  @IsEnum(FeedbackStatus, { message: '유효한 피드백 상태여야 합니다.' })
  status!: FeedbackStatus;
}
