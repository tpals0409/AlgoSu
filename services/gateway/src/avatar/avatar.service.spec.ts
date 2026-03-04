import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AvatarService } from './avatar.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { MAX_FILE_SIZE } from './avatar.constants';

// sharp mock
jest.mock('sharp', () => {
  const mockSharp = jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('resized-webp')),
  }));
  return mockSharp;
});

// uuid mock
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

// minio mock
const mockPutObject = jest.fn().mockResolvedValue(undefined);
const mockRemoveObject = jest.fn().mockResolvedValue(undefined);
jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    putObject: mockPutObject,
    removeObject: mockRemoveObject,
  })),
}));

describe('AvatarService', () => {
  let service: AvatarService;
  let logger: StructuredLoggerService;

  beforeEach(async () => {
    mockPutObject.mockClear();
    mockRemoveObject.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvatarService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              const map: Record<string, unknown> = {
                MINIO_ENDPOINT: 'localhost',
                MINIO_PORT: 9000,
                MINIO_ACCESS_KEY: 'minioadmin',
                MINIO_SECRET_KEY: 'minioadmin',
                MINIO_USE_SSL: 'false',
                MINIO_PUBLIC_URL: 'http://localhost:9000',
              };
              return map[key] ?? defaultVal;
            }),
          },
        },
        {
          provide: StructuredLoggerService,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AvatarService>(AvatarService);
    logger = module.get<StructuredLoggerService>(StructuredLoggerService);
  });

  // ─── JPEG Magic Bytes: FF D8 FF ──────────────────────────────
  const createJpegFile = (overrides?: Partial<Express.Multer.File>): Express.Multer.File => ({
    fieldname: 'avatar',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
    ...overrides,
  });

  // ─── PNG Magic Bytes: 89 50 4E 47 ──────────────────────────────
  const createPngFile = (overrides?: Partial<Express.Multer.File>): Express.Multer.File => ({
    fieldname: 'avatar',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
    ...overrides,
  });

  describe('uploadAvatar', () => {
    it('JPEG 파일을 업로드하고 결과를 반환한다', async () => {
      const file = createJpegFile();
      const result = await service.uploadAvatar('user-1', file);

      expect(result.objectKey).toBe('user-1/test-uuid.webp');
      expect(result.avatarUrl).toBe('http://localhost:9000/avatars/user-1/test-uuid.webp');
      expect(mockPutObject).toHaveBeenCalledTimes(1);
      expect(logger.log).toHaveBeenCalled();
    });

    it('PNG 파일도 업로드할 수 있다', async () => {
      const file = createPngFile();
      const result = await service.uploadAvatar('user-2', file);

      expect(result.objectKey).toBe('user-2/test-uuid.webp');
      expect(mockPutObject).toHaveBeenCalledTimes(1);
    });

    it('파일이 없으면 BadRequestException을 던진다', async () => {
      await expect(
        service.uploadAvatar('user-1', null as unknown as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it('buffer가 없으면 BadRequestException을 던진다', async () => {
      const file = createJpegFile({ buffer: undefined as unknown as Buffer });
      await expect(service.uploadAvatar('user-1', file)).rejects.toThrow(BadRequestException);
    });

    it('허용되지 않는 MIME 타입이면 BadRequestException을 던진다', async () => {
      const file = createJpegFile({ mimetype: 'image/gif' });
      await expect(service.uploadAvatar('user-1', file)).rejects.toThrow(BadRequestException);
    });

    it('파일 크기 초과 시 BadRequestException을 던진다', async () => {
      const file = createJpegFile({ size: MAX_FILE_SIZE + 1 });
      await expect(service.uploadAvatar('user-1', file)).rejects.toThrow(BadRequestException);
    });

    it('Magic Byte 불일치 시 BadRequestException을 던진다', async () => {
      const file = createJpegFile({
        buffer: Buffer.from([0x00, 0x00, 0x00, 0x00]),
      });
      await expect(service.uploadAvatar('user-1', file)).rejects.toThrow(BadRequestException);
    });

    it('WebP 파일 — RIFF 시그니처 일치하면 업로드 성공', async () => {
      // WebP: RIFF(0x52,0x49,0x46,0x46) at offset 0, WEBP(0x57,0x45,0x42,0x50) at offset 8
      const webpBuffer = Buffer.alloc(16, 0);
      webpBuffer[0] = 0x52; webpBuffer[1] = 0x49; webpBuffer[2] = 0x46; webpBuffer[3] = 0x46;
      webpBuffer[8] = 0x57; webpBuffer[9] = 0x45; webpBuffer[10] = 0x42; webpBuffer[11] = 0x50;

      const file: Express.Multer.File = {
        fieldname: 'avatar',
        originalname: 'test.webp',
        encoding: '7bit',
        mimetype: 'image/webp',
        size: 1024,
        buffer: webpBuffer,
        destination: '',
        filename: '',
        path: '',
        stream: null as never,
      };

      const result = await service.uploadAvatar('user-3', file);

      expect(result.objectKey).toBe('user-3/test-uuid.webp');
      expect(mockPutObject).toHaveBeenCalledTimes(1);
    });

    it('WebP 파일 — WEBP 시그니처 불일치 시 BadRequestException을 던진다', async () => {
      // RIFF 시그니처는 맞지만 offset 8의 WEBP 시그니처 불일치
      const webpBuffer = Buffer.alloc(16, 0);
      webpBuffer[0] = 0x52; webpBuffer[1] = 0x49; webpBuffer[2] = 0x46; webpBuffer[3] = 0x46;
      // offset 8: 잘못된 시그니처
      webpBuffer[8] = 0x00; webpBuffer[9] = 0x00; webpBuffer[10] = 0x00; webpBuffer[11] = 0x00;

      const file: Express.Multer.File = {
        fieldname: 'avatar',
        originalname: 'test.webp',
        encoding: '7bit',
        mimetype: 'image/webp',
        size: 1024,
        buffer: webpBuffer,
        destination: '',
        filename: '',
        path: '',
        stream: null as never,
      };

      await expect(service.uploadAvatar('user-3', file)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateMagicBytes — 지원하지 않는 MIME (line 157)', () => {
    it('MAGIC_BYTES에 없는 mimetype이면 BadRequestException을 던진다', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      // private 메서드 직접 호출하여 !sig 분기 커버
      expect(() => {
        (service as any).validateMagicBytes(buffer, 'image/bmp');
      }).toThrow(BadRequestException);
      expect(() => {
        (service as any).validateMagicBytes(buffer, 'image/bmp');
      }).toThrow('지원하지 않는 이미지 형식입니다.');
    });
  });

  describe('deleteAvatar', () => {
    it('MinIO에서 객체를 삭제한다', async () => {
      await service.deleteAvatar('user-1/old-uuid.webp');

      expect(mockRemoveObject).toHaveBeenCalledWith('avatars', 'user-1/old-uuid.webp');
    });

    it('삭제 실패 시 경고 로그를 출력한다', async () => {
      mockRemoveObject.mockRejectedValueOnce(new Error('not found'));

      await service.deleteAvatar('user-1/missing.webp');

      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
