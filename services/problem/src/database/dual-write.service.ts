/**
 * @file Dual Write 서비스 — DB 이중 쓰기 + 마이그레이션 지원
 * @domain problem
 * @layer repository
 * @related problem.service.ts, dual-write.config.ts, reconciliation.service.ts
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOneOptions, FindManyOptions, DeepPartial } from 'typeorm';
import { Problem } from '../problem/problem.entity';
import { DualWriteMode, getDualWriteMode, NEW_DB_CONNECTION } from './dual-write.config';
import { ReconciliationService } from './reconciliation.service';
import { Counter, Histogram, Gauge, register } from 'prom-client';

// ---- Dual Write 메트릭 (H8) ----
const dualWriteTotal = new Counter({
  name: 'algosu_problem_dual_write_total',
  help: 'Dual write 총 시도 횟수',
  labelNames: ['operation', 'result'] as const,
  registers: [register],
});

const dualWriteLatency = new Histogram({
  name: 'algosu_problem_dual_write_latency_seconds',
  help: 'Dual write 신 DB 쓰기 레이턴시 (초)',
  labelNames: ['operation'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const reconciliationMismatches = new Gauge({
  name: 'algosu_problem_reconciliation_mismatches',
  help: '현재 Reconciliation 불일치 건수',
  registers: [register],
});

export const reconciliationRunsTotal = new Counter({
  name: 'algosu_problem_reconciliation_runs_total',
  help: 'Reconciliation 실행 총 횟수',
  labelNames: ['result'] as const,
  registers: [register],
});

/**
 * Dual Write Service — Phase 3 DB 물리 분리
 *
 * 구 DB(default)와 신 DB(new-problem-db) 양쪽에 쓰기를 수행하고,
 * 모드에 따라 읽기 소스를 전환한다.
 *
 * 보안: 신 DB 쓰기 실패는 로그만 기록, 구 DB 트랜잭션에 영향 없음
 */
@Injectable()
export class DualWriteService implements OnModuleInit {
  private readonly logger = new Logger(DualWriteService.name);
  private mode: DualWriteMode = DualWriteMode.OFF;

  constructor(
    @InjectRepository(Problem)
    private readonly oldRepo: Repository<Problem>,
    @InjectRepository(Problem, NEW_DB_CONNECTION)
    private readonly newRepo: Repository<Problem>,
    private readonly reconciliation: ReconciliationService,
  ) {}

  onModuleInit() {
    this.mode = getDualWriteMode();
    this.logger.log(`Dual Write 모드: ${this.mode}`);
  }

  get isActive(): boolean {
    return this.mode !== DualWriteMode.OFF;
  }

  /** 읽기 대상 Repository — H7: 불일치 시 구 DB fallback */
  private get readRepo(): Repository<Problem> {
    if (this.mode === DualWriteMode.SWITCH_READ) {
      if (this.reconciliation.hasMismatch) {
        this.logger.warn('전환 차단: Reconciliation 불일치 감지 — 구 DB로 fallback');
        return this.oldRepo;
      }
      return this.newRepo;
    }
    return this.oldRepo;
  }

  /** 조회 — 모드에 따라 소스 전환 */
  async findOne(options: FindOneOptions<Problem>): Promise<Problem | null> {
    return this.readRepo.findOne(options);
  }

  /** 목록 조회 — 모드에 따라 소스 전환 */
  async find(options: FindManyOptions<Problem>): Promise<Problem[]> {
    return this.readRepo.find(options);
  }

  /** 생성 — 양쪽 쓰기 */
  async save(entity: DeepPartial<Problem>): Promise<Problem> {
    const created = this.oldRepo.create(entity);
    const saved = await this.oldRepo.save(created);

    if (this.isActive) {
      this.writeToNewDb('save', saved);
    }

    return saved;
  }

  /** 엔티티 생성 (메모리에만, DB 저장 X) */
  create(entity: DeepPartial<Problem>): Problem {
    return this.oldRepo.create(entity);
  }

  /** 업데이트 — 양쪽 쓰기 */
  async saveExisting(entity: Problem): Promise<Problem> {
    const saved = await this.oldRepo.save(entity);

    if (this.isActive) {
      this.writeToNewDb('update', saved);
    }

    return saved;
  }

  /** 신 DB에 fire-and-forget 쓰기 — H8: 메트릭 계측 */
  private writeToNewDb(operation: string, entity: Problem): void {
    const end = dualWriteLatency.startTimer({ operation });
    this.newRepo.save(entity).then(
      () => {
        end();
        dualWriteTotal.inc({ operation, result: 'success' });
        this.logger.debug(`Dual Write ${operation} 성공: id=${entity.id}`);
      },
      (error) => {
        end();
        dualWriteTotal.inc({ operation, result: 'failure' });
        const rawMsg = error instanceof Error ? error.message : 'unknown';
        const safeError = rawMsg.replace(/(host|password|port|user)=\S+/gi, '$1=***').slice(0, 100);
        this.logger.error(`Dual Write ${operation} 실패: id=${entity.id}, error=${safeError}`);
      },
    );
  }
}
