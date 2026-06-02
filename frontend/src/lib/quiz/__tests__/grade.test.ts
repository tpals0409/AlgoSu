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
