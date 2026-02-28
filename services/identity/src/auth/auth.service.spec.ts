import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../user/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

jest.mock('bcrypt');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let mockFindOne: jest.Mock;
  let mockCreate: jest.Mock;
  let mockSave: jest.Mock;
  let mockSign: jest.Mock;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@algosu.dev',
    username: 'tester',
    passwordHash: '$2b$10$hashedpassword',
    role: 'MEMBER',
    createdAt: new Date('2026-02-28'),
    updatedAt: new Date('2026-02-28'),
  };

  beforeEach(async () => {
    mockFindOne = jest.fn();
    mockCreate = jest.fn();
    mockSave = jest.fn();
    mockSign = jest.fn().mockReturnValue('mocked.jwt.token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: mockFindOne,
            create: mockCreate,
            save: mockSave,
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: mockSign,
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register()', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@algosu.dev',
      username: 'newuser',
      password: 'securePassword123',
    };

    it('정상 회원가입: User 생성, bcrypt 해싱, JWT 반환', async () => {
      mockFindOne.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashed');

      const createdUser = {
        ...mockUser,
        email: registerDto.email,
        username: registerDto.username,
        passwordHash: '$2b$10$hashed',
      };
      mockCreate.mockReturnValue(createdUser);
      mockSave.mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      // bcrypt.hash가 비밀번호와 salt rounds 10으로 호출되었는지 확인
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);

      // userRepo.create가 올바른 인자로 호출되었는지 확인
      expect(mockCreate).toHaveBeenCalledWith({
        email: registerDto.email,
        username: registerDto.username,
        passwordHash: '$2b$10$hashed',
        role: 'MEMBER',
      });

      // userRepo.save가 호출되었는지 확인
      expect(mockSave).toHaveBeenCalledWith(createdUser);

      // JWT 토큰이 반환되었는지 확인
      expect(result).toEqual({ access_token: 'mocked.jwt.token' });
    });

    it('중복 이메일: ConflictException 발생', async () => {
      mockFindOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );

      // findOne 리셋 후 메시지 검증
      mockFindOne.mockResolvedValue(mockUser);
      await expect(service.register(registerDto)).rejects.toThrow(
        '이미 사용 중인 이메일입니다.',
      );

      // 중복 이메일이므로 create/save가 호출되지 않아야 함
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('기본 role: MEMBER 역할 할당 확인', async () => {
      mockFindOne.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashed');

      const createdUser = {
        ...mockUser,
        email: registerDto.email,
        username: registerDto.username,
        passwordHash: '$2b$10$hashed',
      };
      mockCreate.mockReturnValue(createdUser);
      mockSave.mockResolvedValue(createdUser);

      await service.register(registerDto);

      // create 호출 시 role이 'MEMBER'로 설정되었는지 확인
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'MEMBER' }),
      );
    });
  });

  describe('login()', () => {
    const loginDto: LoginDto = {
      email: 'test@algosu.dev',
      password: 'correctPassword',
    };

    it('정상 로그인: bcrypt 비교 성공, JWT 반환', async () => {
      mockFindOne.mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      // bcrypt.compare가 올바른 인자로 호출되었는지 확인
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.passwordHash,
      );

      // JWT 토큰이 반환되었는지 확인
      expect(result).toEqual({ access_token: 'mocked.jwt.token' });
    });

    it('존재하지 않는 이메일: UnauthorizedException 발생', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      mockFindOne.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );

      // 사용자가 없으므로 bcrypt.compare가 호출되지 않아야 함
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('잘못된 비밀번호: UnauthorizedException 발생', async () => {
      mockFindOne.mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      mockFindOne.mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(loginDto)).rejects.toThrow(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    });
  });

  describe('issueToken()', () => {
    it('JWT 페이로드: sub, email, role 포함 확인', async () => {
      mockFindOne.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashed');

      const createdUser = { ...mockUser, passwordHash: '$2b$10$hashed' };
      mockCreate.mockReturnValue(createdUser);
      mockSave.mockResolvedValue(createdUser);

      const registerDto: RegisterDto = {
        email: mockUser.email,
        username: mockUser.username,
        password: 'testPassword123',
      };

      await service.register(registerDto);

      // jwtService.sign이 올바른 페이로드로 호출되었는지 확인
      expect(mockSign).toHaveBeenCalledWith({
        sub: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
      });
    });
  });
});
