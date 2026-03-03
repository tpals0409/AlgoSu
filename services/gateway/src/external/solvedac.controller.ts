import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { SolvedacService, SolvedacProblemInfo } from './solvedac.service';

@Controller('api/external/solvedac')
export class SolvedacController {
  constructor(private readonly solvedacService: SolvedacService) {}

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
}
