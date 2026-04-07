/**
 * @file 알림 컨트롤러 — InternalKeyGuard 전용 API (Gateway ↔ Identity 내부 통신)
 * @domain identity
 * @layer controller
 * @related notification.service.ts, InternalKeyGuard
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MarkAsReadDto } from './dto/mark-as-read.dto';

@ApiTags('Notifications')
@Controller('api/notifications')
@UseGuards(InternalKeyGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 알림 생성
   * @route POST /api/notifications
   */
  @ApiOperation({ summary: '알림 생성' })
  @ApiResponse({ status: 201, description: '생성된 알림' })
  @Post()
  async create(@Body() dto: CreateNotificationDto) {
    return this.notificationService.create(dto);
  }

  /**
   * 미읽음 알림 목록 조회 (최근 50개, 최신순)
   * @route GET /api/notifications/by-user/:userId
   */
  @ApiOperation({ summary: '미읽음 알림 목록 조회' })
  @ApiResponse({ status: 200, description: '알림 목록' })
  @Get('by-user/:userId')
  async findByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.notificationService.findByUserId(userId);
  }

  /**
   * 미읽음 알림 수 조회
   * @route GET /api/notifications/by-user/:userId/unread-count
   */
  @ApiOperation({ summary: '미읽음 알림 수 조회' })
  @ApiResponse({ status: 200, description: '미읽음 수' })
  @Get('by-user/:userId/unread-count')
  async getUnreadCount(@Param('userId', ParseUUIDPipe) userId: string) {
    return { count: await this.notificationService.getUnreadCount(userId) };
  }

  /**
   * 단건 읽음 처리 — body에 userId 포함 (IDOR 방지)
   * @route PATCH /api/notifications/:id/read
   */
  @ApiOperation({ summary: '알림 단건 읽음 처리' })
  @ApiResponse({ status: 200, description: '읽음 처리 완료' })
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkAsReadDto,
  ) {
    await this.notificationService.markAsRead(id, dto.userId);
    return { success: true };
  }

  /**
   * 전체 읽음 처리
   * @route PATCH /api/notifications/by-user/:userId/read-all
   */
  @ApiOperation({ summary: '알림 전체 읽음 처리' })
  @ApiResponse({ status: 200, description: '읽음 처리된 건수' })
  @Patch('by-user/:userId/read-all')
  async markAllRead(@Param('userId', ParseUUIDPipe) userId: string) {
    const affected = await this.notificationService.markAllRead(userId);
    return { affected };
  }

  /**
   * 30일 이상 경과 알림 삭제
   * @route DELETE /api/notifications/old
   */
  @ApiOperation({ summary: '30일 이상 경과 알림 삭제' })
  @ApiResponse({ status: 200, description: '삭제된 건수' })
  @Delete('old')
  async deleteOld() {
    const affected = await this.notificationService.deleteOld();
    return { affected };
  }

  /**
   * 사용자 알림 전체 삭제 (회원탈퇴 시)
   * @route DELETE /api/notifications/by-user/:userId
   */
  @ApiOperation({ summary: '사용자 알림 전체 삭제' })
  @ApiResponse({ status: 200, description: '삭제된 건수' })
  @Delete('by-user/:userId')
  async deleteByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    const affected = await this.notificationService.deleteByUserId(userId);
    return { affected };
  }
}
