/**
 * @file Solved.ac API 연동 서비스 — 백준 문제 정보 조회
 * @domain problem
 * @layer service
 * @related solvedac.controller.ts
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

const SOLVEDAC_API = 'https://solved.ac/api/v3';
const TIMEOUT_MS = 5_000;

export interface SolvedacProblemInfo {
  problemId: number;
  title: string;
  difficulty: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | null;
  level: number;
  sourceUrl: string;
  tags: string[];
}

function levelToDifficulty(level: number): SolvedacProblemInfo['difficulty'] {
  if (level <= 0) return null;
  if (level <= 5) return 'BRONZE';
  if (level <= 10) return 'SILVER';
  if (level <= 15) return 'GOLD';
  if (level <= 20) return 'PLATINUM';
  return 'DIAMOND';
}

@Injectable()
export class SolvedacService {
  private readonly logger = new Logger(SolvedacService.name);

  async fetchProblem(problemId: number): Promise<SolvedacProblemInfo> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${SOLVEDAC_API}/problem/show?problemId=${problemId}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Solved.ac API request failed: ${message}`);
      throw new ServiceUnavailableException('Solved.ac API에 연결할 수 없습니다.');
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 404) {
      throw new NotFoundException(
        `백준 ${problemId}번 문제는 Solved.ac에 등록되지 않았습니다.`,
      );
    }

    if (!res.ok) {
      this.logger.warn(`Solved.ac API returned ${res.status}`);
      throw new ServiceUnavailableException('Solved.ac API 응답 오류입니다.');
    }

    const body = (await res.json()) as {
      problemId: number;
      titleKo: string;
      level: number;
      tags: { displayNames: { language: string; name: string }[] }[];
    };

    const tags = body.tags
      .map((t) => {
        const ko = t.displayNames.find((d) => d.language === 'ko');
        return ko?.name ?? t.displayNames[0]?.name;
      })
      .filter((n): n is string => !!n);

    return {
      problemId: body.problemId,
      title: body.titleKo,
      difficulty: levelToDifficulty(body.level),
      level: body.level,
      sourceUrl: `https://www.acmicpc.net/problem/${body.problemId}`,
      tags,
    };
  }
}
