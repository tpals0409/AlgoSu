/**
 * @file Solved.ac 외부 API 컨트롤러 — 백준 문제 정보 프록시
 * @domain problem
 * @layer controller
 * @related solvedac.service.ts
 */
import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  SolvedacService,
  SolvedacProblemInfo,
  SolvedacSearchResult,
} from './solvedac.service';

@ApiTags('External — Solved.ac')
@Controller('api/external/solvedac')
export class SolvedacController {
  constructor(private readonly solvedacService: SolvedacService) {}

  @ApiOperation({ summary: 'Solved.ac 문제 정보 조회' })
  @ApiResponse({ status: 200, description: '문제 정보 반환' })
  @Get('problem/:problemId')
  async getProblem(
    @Param('problemId') raw: string,
  ): Promise<SolvedacProblemInfo> {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1 || id > 99999) {
      throw new BadRequestException('문제 번호는 1~99999 사이의 정수여야 합니다.');
    }
    return this.solvedacService.fetchProblem(id);
  }

  @ApiOperation({ summary: 'Solved.ac 문제 검색 (Referer 403 우회)' })
  @ApiResponse({ status: 200, description: '검색 결과 반환' })
  @Get('search')
  async searchProblem(
    @Query('query') query?: string,
    @Query('page') pageRaw?: string,
  ): Promise<SolvedacSearchResult> {
    const trimmed = (query ?? '').trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      throw new BadRequestException('검색어는 1~100자 사이여야 합니다.');
    }

    let page = 1;
    if (pageRaw !== undefined && pageRaw !== '') {
      const parsed = Number(pageRaw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        throw new BadRequestException('page는 1~100 사이의 정수여야 합니다.');
      }
      page = parsed;
    }

    return this.solvedacService.searchProblem(trimmed, page);
  }
}
