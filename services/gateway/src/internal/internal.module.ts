import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalController } from './internal.controller';
import { OAuthModule } from '../auth/oauth/oauth.module';
import { StudyMember, Study } from '../study/study.entity';

@Module({
  imports: [OAuthModule, TypeOrmModule.forFeature([StudyMember, Study])],
  controllers: [InternalController],
})
export class InternalModule {}
