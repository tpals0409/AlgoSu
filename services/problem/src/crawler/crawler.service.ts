/**
 * @file crawler.service.ts — Programmers 문제 크롤러 (httpx+BeautifulSoup 패턴, NestJS axios+cheerio)
 * @domain problem
 * @layer service
 * @related problem.service.ts, crawler.module.ts
 */
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

export interface CrawledProblemInfo {
  title: string | null;
  description: string | null;
}

/** 지원 플랫폼 식별자 — SourcePlatform enum과 동일한 대문자 표기 */
export const SUPPORTED_PLATFORMS = ['PROGRAMMERS'] as const;
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

@Injectable()
export class CrawlerService {
  constructor(private readonly logger: StructuredLoggerService) {
    this.logger.setContext(CrawlerService.name);
  }

  /**
   * sourceUrl에서 문제 정보를 크롤링합니다.
   * 지원하지 않는 플랫폼이거나 실패 시 null을 반환 (호출자가 fallback 처리)
   */
  async crawl(sourceUrl: string, sourcePlatform: string): Promise<CrawledProblemInfo | null> {
    if (!SUPPORTED_PLATFORMS.includes(sourcePlatform as SupportedPlatform)) {
      return null;
    }

    try {
      return await this.crawlProgrammers(sourceUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn('크롤링 실패 — fallback 처리', { sourceUrl, sourcePlatform, error: message });
      return null;
    }
  }

  /**
   * Programmers 문제 페이지 크롤링 (SSR 확인됨, Playwright 불필요)
   * 파싱 대상: 문제 제목, 문제 설명 전체 텍스트
   */
  private async crawlProgrammers(sourceUrl: string): Promise<CrawledProblemInfo> {
    const response = await axios.get<string>(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AlgoSu-Crawler/1.0)',
        Accept: 'text/html',
      },
      timeout: 10_000,
    });

    const $ = cheerio.load(response.data as string);

    const title = $('.challenge-title').first().text().trim() || null;

    // 문제 설명: .markdown div 전체 텍스트 수집 (입출력 예시 포함)
    const descriptionParts: string[] = [];
    $('div.markdown').each((_, el) => {
      const text = $(el).text().trim();
      if (text) descriptionParts.push(text);
    });
    const description = descriptionParts.length > 0 ? descriptionParts.join('\n\n') : null;

    return { title, description };
  }
}
