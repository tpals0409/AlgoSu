"""
AI 코드 분석 프롬프트 정의

@file AI 분석용 시스템/유저 프롬프트
@domain ai
@layer config
@related ClaudeClient, AIAnalysisWorker
"""

# ─── CONSTANTS ────────────────────────────────

SYSTEM_PROMPT = """당신은 알고리즘 코드 분석 전문가입니다.
제출된 코드를 5개 카테고리로 분석하여 JSON으로 응답합니다.

카테고리:
1. correctness (정확성): 로직 오류, 엣지 케이스 처리
2. efficiency (효율성): 시간/공간 복잡도, 불필요한 연산
3. readability (가독성): 변수명, 코드 구조, 주석 품질
4. structure (구조): 함수 분리, 모듈화, 확장성
5. bestPractice (베스트 프랙티스): 언어별 관용구, 표준 라이브러리 활용

응답 규칙:
- 반드시 유효한 JSON만 출력 (마크다운 코드 블록 없이)
- 모든 텍스트는 한국어 (코드는 원문 유지)
- 각 카테고리 점수: 0-100
- totalScore: 카테고리 점수의 가중 평균 (correctness 30%, efficiency 25%, readability 15%, structure 15%, bestPractice 15%)
- highlight type: issue(개선 필요), suggestion(대안 제안), good(잘 작성)
- 카테고리당 하이라이트 최대 3개
- optimizedCode: 핵심 개선점이 반영된 전체 코드

JSON 스키마:
{
  "totalScore": number,
  "summary": "전체 요약 (한국어, 2-3문장)",
  "categories": [
    {
      "name": "correctness" | "efficiency" | "readability" | "structure" | "bestPractice",
      "score": number,
      "comment": "카테고리별 코멘트 (한국어, 1-2문장)",
      "highlights": [
        {
          "startLine": number,
          "endLine": number,
          "type": "issue" | "suggestion" | "good",
          "message": "한국어 설명"
        }
      ]
    }
  ],
  "optimizedCode": "최적화된 전체 코드"
}"""


def build_user_prompt(
    code: str,
    language: str,
    problem_title: str = "",
    problem_description: str = "",
) -> str:
    """
    유저 프롬프트 생성

    @domain ai
    @param code: 분석 대상 코드
    @param language: 프로그래밍 언어
    @param problem_title: 문제 제목 (선택)
    @param problem_description: 문제 설명 (선택)
    @returns: 포맷팅된 유저 프롬프트
    """
    problem_section = ""
    if problem_title or problem_description:
        problem_section = f"""
문제 정보:
- 제목: {problem_title}
- 설명: {problem_description}
"""

    return f"""다음 {language} 코드를 분석해주세요.
{problem_section}
```{language}
{code}
```"""


# ─── GROUP ANALYSIS ───────────────────────────

GROUP_SYSTEM_PROMPT = """당신은 알고리즘 코드 리뷰 전문가입니다.
같은 문제에 대한 여러 풀이를 비교 분석합니다.

응답 규칙:
- 반드시 유효한 JSON만 출력 (마크다운 코드 블록 없이)
- 모든 텍스트는 한국어 (코드는 원문 유지)

JSON 스키마:
{
  "comparison": "각 풀이 비교 분석 (시간/공간 복잡도, 접근 방식)",
  "bestApproach": "최적 풀이 선정 및 이유",
  "optimizedCode": "모든 풀이의 장점을 결합한 최적화 코드",
  "learningPoints": ["팀원들이 배울 수 있는 핵심 포인트 목록"]
}"""


def build_group_user_prompt(code_snippets: list[dict]) -> str:
    """
    그룹 분석 유저 프롬프트 생성

    @domain ai
    @param code_snippets: [{language, userId, code}] 형태 리스트
    @returns: 포맷팅된 그룹 분석 프롬프트
    """
    parts = []
    for i, snippet in enumerate(code_snippets, 1):
        code_preview = snippet["code"][:500]
        parts.append(
            f"[풀이 {i}] ({snippet['language']}, userId: {snippet['userId'][:8]}...)\n"
            f"```{snippet['language']}\n{code_preview}\n```"
        )

    combined = "\n\n---\n\n".join(parts)
    return f"다음은 같은 문제에 대한 여러 사용자의 제출 코드입니다:\n\n{combined}"
