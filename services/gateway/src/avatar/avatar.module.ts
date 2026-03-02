/**
 * @file 프로필 이미지 업로드 모듈
 * @domain identity
 * @layer config
 * @related AvatarController, AvatarService
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';

@Module({
  imports: [ConfigModule],
  controllers: [AvatarController],
  providers: [AvatarService],
  exports: [AvatarService],
})
export class AvatarModule {}
