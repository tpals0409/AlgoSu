/**
 * @file github-issue.module.ts — GithubIssueService 등록 및 export
 * @domain identity
 * @layer module
 * @related github-issue.service.ts, feedback.module.ts
 */
import { Module } from '@nestjs/common';
import { GithubIssueService } from './github-issue.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Module({
  providers: [GithubIssueService, StructuredLoggerService],
  exports: [GithubIssueService],
})
export class GithubIssueModule {}
