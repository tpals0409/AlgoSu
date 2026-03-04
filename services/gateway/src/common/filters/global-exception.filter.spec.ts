import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockLogger: { setContext: jest.Mock; error: jest.Mock };
  let mockRes: { status: jest.Mock; json: jest.Mock };
  let mockReq: { url: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    mockLogger = { setContext: jest.fn(), error: jest.fn() };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockReq = { url: '/api/test' };
    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => mockRes,
      }),
    } as unknown as ArgumentsHost;

    filter = new GlobalExceptionFilter(mockLogger as any);
  });

  it('setContext를 GlobalExceptionFilter로 설정한다', () => {
    expect(mockLogger.setContext).toHaveBeenCalledWith('GlobalExceptionFilter');
  });

  describe('HttpException 처리', () => {
    it('HttpException의 statusCode와 message를 그대로 반환한다', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Not Found',
          path: '/api/test',
        }),
      );
    });

    it('ValidationPipe 에러 객체(message[], error)를 그대로 전달한다', () => {
      const exception = new HttpException(
        { message: ['field must not be empty'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: ['field must not be empty'],
          error: 'Bad Request',
        }),
      );
    });

    it('응답에 timestamp과 path가 포함된다', () => {
      const exception = new HttpException('err', 400);

      filter.catch(exception, mockHost);

      const body = mockRes.json.mock.calls[0][0];
      expect(body.timestamp).toBeDefined();
      expect(body.path).toBe('/api/test');
    });
  });

  describe('비-HttpException 처리', () => {
    it('알 수 없는 에러는 500 + "Internal Server Error"로 응답한다', () => {
      const exception = new Error('DB connection failed');

      filter.catch(exception, mockHost);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Internal Server Error',
          error: 'Internal Server Error',
        }),
      );
    });

    it('서버 로그에 에러 메시지와 스택을 기록한다', () => {
      const exception = new Error('DB connection failed');

      filter.catch(exception, mockHost);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unhandled exception: DB connection failed',
        exception.stack,
      );
    });

    it('null/undefined 예외도 500으로 처리한다', () => {
      filter.catch(null, mockHost);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Internal Server Error',
        }),
      );
    });
  });
});
