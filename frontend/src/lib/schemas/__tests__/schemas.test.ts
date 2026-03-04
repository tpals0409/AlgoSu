import { studyCreateSchema } from '@/lib/schemas/study';
import { problemCreateSchema } from '@/lib/schemas/problem';
import { submissionSchema } from '@/lib/schemas/submission';

describe('studyCreateSchema', () => {
  it('유효한 입력을 파싱한다', () => {
    const result = studyCreateSchema.parse({
      name: '알고리즘 스터디',
      nickname: '홍길동',
    });
    expect(result.name).toBe('알고리즘 스터디');
    expect(result.nickname).toBe('홍길동');
    expect(result.description).toBeUndefined();
  });

  it('description이 있는 유효한 입력을 파싱한다', () => {
    const result = studyCreateSchema.parse({
      name: '알고리즘 스터디',
      nickname: '홍길동',
      description: '매주 3문제',
    });
    expect(result.description).toBe('매주 3문제');
  });

  it('name이 빈 문자열이면 실패한다', () => {
    const result = studyCreateSchema.safeParse({
      name: '',
      nickname: '홍길동',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('스터디 이름을 입력해주세요.');
    }
  });

  it('name이 1자이면 최소 2자 에러를 반환한다', () => {
    const result = studyCreateSchema.safeParse({
      name: 'A',
      nickname: '홍길동',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('스터디 이름은 2자 이상이어야 합니다.');
    }
  });

  it('nickname이 빈 문자열이면 실패한다', () => {
    const result = studyCreateSchema.safeParse({
      name: '알고리즘 스터디',
      nickname: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('닉네임을 입력해주세요.');
    }
  });

  it('name과 nickname의 공백을 트리밍한다', () => {
    const result = studyCreateSchema.parse({
      name: '  알고리즘 스터디  ',
      nickname: '  홍길동  ',
    });
    expect(result.name).toBe('알고리즘 스터디');
    expect(result.nickname).toBe('홍길동');
  });
});

describe('problemCreateSchema', () => {
  const validProblem = {
    title: '두 수의 합',
    weekNumber: 'W1',
    deadline: '2026-03-10',
    allowedLanguages: ['python', 'javascript'],
  };

  it('유효한 입력을 파싱한다', () => {
    const result = problemCreateSchema.parse(validProblem);
    expect(result.title).toBe('두 수의 합');
    expect(result.weekNumber).toBe('W1');
    expect(result.allowedLanguages).toEqual(['python', 'javascript']);
  });

  it('선택 필드 없이도 파싱한다', () => {
    const result = problemCreateSchema.parse({
      title: '두 수의 합',
      weekNumber: 'W1',
      deadline: '2026-03-10',
      allowedLanguages: [],
    });
    expect(result.description).toBeUndefined();
    expect(result.difficulty).toBeUndefined();
    expect(result.sourceUrl).toBeUndefined();
    expect(result.sourcePlatform).toBeUndefined();
  });

  it('title이 빈 문자열이면 실패한다', () => {
    const result = problemCreateSchema.safeParse({
      ...validProblem,
      title: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('문제 제목을 입력해주세요.');
    }
  });

  it('weekNumber가 빈 문자열이면 실패한다', () => {
    const result = problemCreateSchema.safeParse({
      ...validProblem,
      weekNumber: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('주차를 선택해주세요.');
    }
  });

  it('deadline이 빈 문자열이면 실패한다', () => {
    const result = problemCreateSchema.safeParse({
      ...validProblem,
      deadline: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('마감일을 선택해주세요.');
    }
  });

  it('allowedLanguages가 배열이 아니면 실패한다', () => {
    const result = problemCreateSchema.safeParse({
      ...validProblem,
      allowedLanguages: 'python',
    });
    expect(result.success).toBe(false);
  });

  it('선택 필드를 포함한 전체 입력을 파싱한다', () => {
    const result = problemCreateSchema.parse({
      ...validProblem,
      description: '기본 문제',
      difficulty: 'EASY',
      sourceUrl: 'https://boj.kr/1000',
      sourcePlatform: 'BOJ',
    });
    expect(result.description).toBe('기본 문제');
    expect(result.difficulty).toBe('EASY');
    expect(result.sourceUrl).toBe('https://boj.kr/1000');
    expect(result.sourcePlatform).toBe('BOJ');
  });
});

describe('submissionSchema', () => {
  const validSubmission = {
    problemId: 'prob-123',
    language: 'python',
    code: 'print("hello")',
  };

  it('유효한 입력을 파싱한다', () => {
    const result = submissionSchema.parse(validSubmission);
    expect(result.problemId).toBe('prob-123');
    expect(result.language).toBe('python');
    expect(result.code).toBe('print("hello")');
  });

  it('problemId가 빈 문자열이면 실패한다', () => {
    const result = submissionSchema.safeParse({
      ...validSubmission,
      problemId: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('문제 ID가 필요합니다.');
    }
  });

  it('language가 빈 문자열이면 실패한다', () => {
    const result = submissionSchema.safeParse({
      ...validSubmission,
      language: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('언어를 선택해주세요.');
    }
  });

  it('code가 빈 문자열이면 실패한다', () => {
    const result = submissionSchema.safeParse({
      ...validSubmission,
      code: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('코드를 입력해주세요.');
    }
  });

  it('필수 필드가 누락되면 실패한다', () => {
    const result = submissionSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
    }
  });
});
