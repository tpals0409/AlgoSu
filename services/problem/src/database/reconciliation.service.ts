import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Problem } from '../problem/problem.entity';
import { DualWriteMode, getDualWriteMode, NEW_DB_CONNECTION } from './dual-write.config';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { reconciliationMismatches, reconciliationRunsTotal } from './dual-write.service';

/**
 * Reconciliation Service — Phase 3 DB 분리
 *
 * 매시간 구 DB vs 신 DB의 최근 변경분을 checksum 비교.
 * 불일치 발견 시 로그 기록 + 전환 차단.
 *
 * 보안: checksum 비교만 수행, 실제 데이터 로그 금지
 */
@Injectable()
export class ReconciliationService implements OnModuleInit {
  private mode: DualWriteMode = DualWriteMode.OFF;
  private mismatchCount = 0;

  constructor(
    @InjectRepository(Problem)
    private readonly oldRepo: Repository<Problem>,
    @InjectRepository(Problem, NEW_DB_CONNECTION)
    private readonly newRepo: Repository<Problem>,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(ReconciliationService.name);
  }

  onModuleInit() {
    this.mode = getDualWriteMode();
    if (this.mode !== DualWriteMode.OFF) {
      this.logger.log(`Reconciliation 활성화: 모드=${this.mode}`);
    }
  }

  get currentMismatchCount(): number {
    return this.mismatchCount;
  }

  get hasMismatch(): boolean {
    return this.mismatchCount > 0;
  }

  /** 매시간 실행 — 최근 2시간 변경분 검증 */
  @Cron('0 * * * *')
  async reconcile(): Promise<void> {
    if (this.mode === DualWriteMode.OFF) {
      return;
    }

    try {
      // 구 DB에서 최근 2시간 변경분의 id + checksum 조회
      const oldChecksums = await this.getChecksums(this.oldRepo);
      const newChecksums = await this.getChecksums(this.newRepo);

      // 비교
      const oldMap = new Map(oldChecksums.map((r) => [r.id, r.checksum]));
      const newMap = new Map(newChecksums.map((r) => [r.id, r.checksum]));

      const mismatches: string[] = [];

      // 구 DB에 있고 신 DB에 없거나 checksum 불일치
      for (const [id, checksum] of oldMap) {
        const newChecksum = newMap.get(id);
        if (newChecksum === undefined) {
          mismatches.push(`missing_in_new:${id}`);
        } else if (newChecksum !== checksum) {
          mismatches.push(`checksum_mismatch:${id}`);
        }
      }

      // 신 DB에 있고 구 DB에 없음
      for (const id of newMap.keys()) {
        if (!oldMap.has(id)) {
          mismatches.push(`missing_in_old:${id}`);
        }
      }

      this.mismatchCount = mismatches.length;
      reconciliationMismatches.set(mismatches.length);

      if (mismatches.length > 0) {
        reconciliationRunsTotal.inc({ result: 'success' });
        this.logger.error(
          `Reconciliation 불일치 발견: ${mismatches.length}건 — ${mismatches.slice(0, 5).join(', ')}`,
        );
      } else {
        reconciliationRunsTotal.inc({ result: 'success' });
        this.logger.log(
          `Reconciliation 통과: old=${oldChecksums.length}, new=${newChecksums.length} 레코드 일치`,
        );
      }
    } catch (error) {
      reconciliationRunsTotal.inc({ result: 'error' });
      const safeError = error instanceof Error ? error.message.slice(0, 100) : 'unknown';
      this.logger.error(`Reconciliation 오류: ${safeError}`);
    }
  }

  /** 최근 2시간 변경분의 id + checksum 조회 (민감 데이터 제외) */
  private async getChecksums(
    repo: Repository<Problem>,
  ): Promise<Array<{ id: string; checksum: string }>> {
    return repo
      .createQueryBuilder('p')
      .select('p.id', 'id')
      .addSelect('md5(row_to_json(p)::text)', 'checksum')
      .where('p.updated_at > NOW() - INTERVAL :interval', {
        interval: '2 hours',
      })
      .orderBy('p.id', 'ASC')
      .getRawMany();
  }
}
