/**
 * @file ShareLink 모듈 — 공유 링크 CRUD + 공개 엔드포인트 + 프로필 설정
 * @domain share
 * @layer module
 * @related share-link.controller.ts, public-share.controller.ts, public-profile.controller.ts
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareLink } from './share-link.entity';
import { ShareLinkController } from './share-link.controller';
import { PublicShareController } from './public-share.controller';
import { PublicProfileController } from './public-profile.controller';
import { ShareLinkService } from './share-link.service';
import { User } from '../auth/oauth/user.entity';
import { Study, StudyMember } from '../study/study.entity';
import { StudyMemberGuard } from '../common/guards/study-member.guard';
import { ShareLinkGuard } from '../common/guards/share-link.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ShareLink, User, Study, StudyMember])],
  controllers: [ShareLinkController, PublicShareController, PublicProfileController],
  providers: [ShareLinkService, StudyMemberGuard, ShareLinkGuard],
  exports: [ShareLinkService],
})
export class ShareLinkModule {}
