/**
 * @file 프로필 이미지 업로드 컨트롤러
 * @domain identity
 * @layer controller
 * @related AvatarService, User.avatar_url
 */

import {
  Controller,
  Post,
  Delete,
  UploadedFile,
  UseInterceptors,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AvatarService } from './avatar.service';
import { MAX_FILE_SIZE } from './avatar.constants';

// ─── CONTROLLER ───────────────────────────

@ApiTags('Avatar')
@Controller('avatar')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  /**
   * 프로필 이미지 업로드
   * @api POST /avatar/upload
   * @guard jwt-auth
   * @domain identity
   * @param file - multipart/form-data 'file' 필드
   * @returns avatarUrl (MinIO public URL)
   */
  @ApiOperation({ summary: '프로필 이미지 업로드' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: '업로드 완료, avatarUrl 반환' })
  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      storage: undefined, // memoryStorage (buffer 사용)
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<{ avatarUrl: string }> {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      throw new BadRequestException('사용자 인증 정보가 없습니다.');
    }

    const { avatarUrl } = await this.avatarService.uploadAvatar(userId, file);
    return { avatarUrl };
  }

  /**
   * 프로필 이미지 삭제 (기본 아바타로 복원)
   * @api DELETE /avatar
   * @guard jwt-auth
   * @domain identity
   */
  @ApiOperation({ summary: '프로필 이미지 삭제' })
  @ApiResponse({ status: 204, description: '삭제 완료' })
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAvatar(@Req() req: Request): Promise<void> {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      throw new BadRequestException('사용자 인증 정보가 없습니다.');
    }

    // 삭제 시 userId 폴더 전체를 정리하는 것이 아닌
    // Identity Service에서 avatar_url을 null로 업데이트하는 것으로 처리
    // (기존 이미지는 avatars 버킷에 잔류 — 스토리지 정리는 별도 배치)
  }
}
