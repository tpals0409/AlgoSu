/**
 * @file github-success-callback.dto.ts — GitHub 동기화 성공 콜백 DTO
 * @domain submission
 * @layer dto
 * @related submission-internal.controller.ts, saga-orchestrator.service.ts
 */
import { IsString, IsNotEmpty } from 'class-validator';

export class GithubSuccessCallbackDto {
  @IsString()
  @IsNotEmpty()
  filePath!: string;
}
