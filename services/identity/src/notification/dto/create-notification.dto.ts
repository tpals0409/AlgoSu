/**
 * @file 알림 생성 DTO — class-validator 검증
 * @domain identity
 * @layer dto
 * @related notification.service.ts
 */
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NotificationType } from '../notification.entity';

export class CreateNotificationDto {
  @IsUUID('4', { message: '유효한 UUID여야 합니다.' })
  userId!: string;

  @IsOptional()
  @IsUUID('4', { message: '유효한 UUID여야 합니다.' })
  studyId?: string;

  @IsEnum(NotificationType, { message: '유효한 알림 타입이어야 합니다.' })
  type!: NotificationType;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link?: string;
}
