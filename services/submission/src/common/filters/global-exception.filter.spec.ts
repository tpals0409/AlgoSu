import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGetRequest: jest.Mock;
  let mockGetResponse: jest.Mock;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    // stdout.write mock (로그 억제)
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    filter = new GlobalExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockGetRequest = jest.fn().mockReturnValue({ url: '/test-path' });
    mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    mockHost = {
      switchToHttp: () => ({
        getRequest: mockGetRequest,
        getResponse: mockGetResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('HttpException을 올바른 상태코드와 메시지로 변환한다', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not Found',
        path: '/test-path',
      }),
    );
  });

  it('ValidationPipe 에러 (object response)를 처리한다', () => {
    const exception = new HttpException(
      { message: ['field must not be empty'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['field must not be empty'],
        error: 'Bad Request',
      }),
    );
  });

  it('알 수 없는 에러를 500 Internal Server Error로 변환한다', () => {
    const exception = new Error('Unknown error');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
        error: 'Internal Server Error',
      }),
    );
  });

  it('non-Error 예외도 500으로 처리한다', () => {
    filter.catch('string error', mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
      }),
    );
  });
});
