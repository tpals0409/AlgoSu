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
});
