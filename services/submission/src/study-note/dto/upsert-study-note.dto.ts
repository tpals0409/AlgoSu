/**
 * @file 스터디 노트 생성/수정 DTO
 * @domain review
 * @layer dto
 */
import { IsUUID, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpsertStudyNoteDto {
  @IsUUID()
  problemId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content!: string;
}
