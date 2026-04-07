/**
 * @file 마감 기한 자동 종료 스케줄러 — 매 5분 만료된 ACTIVE 문제를 CLOSED로 전환
 * @domain problem
 * @layer service
 * @related problem.service.ts, deadline-cache.service.ts
 */
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProblemService } from './problem.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class DeadlineSchedulerService {
  constructor(
    private readonly problemService: ProblemService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(DeadlineSchedulerService.name);
  }

  /**
   * 매 5분마다 만료된 ACTIVE 문제를 CLOSED로 자동 전환
   * - 변경 건수 > 0: info 로그
   * - 변경 건수 0: debug 로그 (프로덕션에서 노이즈 방지)
   */
  @Cron('0 */5 * * * *')
  async handleExpiredProblems(): Promise<void> {
    try {
      const result = await this.problemService.closeExpiredProblems();

      if (result.count > 0) {
        this.logger.log(
          `만료 문제 자동 종료: ${result.count}건 CLOSED 전환`,
          { count: result.count, affected: result.affected },
        );
      } else {
        this.logger.debug('만료 문제 없음 — 스킵');
      }
    } catch (error: unknown) {
      this.logger.error(
        '만료 문제 자동 종료 실패',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
