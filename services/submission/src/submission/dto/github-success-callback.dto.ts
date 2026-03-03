import { IsString, IsNotEmpty } from 'class-validator';

export class GithubSuccessCallbackDto {
  @IsString()
  @IsNotEmpty()
  filePath!: string;
}
