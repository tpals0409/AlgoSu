import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { User } from './user.entity';
import { StructuredLoggerService } from '../../common/logger/structured-logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [OAuthController],
  providers: [OAuthService, StructuredLoggerService],
  exports: [OAuthService],
})
export class OAuthModule {}
