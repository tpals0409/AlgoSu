/**
 * @file 단건 읽음 처리 DTO — IDOR 방지용 userId 포함
 * @domain identity
 * @layer dto
 * @related notification.controller.ts
 */
import { IsUUID } from 'class-validator';

export class MarkAsReadDto {
  @IsUUID('4', { message: '유효한 UUID여야 합니다.' })
  userId!: string;
}
