import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOneOptions, FindManyOptions, DeepPartial } from 'typeorm';
import { Problem } from '../problem/problem.entity';
import { DualWriteMode, getDualWriteMode, NEW_DB_CONNECTION } from './dual-write.config';

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
  ) {}

  onModuleInit() {
    this.mode = getDualWriteMode();
    this.logger.log(`Dual Write 모드: ${this.mode}`);
  }

  get isActive(): boolean {
    return this.mode !== DualWriteMode.OFF;
  }

  /** 읽기 대상 Repository */
  private get readRepo(): Repository<Problem> {
    return this.mode === DualWriteMode.SWITCH_READ ? this.newRepo : this.oldRepo;
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
      await this.writeToNewDb('save', saved);
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
      await this.writeToNewDb('update', saved);
    }

    return saved;
  }

  /** 신 DB에 비동기 쓰기 (실패해도 구 DB 영향 없음) */
  private async writeToNewDb(operation: string, entity: Problem): Promise<void> {
    try {
      await this.newRepo.save(entity);
      this.logger.debug(`Dual Write ${operation} 성공: id=${entity.id}`);
    } catch (error) {
      const safeError = error instanceof Error ? error.message.slice(0, 100) : 'unknown';
      this.logger.error(`Dual Write ${operation} 실패: id=${entity.id}, error=${safeError}`);
    }
  }
}
