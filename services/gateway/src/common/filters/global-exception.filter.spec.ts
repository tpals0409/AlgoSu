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

  describe('HttpException — exceptionResponse가 string인 경우', () => {
    it('exceptionResponse가 string이면 exception.message와 HttpStatus 코드명으로 응답', () => {
      // HttpException에 string 응답을 전달하면 getResponse()가 string 반환
      const exception = new HttpException('Forbidden resource', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      const body = mockRes.json.mock.calls[0][0];
      expect(body.statusCode).toBe(403);
      // exceptionResponse가 string이므로 else 분기: message = exception.message
      expect(body.message).toBe('Forbidden resource');
    });

    it('body에 message 필드 없으면 exception.message로 fallback', () => {
      // exceptionResponse가 object지만 message 필드 없음
      const exception = new HttpException({ error: 'Custom Error' }, HttpStatus.UNPROCESSABLE_ENTITY);

      filter.catch(exception, mockHost);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      const body = mockRes.json.mock.calls[0][0];
      // message 필드가 없으면 exception.message(=Unprocessable Entity) fallback
      expect(body.message).toBeDefined();
    });

    it('body에 error 필드 없으면 HttpStatus 코드명으로 fallback', () => {
      // exceptionResponse가 object이지만 error 필드 없음
      const exception = new HttpException(
        { message: 'Not found' },
        HttpStatus.NOT_FOUND,
      );

      filter.catch(exception, mockHost);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      const body = mockRes.json.mock.calls[0][0];
      // error 필드 없음 → HttpStatus[404] 사용
      expect(body.error).toBeDefined();
    });

    it('exceptionResponse가 null이 아닌 object이고 error/message 없으면 HttpStatus로 fallback', () => {
      // 빈 객체 응답
      const exception = new HttpException({}, HttpStatus.CONFLICT);

      filter.catch(exception, mockHost);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      const body = mockRes.json.mock.calls[0][0];
      expect(body.statusCode).toBe(409);
      expect(body.error).toBeDefined();
    });

    it('exceptionResponse가 string일 때 HttpStatus 역매핑 없는 상태코드면 Error fallback', () => {
      // NestJS HttpException을 직접 조작하여 exceptionResponse가 string이고
      // getStatus()가 HttpStatus 역매핑이 없는 값을 반환하게 만듦
      class CustomException extends HttpException {
        constructor() {
          super('custom error message', 200);
        }
        getStatus(): number {
          return 999 as number; // HttpStatus 역매핑 없는 값
        }
        getResponse(): string {
          return 'custom error message';
        }
      }

      const exception = new CustomException();
      filter.catch(exception, mockHost);

      const body = mockRes.json.mock.calls[0][0];
      expect(body.error).toBe('Error');
    });

    it('exceptionResponse가 object일 때 error 없고 HttpStatus 역매핑도 없으면 Error fallback', () => {
      class CustomException extends HttpException {
        constructor() {
          super({ message: 'custom' }, 200);
        }
        getStatus(): number {
          return 999 as number;
        }
        getResponse(): object {
          return { message: 'custom' };
        }
      }

      const exception = new CustomException();
      filter.catch(exception, mockHost);

      const body = mockRes.json.mock.calls[0][0];
      expect(body.error).toBe('Error');
    });
  });
});
