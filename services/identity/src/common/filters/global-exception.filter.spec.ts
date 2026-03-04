import { GlobalExceptionFilter } from './global-exception.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

function createMockHost(url = '/test'): {
  host: ArgumentsHost;
  mockJson: jest.Mock;
  mockStatus: jest.Mock;
} {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockReq = { url };
  const mockRes = { status: mockStatus };

  const host = {
    switchToHttp: () => ({
      getRequest: () => mockReq,
      getResponse: () => mockRes,
    }),
  } as unknown as ArgumentsHost;

  return { host, mockJson, mockStatus };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    const mockLogger = { setContext: jest.fn(), error: jest.fn() };
    filter = new GlobalExceptionFilter(mockLogger as never);
  });

  it('HttpException을 올바르게 처리한다', () => {
    const { host, mockJson, mockStatus } = createMockHost('/api/users');
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not Found',
        path: '/api/users',
      }),
    );
  });

  it('ValidationPipe 에러 (객체 응답)를 처리한다', () => {
    const { host, mockJson, mockStatus } = createMockHost();
    const exception = new HttpException(
      { message: ['email must be valid', 'name is required'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['email must be valid', 'name is required'],
        error: 'Bad Request',
      }),
    );
  });

  it('알 수 없는 에러는 500 Internal Server Error로 변환한다', () => {
    const { host, mockJson, mockStatus } = createMockHost();
    const exception = new Error('DB connection failed');

    filter.catch(exception, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
        error: 'Internal Server Error',
      }),
    );
  });

  it('응답에 timestamp과 path를 포함한다', () => {
    const { host, mockJson } = createMockHost('/test/path');
    const exception = new HttpException('OK', HttpStatus.OK);

    filter.catch(exception, host);

    const body = mockJson.mock.calls[0][0];
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/test/path');
  });

  it('null 예외도 500으로 처리한다', () => {
    const { host, mockJson, mockStatus } = createMockHost();

    filter.catch(null, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
      }),
    );
  });

  it('HttpException 응답이 문자열일 때 메시지와 status 코드를 사용한다', () => {
    const { host, mockJson, mockStatus } = createMockHost('/api/test');
    // When getResponse() returns a plain string (not an object), the else branch is taken
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    // Override getResponse to return a string directly
    jest.spyOn(exception, 'getResponse').mockReturnValue('Forbidden' as never);

    filter.catch(exception, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden',
        error: 'FORBIDDEN',
      }),
    );
  });

  it('객체 응답에 message 필드가 없으면 exception.message를 사용한다', () => {
    const { host, mockJson } = createMockHost();
    // Object response without a message field — triggers the ?? exception.message fallback
    const exception = new HttpException({ error: 'Bad Request' }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Http Exception',
        error: 'Bad Request',
      }),
    );
  });

  it('객체 응답에 error 필드가 없으면 HttpStatus 이름을 사용한다', () => {
    const { host, mockJson } = createMockHost();
    // Object response with message but no error field — triggers the ?? HttpStatus[statusCode] fallback
    const exception = new HttpException({ message: 'custom message' }, HttpStatus.UNPROCESSABLE_ENTITY);

    filter.catch(exception, host);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'custom message',
        error: 'UNPROCESSABLE_ENTITY',
      }),
    );
  });

  it('객체 응답에 error 필드가 없고 HttpStatus에도 없는 코드면 "Error"를 사용한다', () => {
    const { host, mockJson } = createMockHost();
    // Use a non-standard status code (999) so HttpStatus[999] is undefined → fallback to 'Error'
    const exception = new HttpException({ message: 'custom' }, HttpStatus.BAD_REQUEST);
    jest.spyOn(exception, 'getStatus').mockReturnValue(999 as never);
    jest.spyOn(exception, 'getResponse').mockReturnValue({ message: 'custom' } as never);

    filter.catch(exception, host);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'custom',
        error: 'Error',
      }),
    );
  });

  it('문자열 응답이고 HttpStatus에 없는 코드면 "Error"를 사용한다', () => {
    const { host, mockJson } = createMockHost();
    // String response + non-standard status code → else branch where HttpStatus[999] ?? 'Error' = 'Error'
    const exception = new HttpException('Something', HttpStatus.BAD_REQUEST);
    jest.spyOn(exception, 'getStatus').mockReturnValue(999 as never);
    jest.spyOn(exception, 'getResponse').mockReturnValue('Something' as never);

    filter.catch(exception, host);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 999,
        message: 'Something',
        error: 'Error',
      }),
    );
  });

  it('스택 없는 알 수 없는 예외도 500으로 처리한다', () => {
    const { host, mockStatus } = createMockHost();
    // Non-Error object (no message/stack properties)
    filter.catch({ code: 'ECONNREFUSED' }, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
