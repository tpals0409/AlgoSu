/**
 * @file User 모듈 — 사용자 CRUD + GitHub 연동 + 프로필 설정
 * @domain identity
 * @layer module
 * @related user.service.ts, user.controller.ts
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService, InternalKeyGuard, StructuredLoggerService],
  exports: [UserService],
})
export class UserModule {}
