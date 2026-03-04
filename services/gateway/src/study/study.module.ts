/**
 * @file 스터디 모듈
 * @domain study
 * @layer config
 * @related StudyController, StudyService, InviteThrottleService, StudyActiveGuard
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';
import { InviteThrottleService } from './invite-throttle.service';
import { Study, StudyMember, StudyInvite } from './study.entity';
import { User } from '../auth/oauth/user.entity';
import { NotificationModule } from '../notification/notification.module';
import { StudyActiveGuard } from '../common/guards/study-active.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Study, StudyMember, StudyInvite, User]),
    NotificationModule,
  ],
  controllers: [StudyController],
  providers: [StudyService, InviteThrottleService, StudyActiveGuard, StudyMemberGuard],
  exports: [StudyService],
})
export class StudyModule {}
