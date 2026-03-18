/**
 * @file CLOSED 스터디 쓰기 차단 가드
 * @domain study
 * @layer guard
 * @guard closed-study
 * @related StudyStatus, StudyController
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { IdentityClientService } from '../../identity-client/identity-client.service';

/**
 * CUD 엔드포인트에 적용: study.status === 'CLOSED' -> ForbiddenException
 * GET 요청은 이 가드를 적용하지 않음 (읽기 전용 허용)
 * @guard closed-study
 */
@Injectable()
export class StudyActiveGuard implements CanActivate {
  constructor(
    private readonly identityClient: IdentityClientService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(StudyActiveGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // studyId는 URL param ':id' 에서 추출
    const studyId = request.params['id'];
    if (!studyId) {
      return true;
    }

    let study: Record<string, unknown> | null = null;
    try {
      study = await this.identityClient.findStudyById(studyId);
    } catch {
      study = null;
    }
    if (!study) {
      return true; // 존재하지 않으면 서비스 레이어에서 404 처리
    }

    if (study['status'] === 'CLOSED') {
      this.logger.warn(`CLOSED 스터디 쓰기 시도 차단: studyId=${studyId}`);
      throw new ForbiddenException('종료된 스터디입니다.');
    }

    return true;
  }
}
