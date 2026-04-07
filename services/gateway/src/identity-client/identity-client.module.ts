/**
 * @file IdentityClientModule — Identity 서비스 HTTP 클라이언트 모듈
 * @domain identity-client
 * @layer module
 * @related identity-client.service.ts
 */
import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IdentityClientService } from './identity-client.service';

@Global()
@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.get<string>(
          'IDENTITY_SERVICE_URL',
          'http://identity-service:3004',
        ),
        timeout: configService.get<number>(
          'IDENTITY_SERVICE_TIMEOUT',
          5000,
        ),
      }),
    }),
  ],
  providers: [IdentityClientService],
  exports: [IdentityClientService],
})
export class IdentityClientModule {}
