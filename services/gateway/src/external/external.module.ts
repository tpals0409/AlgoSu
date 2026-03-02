import { Module } from '@nestjs/common';
import { SolvedacController } from './solvedac.controller';
import { SolvedacService } from './solvedac.service';

@Module({
  controllers: [SolvedacController],
  providers: [SolvedacService],
})
export class ExternalModule {}
