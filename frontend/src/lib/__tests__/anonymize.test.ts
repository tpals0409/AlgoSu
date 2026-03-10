import { getAnonymousName, shouldShowRealName } from '@/lib/anonymize';

describe('anonymize', () => {
  describe('getAnonymousName', () => {
    it('returns a string with adjective + noun format', () => {
      const name = getAnonymousName('user-1', 'token-abc');
      // Korean adjective + space + Korean noun
      expect(name).toMatch(/^.+ .+$/);
    });

    it('returns the same name for the same userId + token pair', () => {
      const a = getAnonymousName('user-1', 'token-abc');
      const b = getAnonymousName('user-1', 'token-abc');
      expect(a).toBe(b);
    });

    it('returns a different name when userId differs', () => {
      const a = getAnonymousName('user-1', 'token-abc');
      const b = getAnonymousName('user-2', 'token-abc');
      // Not guaranteed by spec but extremely likely with djb2
      expect(a).not.toBe(b);
    });

    it('returns a different name when token differs (same user gets different nick per study)', () => {
      const a = getAnonymousName('user-1', 'token-abc');
      const b = getAnonymousName('user-1', 'token-xyz');
      expect(a).not.toBe(b);
    });

    it('handles empty strings without throwing', () => {
      expect(() => getAnonymousName('', '')).not.toThrow();
      const name = getAnonymousName('', '');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('handles very long input strings', () => {
      const longId = 'a'.repeat(10_000);
      const longToken = 'b'.repeat(10_000);
      expect(() => getAnonymousName(longId, longToken)).not.toThrow();
      const name = getAnonymousName(longId, longToken);
      expect(name).toMatch(/^.+ .+$/);
    });

    it('handles special characters in userId and token', () => {
      const name = getAnonymousName('user/1@#$', 'tok:en&=!');
      expect(name).toMatch(/^.+ .+$/);
    });

    it('handles unicode input', () => {
      const name = getAnonymousName('유저-1', '토큰-abc');
      expect(name).toMatch(/^.+ .+$/);
    });

    it('produces names from the known adjective/noun pools', () => {
      const adjectives = [
        '용감한', '빠른', '조용한', '밝은', '슬기로운',
        '든든한', '재빠른', '꼼꼼한', '활기찬', '차분한',
      ];
      const nouns = [
        '탐험가', '항해사', '설계자', '개척자', '발명가',
        '분석가', '관찰자', '수호자', '모험가', '연구자',
      ];

      // Test multiple combinations to verify they all come from the pools
      for (let i = 0; i < 50; i++) {
        const name = getAnonymousName(`user-${i}`, `token-${i}`);
        const [adj, noun] = name.split(' ');
        expect(adjectives).toContain(adj);
        expect(nouns).toContain(noun);
      }
    });

    it('is deterministic across many calls', () => {
      const results: string[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(getAnonymousName('fixed-user', 'fixed-token'));
      }
      const unique = new Set(results);
      expect(unique.size).toBe(1);
    });
  });

  describe('shouldShowRealName', () => {
    it('returns true when userId matches createdByUserId', () => {
      expect(shouldShowRealName('user-1', 'user-1')).toBe(true);
    });

    it('returns false when userId does not match createdByUserId', () => {
      expect(shouldShowRealName('user-1', 'user-2')).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(shouldShowRealName('User-1', 'user-1')).toBe(false);
    });

    it('handles empty strings', () => {
      expect(shouldShowRealName('', '')).toBe(true);
      expect(shouldShowRealName('', 'user-1')).toBe(false);
      expect(shouldShowRealName('user-1', '')).toBe(false);
    });

    it('does not do loose comparison', () => {
      // Ensure strict equality, not type coercion
      expect(shouldShowRealName('1', '1')).toBe(true);
      expect(shouldShowRealName('01', '1')).toBe(false);
    });
  });
});
