/**
 * @file programmers.controller.ts — 프로그래머스 외부 API 컨트롤러
 * @domain problem
 * @layer controller
 * @related programmers.service.ts, external.module.ts
 *
 * SolvedacController 와 대칭 구조를 유지한다.
 * - GET /api/external/programmers/problem/:problemId  단건 조회
 * - GET /api/external/programmers/search              키워드 검색 + 페이지
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
  ProgrammersService,
  ProgrammersProblemInfo,
  ProgrammersSearchResult,
} from './programmers.service';

/** 허용하는 최대 프로그래머스 문제 ID (현재 공개 문제 기준 여유 있게 설정) */
const MAX_PROBLEM_ID = 999_999;

@ApiTags('External — Programmers')
@Controller('api/external/programmers')
export class ProgrammersController {
  constructor(private readonly programmersService: ProgrammersService) {}

  /**
   * 프로그래머스 문제 단건 조회
   * @param raw  URL 파라미터로 받은 문제 ID 문자열
   */
  @ApiOperation({ summary: '프로그래머스 문제 정보 조회' })
  @ApiResponse({ status: 200, description: '문제 정보 반환' })
  @ApiResponse({ status: 400, description: '잘못된 문제 ID 형식' })
  @ApiResponse({ status: 404, description: '문제 없음' })
  @Get('problem/:problemId')
  getProblem(@Param('problemId') raw: string): ProgrammersProblemInfo {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1 || id > MAX_PROBLEM_ID) {
      throw new BadRequestException(
        `문제 번호는 1~${MAX_PROBLEM_ID} 사이의 정수여야 합니다.`,
      );
    }
    return this.programmersService.fetchProblem(id);
  }

  /**
   * 프로그래머스 문제 키워드 검색
   * @param query    검색어 (1~100자)
   * @param pageRaw  페이지 번호 (1~100, 기본 1)
   */
  @ApiOperation({ summary: '프로그래머스 문제 검색' })
  @ApiResponse({ status: 200, description: '검색 결과 반환' })
  @ApiResponse({ status: 400, description: '잘못된 검색어 또는 페이지' })
  @Get('search')
  searchProblem(
    @Query('query') query?: string,
    @Query('page') pageRaw?: string,
  ): ProgrammersSearchResult {
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

    return this.programmersService.searchProblem(trimmed, page);
  }
}
