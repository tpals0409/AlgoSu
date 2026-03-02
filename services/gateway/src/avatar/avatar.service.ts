/**
 * @file 프로필 이미지 업로드 서비스 (MinIO 연동 + 리사이징 + 검증)
 * @domain identity
 * @layer service
 * @related AvatarController, MinIO, User.avatar_url
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  AVATAR_SIZE,
  AVATAR_BUCKET,
  MAGIC_BYTES,
  WEBP_SIGNATURE,
} from './avatar.constants';

// ─── TYPES ────────────────────────────────

interface UploadResult {
  /** MinIO 내 오브젝트 키 */
  objectKey: string;
  /** 외부 접근 가능 URL */
  avatarUrl: string;
}

// ─── SERVICE ──────────────────────────────

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);
  private readonly minioClient: Minio.Client;
  private readonly minioEndpoint: string;

  constructor(private readonly configService: ConfigService) {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT', 'minio');
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY', '');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY', '');
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';

    this.minioClient = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    this.minioEndpoint = this.configService.get<string>(
      'MINIO_PUBLIC_URL',
      `http://${endPoint}:${port}`,
    );
  }

  /**
   * 프로필 이미지를 검증, 리사이징 후 MinIO에 업로드
   * @domain identity
   * @param userId - 업로드 주체 사용자 ID
   * @param file - Multer 파일 객체
   * @returns MinIO 오브젝트 키 및 외부 URL
   * @throws BadRequestException 파일 검증 실패 시
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    this.validateFile(file);
    this.validateMagicBytes(file.buffer, file.mimetype);

    const resizedBuffer = await this.resizeImage(file.buffer);
    const extension = this.getExtension(file.mimetype);
    const objectKey = `${userId}/${uuidv4()}.${extension}`;

    await this.minioClient.putObject(
      AVATAR_BUCKET,
      objectKey,
      resizedBuffer,
      resizedBuffer.length,
      { 'Content-Type': 'image/webp' },
    );

    const avatarUrl = `${this.minioEndpoint}/${AVATAR_BUCKET}/${objectKey}`;

    this.logger.log(
      JSON.stringify({
        tag: 'MINIO_UPLOAD_SUCCESS',
        service: 'gateway',
        userId,
        objectKey,
        originalSize: file.size,
        resizedSize: resizedBuffer.length,
        originalMime: file.mimetype,
      }),
    );

    return { objectKey, avatarUrl };
  }

  /**
   * 기존 아바타를 MinIO에서 삭제
   * @domain identity
   * @param objectKey - 삭제할 오브젝트 키
   */
  async deleteAvatar(objectKey: string): Promise<void> {
    try {
      await this.minioClient.removeObject(AVATAR_BUCKET, objectKey);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          tag: 'MINIO_DELETE_WARN',
          service: 'gateway',
          objectKey,
          message: 'Failed to delete old avatar',
        }),
      );
    }
  }

  // ─── HELPERS ──────────────────────────────

  /**
   * 파일 메타데이터 검증 (MIME 타입, 크기)
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file || !file.buffer) {
      throw new BadRequestException('파일이 첨부되지 않았습니다.');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_MIME_TYPES[number])) {
      throw new BadRequestException(
        `허용되지 않는 파일 형식입니다. (허용: ${ALLOWED_MIME_TYPES.join(', ')})`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `파일 크기가 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과합니다.`,
      );
    }
  }

  /**
   * Magic Byte 시그니처 검증 — 확장자 위조 방어
   */
  private validateMagicBytes(buffer: Buffer, mimetype: string): void {
    const sig = MAGIC_BYTES[mimetype];
    if (!sig) {
      throw new BadRequestException('지원하지 않는 이미지 형식입니다.');
    }

    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[sig.offset + i] !== sig.bytes[i]) {
        throw new BadRequestException(
          '파일 내용이 확장자와 일치하지 않습니다. (Magic Byte 불일치)',
        );
      }
    }

    // WebP 추가 시그니처 검증 (offset 8: WEBP)
    if (mimetype === 'image/webp') {
      for (let i = 0; i < WEBP_SIGNATURE.bytes.length; i++) {
        if (buffer[WEBP_SIGNATURE.offset + i] !== WEBP_SIGNATURE.bytes[i]) {
          throw new BadRequestException(
            '파일 내용이 확장자와 일치하지 않습니다. (WebP 시그니처 불일치)',
          );
        }
      }
    }
  }

  /**
   * sharp로 200x200 WebP 리사이징 (출력 항상 WebP)
   */
  private async resizeImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer();
  }

  /**
   * MIME 타입 → 파일 확장자 (저장은 항상 WebP)
   */
  private getExtension(_mimetype: string): string {
    return 'webp';
  }
}
