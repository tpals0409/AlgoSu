/**
 * @file User 컨트롤러 — Internal API (서비스 간 통신 전용)
 * @domain identity
 * @layer controller
 * @related user.service.ts, internal-key.guard.ts
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { UserService } from './user.service';
import { UpsertUserDto } from './dto/upsert-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateGitHubDto } from './dto/update-github.dto';
import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';

@ApiTags('Users')
@Controller('api/users')
@UseGuards(InternalKeyGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** OAuth 로그인 시 사용자 생성/조회 */
  @ApiOperation({ summary: '사용자 생성/조회 (OAuth upsert)' })
  @ApiResponse({ status: 200, description: '사용자 정보 반환' })
  @Post('upsert')
  async upsertUser(@Body() dto: UpsertUserDto) {
    const user = await this.userService.upsertUser(dto);
    return { data: user };
  }

  /** ID로 사용자 조회 */
  @ApiOperation({ summary: 'ID로 사용자 조회' })
  @ApiResponse({ status: 200, description: '사용자 정보' })
  @ApiResponse({ status: 404, description: '사용자 없음' })
  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userService.findById(id);
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return { data: user };
  }

  /** 프로필 업데이트 (name, avatar_url) */
  @ApiOperation({ summary: '프로필 업데이트' })
  @ApiResponse({ status: 200, description: '업데이트된 사용자 정보' })
  @Patch(':id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.userService.updateUser(id, dto);
    return { data: user };
  }

  /** 소프트 삭제 */
  @ApiOperation({ summary: '사용자 소프트 삭제' })
  @ApiResponse({ status: 200, description: '삭제 완료' })
  @Delete(':id')
  async softDeleteUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.userService.softDeleteUser(id);
    return { data: { message: '계정이 삭제되었습니다.' } };
  }

  /** GitHub 연동/해제 */
  @ApiOperation({ summary: 'GitHub 연동 정보 업데이트' })
  @ApiResponse({ status: 200, description: '연동 정보 업데이트 완료' })
  @Patch(':id/github')
  async updateGitHub(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGitHubDto,
  ) {
    await this.userService.updateGitHub(id, dto);
    return { data: { message: 'GitHub 연동 정보가 업데이트되었습니다.' } };
  }

  /** GitHub 연동 상태 조회 */
  @ApiOperation({ summary: 'GitHub 연동 상태 조회' })
  @ApiResponse({ status: 200, description: 'GitHub 연동 상태' })
  @Get(':id/github-status')
  async getGitHubStatus(@Param('id', ParseUUIDPipe) id: string) {
    const status = await this.userService.getGitHubStatus(id);
    return { data: status };
  }

  /** GitHub 토큰 정보 조회 (암호화 상태 그대로) */
  @ApiOperation({ summary: 'GitHub 토큰 정보 조회' })
  @ApiResponse({ status: 200, description: 'GitHub 토큰 정보' })
  @Get(':id/github-token')
  async getGitHubTokenInfo(@Param('id', ParseUUIDPipe) id: string) {
    const info = await this.userService.getGitHubTokenInfo(id);
    return { data: info };
  }

  /** slug 기반 공개 프로필 조회 */
  @ApiOperation({ summary: 'slug 기반 공개 프로필 조회' })
  @ApiResponse({ status: 200, description: '공개 프로필 정보' })
  @ApiResponse({ status: 404, description: '프로필 없음' })
  @Get('by-slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const user = await this.userService.findBySlug(slug);
    if (!user) throw new NotFoundException('프로필을 찾을 수 없습니다.');
    return { data: user };
  }

  /** 프로필 설정 업데이트 — slug + 공개 토글 */
  @ApiOperation({ summary: '프로필 설정 업데이트 (slug + 공개 토글)' })
  @ApiResponse({ status: 200, description: '업데이트된 프로필 설정' })
  @Patch(':id/profile-settings')
  async updateProfileSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileSettingsDto,
  ) {
    const result = await this.userService.updateProfileSettings(id, dto);
    return { data: result };
  }
}
