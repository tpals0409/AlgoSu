/**
 * @file Solved.ac API 연동 서비스 — 백준 문제 정보 조회
 * @domain problem
 * @layer service
 * @related solvedac.controller.ts
 *
 * NOTE (Sprint 83 긴급 패치):
 *   Cloudflare가 Node.js TLS JA3 fingerprint를 전면 차단하여 fetch/https/
 *   custom ciphers 모두 403을 돌려받음. Alpine 기본 포함 wget(BusyBox)만
 *   정상 200 OK를 받으므로 child_process.execFile 로 subprocess 호출한다.
 */
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

const SOLVEDAC_API = 'https://solved.ac/api/v3';
const WGET_TIMEOUT_SEC = 5;
const EXEC_TIMEOUT_MS = 6_000;
const MAX_BUFFER = 10 * 1024 * 1024;

const execFileAsync = promisify(execFile);

export interface SolvedacProblemInfo {
  problemId: number;
  title: string;
  difficulty: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'RUBY' | null;
  level: number;
  sourceUrl: string;
  tags: string[];
}

export interface SolvedacSearchItem {
  problemId: number;
  titleKo: string;
  level: number;
  difficulty: SolvedacProblemInfo['difficulty'];
  sourceUrl: string;
  tags: string[];
}

export interface SolvedacSearchResult {
  count: number;
  items: SolvedacSearchItem[];
}

interface SolvedacRawProblem {
  problemId: number;
  titleKo: string;
  level: number;
  tags: { displayNames: { language: string; name: string }[] }[];
}

interface WgetExecError {
  stderr?: string | Buffer;
  stdout?: string | Buffer;
  code?: number;
  message?: string;
}

function extractKoreanTags(tags: SolvedacRawProblem['tags']): string[] {
  return tags
    .map((t) => {
      const ko = t.displayNames.find((d) => d.language === 'ko');
      return ko?.name ?? t.displayNames[0]?.name;
    })
    .filter((n): n is string => !!n);
}

function levelToDifficulty(level: number): SolvedacProblemInfo['difficulty'] {
  if (level <= 0) return null;
  if (level <= 5) return 'BRONZE';
  if (level <= 10) return 'SILVER';
  if (level <= 15) return 'GOLD';
  if (level <= 20) return 'PLATINUM';
  if (level <= 25) return 'DIAMOND';
  return 'RUBY';
}

/**
 * wget stderr 에서 HTTP status code 를 추출한다.
 * 예: "server returned error: HTTP/1.1 404 Not Found"
 */
function parseHttpStatusFromStderr(stderr: string): number | null {
  const match = stderr.match(/HTTP\/\S+\s+(\d{3})/);
  return match ? Number(match[1]) : null;
}

@Injectable()
export class SolvedacService {
  constructor(private readonly logger: StructuredLoggerService) {
    this.logger.setContext(SolvedacService.name);
  }

  /**
   * wget subprocess 로 URL 호출 후 응답 body(JSON 문자열) 반환.
   * 실패 시 HTTP status 를 파싱하여 NotFoundException / ServiceUnavailableException 을 throw.
   */
  private async wgetJson(url: string, notFoundMessage: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        'wget',
        ['-q', '-O', '-', `--timeout=${WGET_TIMEOUT_SEC}`, url],
        { timeout: EXEC_TIMEOUT_MS, maxBuffer: MAX_BUFFER },
      );
      return typeof stdout === 'string' ? stdout : Buffer.from(stdout).toString('utf8');
    } catch (err: unknown) {
      const e = err as WgetExecError;
      const stderr =
        typeof e?.stderr === 'string'
          ? e.stderr
          : Buffer.isBuffer(e?.stderr)
            ? e.stderr.toString('utf8')
            : '';
      const status = parseHttpStatusFromStderr(stderr);

      if (status === 404) {
        throw new NotFoundException(notFoundMessage);
      }

      const message = e?.message ?? String(err);
      this.logger.warn(
        `Solved.ac wget failed (status=${status ?? 'unknown'}): ${message}`,
      );
      throw new ServiceUnavailableException('Solved.ac API에 연결할 수 없습니다.');
    }
  }

  async fetchProblem(problemId: number): Promise<SolvedacProblemInfo> {
    const url = `${SOLVEDAC_API}/problem/show?problemId=${problemId}`;
    const raw = await this.wgetJson(
      url,
      `백준 ${problemId}번 문제는 Solved.ac에 등록되지 않았습니다.`,
    );

    let body: SolvedacRawProblem;
    try {
      body = JSON.parse(raw) as SolvedacRawProblem;
    } catch (err: unknown) {
      this.logger.warn(`Solved.ac JSON parse failed: ${String(err)}`);
      throw new ServiceUnavailableException('Solved.ac API 응답 오류입니다.');
    }

    return {
      problemId: body.problemId,
      title: body.titleKo,
      difficulty: levelToDifficulty(body.level),
      level: body.level,
      sourceUrl: `https://www.acmicpc.net/problem/${body.problemId}`,
      tags: extractKoreanTags(body.tags),
    };
  }

  async searchProblem(query: string, page = 1): Promise<SolvedacSearchResult> {
    const url =
      `${SOLVEDAC_API}/search/problem` +
      `?query=${encodeURIComponent(query)}&page=${page}`;

    const raw = await this.wgetJson(url, 'Solved.ac 검색 결과가 없습니다.');

    let body: { count: number; items: SolvedacRawProblem[] };
    try {
      body = JSON.parse(raw) as { count: number; items: SolvedacRawProblem[] };
    } catch (err: unknown) {
      this.logger.warn(`Solved.ac search JSON parse failed: ${String(err)}`);
      throw new ServiceUnavailableException('Solved.ac API 응답 오류입니다.');
    }

    const items: SolvedacSearchItem[] = body.items.map((raw) => ({
      problemId: raw.problemId,
      titleKo: raw.titleKo,
      level: raw.level,
      difficulty: levelToDifficulty(raw.level),
      sourceUrl: `https://www.acmicpc.net/problem/${raw.problemId}`,
      tags: extractKoreanTags(raw.tags),
    }));

    return { count: body.count, items };
  }
}
