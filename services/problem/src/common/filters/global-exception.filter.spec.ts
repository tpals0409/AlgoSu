import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { StructuredLoggerService } from '../logger/structured-logger.service';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;
  let mockLogger: Record<string, jest.Mock>;

  beforeEach(() => {
    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      fatal: jest.fn(),
    };

    filter = new GlobalExceptionFilter(mockLogger as unknown as StructuredLoggerService);

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockHost = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/test-path' }),
        getResponse: () => ({ status: mockStatus }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('HttpException: 상태 코드와 메시지를 그대로 전달', () => {
    const exception = new HttpException('찾을 수 없습니다', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: '찾을 수 없습니다',
        path: '/test-path',
      }),
    );
  });

  it('HttpException (객체 응답): message와 error 필드 추출', () => {
    const exception = new HttpException(
      { message: ['title은 필수입니다'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['title은 필수입니다'],
        error: 'Bad Request',
      }),
    );
  });

  it('일반 에러: 500 + "Internal Server Error" (민감 정보 비노출)', () => {
    const exception = new Error('DB connection failed');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
        error: 'Internal Server Error',
        path: '/test-path',
      }),
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('알 수 없는 값(string): 500 Internal Server Error', () => {
    filter.catch('unknown error', mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
      }),
    );
  });

  it('응답에 timestamp와 path 포함', () => {
    const exception = new HttpException('test', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(String),
        path: '/test-path',
      }),
    );
  });
});
