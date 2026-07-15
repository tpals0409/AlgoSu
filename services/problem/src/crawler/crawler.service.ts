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
  constraints: string | null;
  examples: Record<string, string>[] | null;
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

  /** Programmers 허용 호스트 — SSRF 방어 화이트리스트 */
  private static readonly ALLOWED_HOSTS = ['school.programmers.co.kr', 'programmers.co.kr'];

  /**
   * Programmers 문제 페이지 크롤링 (SSR 확인됨, Playwright 불필요)
   * 파싱 대상: 문제 제목, 문제 설명, 제한 사항, 입출력 예
   */
  private async crawlProgrammers(sourceUrl: string): Promise<CrawledProblemInfo> {
    // SSRF 방어: Programmers 도메인만 허용
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      throw new Error(`유효하지 않은 URL: ${sourceUrl}`);
    }
    if (parsedUrl.protocol !== 'https:' || !CrawlerService.ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
      throw new Error(`허용되지 않은 크롤링 대상: ${parsedUrl.hostname}`);
    }

    const response = await axios.get<string>(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AlgoSu-Crawler/1.0)',
        Accept: 'text/html',
      },
      timeout: 10_000,
    });

    const $ = cheerio.load(response.data as string);

    const title = $('.challenge-title').first().text().trim() || null;

    // 문제 설명: .markdown 전체 텍스트 수집 (기존 behavior 유지)
    const descriptionParts: string[] = [];
    $('div.markdown').each((_, el) => {
      const text = $(el).text().trim();
      if (text) descriptionParts.push(text);
    });
    const description = descriptionParts.length > 0 ? descriptionParts.join('\n\n') : null;

    // 제한 사항: h5[제한] 직후의 ul > li 목록
    const constraints = this.parseConstraints($);

    // 입출력 예: h5[입출력 예] 직후의 table (설명 제외)
    const examples = this.parseExamples($);

    return { title, description, constraints, examples };
  }

  /**
   * .markdown 섹션에서 제한 사항 텍스트를 추출합니다.
   * h5 텍스트에 '제한' 또는 'constraint'가 포함된 경우 직후 ul 항목을 수집합니다.
   */
  private parseConstraints($: ReturnType<typeof cheerio.load>): string | null {
    const markdownDiv = $('div.markdown').first();
    let constraintsText: string | null = null;

    markdownDiv.find('h5').each((_idx, h5El) => {
      const h5Text = $(h5El).text().trim().toLowerCase();
      if (h5Text.includes('제한') || h5Text.includes('constraint')) {
        const ul = $(h5El).next('ul');
        if (ul.length > 0) {
          const items: string[] = [];
          ul.find('li').each((_i, li) => {
            const text = $(li).text().trim();
            if (text) items.push(text);
          });
          if (items.length > 0) {
            constraintsText = items.join('\n');
          }
        }
      }
    });

    return constraintsText;
  }

  /**
   * .markdown 섹션에서 입출력 예 테이블을 파싱해 배열로 반환합니다.
   * h5 텍스트에 '입출력 예'가 포함되되 '설명'은 제외합니다.
   */
  private parseExamples($: ReturnType<typeof cheerio.load>): Record<string, string>[] | null {
    const markdownDiv = $('div.markdown').first();
    let examplesData: Record<string, string>[] | null = null;

    markdownDiv.find('h5').each((_idx, h5El) => {
      const h5Text = $(h5El).text().trim();
      if (h5Text.includes('입출력 예') && !h5Text.includes('설명')) {
        const table = $(h5El).next('table');
        if (table.length > 0) {
          const headers: string[] = [];
          table.find('thead tr th').each((_i, th) => {
            headers.push($(th).text().trim());
          });

          const rows: Record<string, string>[] = [];
          table.find('tbody tr').each((_i, tr) => {
            const row: Record<string, string> = {};
            $(tr).find('td').each((colIdx, td) => {
              if (colIdx < headers.length && headers[colIdx]) {
                row[headers[colIdx]] = $(td).text().trim();
              }
            });
            if (Object.keys(row).length > 0) {
              rows.push(row);
            }
          });

          if (rows.length > 0) {
            examplesData = rows;
          }
        }
      }
    });

    return examplesData;
  }
}
