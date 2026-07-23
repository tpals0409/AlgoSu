/**
 * @file github-issue.service.ts — 피드백 → GitHub 이슈 자동 생성
 * @domain identity
 * @layer service
 * @related feedback.service.ts, feedback.entity.ts, github-issue.module.ts
 *
 * 피드백 저장 시 전체 맥락(본문·pageUrl·browserInfo·publicId·스터디)을 담아
 * 중앙 레포에 GitHub 이슈를 생성한다. 개발자는 이슈로 바로 재현·대응하며 재입력이 사라진다.
 * 스크린샷은 이슈에 인라인 렌더 불가(GitHub가 data URI 차단)라 관리자 대시보드 링크만 남긴다.
 *
 * 인증: fine-grained PAT(issues:write, 단일 레포 스코프) — GITHUB_FEEDBACK_ISSUE_TOKEN.
 * 대상: GITHUB_FEEDBACK_REPO(owner/repo). 미설정 시 조용히 건너뛴다(피드백 저장 무영향).
 * Discord 서비스와 동일한 fire-and-forget 패턴 — 실패해도 예외를 던지지 않는다.
 */
import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { Feedback, FeedbackCategory } from '../feedback/feedback.entity';

/**
 * GitHub 이슈 생성 요청 타임아웃(ms).
 * 이슈 생성은 fire-and-forget 후속 단계인 Discord 도착 알림을 지연시키므로,
 * GitHub API 행(hang) 시 유일한 도착 신호(Discord)가 무한 지연되지 않도록 상한을 둔다.
 */
const GITHUB_ISSUE_TIMEOUT_MS = 10_000;

/** 카테고리 → GitHub 이슈 라벨 매핑 */
const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  [FeedbackCategory.BUG]: 'bug',
  [FeedbackCategory.FEATURE]: 'feature',
  [FeedbackCategory.UX]: 'ux',
  [FeedbackCategory.GENERAL]: 'feedback',
};

/** 생성된 이슈 식별자 — 중복 방지 컬럼 저장용 */
export interface CreatedIssue {
  number: number;
  url: string;
}

@Injectable()
export class GithubIssueService {
  private readonly token: string | undefined;
  private readonly repo: string | undefined;
  private warnedMissingConfig = false;

  constructor(private readonly logger: StructuredLoggerService) {
    this.logger.setContext(GithubIssueService.name);
    this.token = process.env['GITHUB_FEEDBACK_ISSUE_TOKEN'];
    this.repo = process.env['GITHUB_FEEDBACK_REPO'];
  }

  /**
   * 피드백을 중앙 레포 GitHub 이슈로 생성
   * fire-and-forget: 실패 시 null 반환, 예외를 던지지 않는다.
   * @param feedback - 저장된 피드백 엔티티
   * @returns 생성된 이슈(number/url) 또는 실패 시 null
   */
  async createFeedbackIssue(feedback: Feedback): Promise<CreatedIssue | null> {
    if (!this.token || !this.repo) {
      if (!this.warnedMissingConfig) {
        this.logger.warn(
          'GITHUB_FEEDBACK_ISSUE_TOKEN/GITHUB_FEEDBACK_REPO 미설정 — GitHub 이슈 생성을 건너뜁니다.',
        );
        this.warnedMissingConfig = true;
      }
      return null;
    }

    const body = JSON.stringify({
      title: this.buildTitle(feedback),
      body: this.buildBody(feedback),
      labels: this.buildLabels(feedback),
    });

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      GITHUB_ISSUE_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.repo}/issues`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body,
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        this.logger.warn(`GitHub 이슈 생성 응답 오류: status=${response.status}`);
        return null;
      }

      const json = (await response.json()) as {
        number: number;
        html_url: string;
      };
      this.logger.log(
        `GitHub 이슈 생성: number=${json.number}, publicId=${feedback.publicId}`,
      );
      return { number: json.number, url: json.html_url };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`GitHub 이슈 생성 실패: ${message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** 이슈 제목 — `[CATEGORY] 본문요약(60자)` 단일 라인 */
  private buildTitle(feedback: Feedback): string {
    const flat = feedback.content.replace(/\s+/g, ' ').trim();
    const preview = flat.length > 60 ? `${flat.slice(0, 60)}...` : flat;
    return `[${feedback.category}] ${preview}`;
  }

  /** 이슈 본문 — 재현에 필요한 전체 맥락 + 스크린샷 대시보드 링크 */
  private buildBody(feedback: Feedback): string {
    return [
      `- **작성자(userId)**: ${feedback.userId}`,
      `- **카테고리**: ${feedback.category}`,
      `- **페이지**: ${feedback.pageUrl ?? '-'}`,
      `- **브라우저**: ${feedback.browserInfo ?? '-'}`,
      `- **스터디 ID**: ${feedback.studyId ?? '-'}`,
      `- **피드백 ID(publicId)**: ${feedback.publicId}`,
      '',
      '---',
      '### 내용',
      '',
      feedback.content,
      '',
      '---',
      `> 스크린샷은 관리자 대시보드에서 확인: \`/admin/feedbacks/${feedback.publicId}\``,
    ].join('\n');
  }

  /** 라벨 — 항상 `feedback` + 카테고리 라벨(중복 제거) */
  private buildLabels(feedback: Feedback): string[] {
    return [...new Set(['feedback', CATEGORY_LABELS[feedback.category] ?? 'feedback'])];
  }
}
