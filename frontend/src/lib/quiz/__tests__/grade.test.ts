/**
 * @file grade.ts 단위 테스트 — 정규화·채점 분기 집중
 * @domain quiz
 * @layer lib
 * @related src/lib/quiz/grade.ts
 */
import { gradeAnswer, normalizeAnswer } from '../grade';

describe('normalizeAnswer', () => {
  it('trims and lowercases', () => {
    expect(normalizeAnswer('  Stack  ')).toBe('stack');
  });

  it('collapses internal whitespace by removing it', () => {
    expect(normalizeAnswer('binary   search')).toBe('binarysearch');
  });

  it('strips special characters, keeping korean/latin/digits', () => {
    expect(normalizeAnswer('O(log n)!')).toBe('ologn');
  });

  it('keeps korean characters intact', () => {
    expect(normalizeAnswer(' 이진 탐색 ')).toBe('이진탐색');
  });

  it('returns empty string for special-character-only input', () => {
    expect(normalizeAnswer('!!! ???')).toBe('');
  });

  it('preserves digits', () => {
    expect(normalizeAnswer('O(1)')).toBe('o1');
  });

  it('folds full-width characters to half-width via NFKC', () => {
    // 전각 영문 대문자 → NFKC 반각 → toLowerCase
    expect(normalizeAnswer('ＳＱＬ')).toBe('sql');
    // 전각 영숫자·괄호·전각 공백 모두 폴딩 후 특수문자 제거
    expect(normalizeAnswer('Ｏ（ｌｏｇ　ｎ）')).toBe('ologn');
  });

  it('absorbs hyphen, underscore, and repeated spaces identically', () => {
    expect(normalizeAnswer('red-black tree')).toBe('redblacktree');
    expect(normalizeAnswer('red_black_tree')).toBe('redblacktree');
    expect(normalizeAnswer('red   black   tree')).toBe('redblacktree');
  });
});

describe('gradeAnswer', () => {
  const accepted = ['스택', 'stack', 'LIFO'];

  it('accepts an exact answer', () => {
    expect(gradeAnswer('스택', accepted)).toBe(true);
  });

  it('accepts a synonym answer', () => {
    expect(gradeAnswer('stack', accepted)).toBe(true);
  });

  it('ignores case when matching', () => {
    expect(gradeAnswer('Stack', accepted)).toBe(true);
    expect(gradeAnswer('lifo', accepted)).toBe(true);
  });

  it('ignores surrounding whitespace and punctuation', () => {
    expect(gradeAnswer('  stack.  ', accepted)).toBe(true);
  });

  it('rejects a wrong answer', () => {
    expect(gradeAnswer('큐', accepted)).toBe(false);
  });

  it('rejects an empty input', () => {
    expect(gradeAnswer('', accepted)).toBe(false);
  });

  it('rejects whitespace/special-only input', () => {
    expect(gradeAnswer('   !!!  ', accepted)).toBe(false);
  });

  it('returns false when acceptedAnswers is empty', () => {
    expect(gradeAnswer('stack', [])).toBe(false);
  });

  it('matches answers containing spaces after normalization', () => {
    expect(gradeAnswer('binary search', ['binarysearch', 'binary search'])).toBe(true);
  });

  it('matches full-width input against half-width accepted answers', () => {
    expect(gradeAnswer('ＳＱＬ', ['SQL'])).toBe(true);
    expect(gradeAnswer('Ｏ（ｌｏｇ　ｎ）', ['O(log n)'])).toBe(true);
  });

  it('matches hyphen/underscore/spaced variants of the same answer', () => {
    const rbTree = ['red black tree', 'redblacktree'];
    expect(gradeAnswer('red-black tree', rbTree)).toBe(true);
    expect(gradeAnswer('red_black_tree', rbTree)).toBe(true);
    expect(gradeAnswer('red   black   tree', rbTree)).toBe(true);
  });
});

// ─── Wave B: 채점 엣지케이스 회귀 보강 (Sprint 218) ───────────────────────────

describe('normalizeAnswer — Wave B: 공백류·한영혼용·전각숫자', () => {
  it('treats tab and newline as whitespace — same removal as space', () => {
    // Gap: 기존 테스트는 space·hyphen·underscore만 커버; tab·newline 공백류 미검증
    expect(normalizeAnswer('tcp\tprotocol')).toBe('tcpprotocol');
    expect(normalizeAnswer('tcp\nprotocol')).toBe('tcpprotocol');
    expect(normalizeAnswer('\t\n\r')).toBe('');
  });

  it('normalizes Korean-English mixed answers', () => {
    // Gap: 기존 테스트는 순수 한글 또는 순수 영문만 커버; 한·영 혼용 조합 미검증
    expect(normalizeAnswer('TCP 프로토콜')).toBe('tcp프로토콜');
    expect(normalizeAnswer('IPv4 주소')).toBe('ipv4주소');
  });

  it('folds full-width digits to half-width via NFKC', () => {
    // Gap: 기존 NFKC 테스트는 전각 영문자(ＳＱＬ)·기호만 커버; 전각 숫자(２)·혼용(ＩＰｖ４) 미검증
    expect(normalizeAnswer('２의보수')).toBe('2의보수');
    expect(normalizeAnswer('ＩＰｖ４')).toBe('ipv4');
  });

  it('preserves digits combined with Korean characters', () => {
    // Gap: 기존 digits 테스트는 O(1)→o1(ASCII 혼용)만 커버; 한글+숫자 조합 미검증
    expect(normalizeAnswer('2의보수')).toBe('2의보수');
    expect(normalizeAnswer('base64인코딩')).toBe('base64인코딩');
  });
});

describe('gradeAnswer — Wave B: 한영혼용·공백류 입력', () => {
  it('matches Korean-English mixed input against acceptedAnswers', () => {
    // Gap: 기존 테스트는 순수 한글/영문 acceptedAnswers만 검증; 한·영 혼용 미검증
    const accepted = ['TCP 프로토콜', 'Transmission Control Protocol'];
    expect(gradeAnswer('TCP 프로토콜', accepted)).toBe(true);
    expect(gradeAnswer('tcp프로토콜', accepted)).toBe(true); // 정규화 후 동일 키
    expect(gradeAnswer('UDP 프로토콜', accepted)).toBe(false);
  });

  it('rejects tab/newline-only input as effectively empty after normalization', () => {
    // Gap: 기존 공백류 reject 테스트는 space 단독만 다룸; tab·newline 단독 입력 분기 미검증
    expect(gradeAnswer('\t\n', ['stack'])).toBe(false);
  });

  it('matches answer with surrounding tab/newline whitespace stripped', () => {
    // Gap: 앞뒤 tab·newline이 strip된 뒤 정규화 매칭되는지 미검증
    expect(gradeAnswer('\t스택\n', ['스택'])).toBe(true);
  });

  it('grades numbers combined with Korean correctly', () => {
    // Gap: 기존 테스트는 숫자+한글 gradeAnswer 매칭을 명시 검증하지 않음
    expect(gradeAnswer('2의보수', ['2의보수'])).toBe(true);
    expect(gradeAnswer(' 2의 보수 ', ['2의보수'])).toBe(true); // 공백 정규화 후 동일 키
    expect(gradeAnswer('이의보수', ['2의보수'])).toBe(false); // 한글 '이' ≠ 숫자 '2'
  });
});
