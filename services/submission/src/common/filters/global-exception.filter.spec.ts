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

  it('HttpException에 object response지만 message 키 없으면 exception.message를 fallback으로 사용한다', () => {
    // object response without message key
    const exception = new HttpException(
      { error: 'Custom Error' }, // no "message" field
      HttpStatus.UNPROCESSABLE_ENTITY,
    );

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'Custom Error',
      }),
    );
  });

  it('HttpException에 object response의 error 키가 없으면 HttpStatus 이름을 fallback으로 사용한다', () => {
    const exception = new HttpException(
      { message: 'some message' }, // no "error" field
      HttpStatus.FORBIDDEN,
    );

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'some message',
      }),
    );
  });

  it('HttpException의 string response는 message와 error를 HttpStatus로 채운다', () => {
    // string response (not an object) — else branch at line 49-51
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden',
      }),
    );
  });

  it('HttpException response가 null이면 else 분기(string response)로 처리한다', () => {
    // typeof null === 'object' 이지만 null !== null 조건 실패 → else 분기
    // getResponse()가 null을 반환하는 HttpException을 시뮬레이션
    const exception = new HttpException('', HttpStatus.BAD_REQUEST);
    jest.spyOn(exception, 'getResponse').mockReturnValue(null as unknown as string);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
      }),
    );
  });

  it('object response에 error 키 없고 HttpStatus에 없는 statusCode이면 "Error" 폴백 사용', () => {
    // HttpStatus에 존재하지 않는 커스텀 status code → HttpStatus[statusCode]가 undefined → 'Error' 폴백
    const customStatusCode = 599; // HttpStatus enum에 없는 값
    const exception = new HttpException({ message: 'custom error' }, customStatusCode);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(customStatusCode);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: customStatusCode,
        message: 'custom error',
        error: 'Error',
      }),
    );
  });

  it('string response이고 HttpStatus에 없는 statusCode이면 else 분기에서 "Error" 폴백 사용', () => {
    // else 분기 (string response) + HttpStatus[statusCode] undefined → 'Error' 폴백
    const customStatusCode = 598;
    const exception = new HttpException('Custom Error', customStatusCode);
    // getResponse()가 string을 반환하도록 (NestJS의 string 첫 인수는 string response)
    jest.spyOn(exception, 'getResponse').mockReturnValue('Custom Error');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(customStatusCode);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: customStatusCode,
        message: 'Custom Error',
        error: 'Error',
      }),
    );
  });
});
