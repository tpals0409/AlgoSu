/**
 * @file 스터디 모듈
 * @domain study
 * @layer config
 * @related StudyController, StudyService, InviteThrottleService, StudyActiveGuard
 */
import { Module } from '@nestjs/common';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';
import { InviteThrottleService } from './invite-throttle.service';
import { NotificationModule } from '../notification/notification.module';
import { StudyActiveGuard } from '../common/guards/study-active.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

@Module({
  imports: [
    NotificationModule,
  ],
  controllers: [StudyController],
  providers: [StudyService, InviteThrottleService, StudyActiveGuard, StudyMemberGuard],
  exports: [StudyService],
})
export class StudyModule {}
