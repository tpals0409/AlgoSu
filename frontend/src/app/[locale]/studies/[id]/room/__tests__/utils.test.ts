/**
 * @file 스터디룸 유틸 getSagaStatus 테스트 (Issue #13)
 * @domain study
 * @layer test
 * @related utils.ts
 */

import { getSagaStatus } from '../utils';

describe('getSagaStatus (Issue #13: GitHub 동기화 실패 오표기 방지)', () => {
  it('DONE + githubSyncStatus=FAILED → 완료가 아닌 "GitHub 동기화 실패"(error)로 표기한다', () => {
    expect(getSagaStatus('DONE', 'FAILED')).toEqual({ label: 'GitHub 동기화 실패', variant: 'error' });
  });

  it('DONE + githubSyncStatus=TOKEN_INVALID → "GitHub 동기화 실패"(error)로 표기한다', () => {
    expect(getSagaStatus('DONE', 'TOKEN_INVALID')).toEqual({ label: 'GitHub 동기화 실패', variant: 'error' });
  });

  it('DONE + githubSyncStatus=SYNCED → "분석 완료"(success) 유지', () => {
    expect(getSagaStatus('DONE', 'SYNCED')).toEqual({ label: '분석 완료', variant: 'success' });
  });

  it('DONE + githubSyncStatus 미지정 → "분석 완료"(success) 회귀 보장', () => {
    expect(getSagaStatus('DONE')).toEqual({ label: '분석 완료', variant: 'success' });
  });

  it('FAILED → "실패"(error) 회귀 보장', () => {
    expect(getSagaStatus('FAILED')).toEqual({ label: '실패', variant: 'error' });
  });

  it('AI_QUEUED → "분석 중"(warning) 회귀 보장', () => {
    expect(getSagaStatus('AI_QUEUED')).toEqual({ label: '분석 중', variant: 'warning' });
  });
});
