/**
 * @file ParseStudyIdPipe 단위 테스트
 * @domain common
 * @layer pipe
 * @related parse-study-id.pipe.ts
 */
import { BadRequestException } from '@nestjs/common';
import { ParseStudyIdPipe } from './parse-study-id.pipe';

describe('ParseStudyIdPipe', () => {
  let pipe: ParseStudyIdPipe;

  beforeEach(() => {
    pipe = new ParseStudyIdPipe();
  });

  it('유효한 UUID v4 통과', () => {
    const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    expect(pipe.transform(uuid)).toBe(uuid);
  });

  it('undefined 입력 시 BadRequestException — 헤더 누락', () => {
    expect(() => pipe.transform(undefined as unknown as string)).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform(undefined as unknown as string)).toThrow(
      'x-study-id 헤더가 필요합니다.',
    );
  });

  it('null 입력 시 BadRequestException — 헤더 누락', () => {
    expect(() => pipe.transform(null as unknown as string)).toThrow(
      BadRequestException,
    );
  });

  it('빈 문자열 입력 시 BadRequestException — 헤더 누락', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException);
    expect(() => pipe.transform('')).toThrow('x-study-id 헤더가 필요합니다.');
  });

  it('공백 문자열 입력 시 BadRequestException — 헤더 누락', () => {
    expect(() => pipe.transform('   ')).toThrow(BadRequestException);
  });

  it('UUID 형식이 아닌 문자열 시 BadRequestException', () => {
    expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
    expect(() => pipe.transform('not-a-uuid')).toThrow(
      'x-study-id 헤더가 유효한 UUID 형식이 아닙니다.',
    );
  });

  it('UUID v1 형식은 거부 (v4만 허용)', () => {
    // v1 UUID: 첫 번째 하이픈 뒤 13번째 문자가 1
    const v1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    expect(() => pipe.transform(v1)).toThrow(BadRequestException);
  });

  it('숫자만 입력 시 BadRequestException', () => {
    expect(() => pipe.transform('12345')).toThrow(BadRequestException);
  });
});
