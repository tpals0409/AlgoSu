import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalController } from './internal.controller';
import { OAuthModule } from '../auth/oauth/oauth.module';
import { StudyMember } from '../study/study.entity';

@Module({
  imports: [OAuthModule, TypeOrmModule.forFeature([StudyMember])],
  controllers: [InternalController],
})
export class InternalModule {}
