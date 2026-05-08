"""prompt 모듈 단위 테스트

build_user_prompt, build_group_user_prompt, 상수 검증
플랫폼별 맥락 주입(BOJ/PROGRAMMERS) 및 하위 호환성 포함
SQL 전용 루브릭 및 get_system_prompt 분기 검증
"""

from src.prompt import (
    ALGORITHM_WEIGHTS,
    GROUP_SQL_SYSTEM_PROMPT,
    GROUP_SYSTEM_PROMPT,
    SQL_SYSTEM_PROMPT,
    SQL_WEIGHTS,
    SYSTEM_PROMPT,
    build_group_user_prompt,
    build_user_prompt,
    get_group_system_prompt,
    get_system_prompt,
    get_weights,
)


class TestSystemPrompt:
    """SYSTEM_PROMPT 상수 검증"""

    def test_system_prompt_contains_categories(self):
        assert "correctness" in SYSTEM_PROMPT
        assert "efficiency" in SYSTEM_PROMPT
        assert "readability" in SYSTEM_PROMPT
        assert "structure" in SYSTEM_PROMPT
        assert "bestPractice" in SYSTEM_PROMPT

    def test_system_prompt_contains_json_schema(self):
        assert "totalScore" in SYSTEM_PROMPT
        assert "categories" in SYSTEM_PROMPT
        assert "optimizedCode" in SYSTEM_PROMPT

    def test_system_prompt_contains_complexity_fields(self):
        assert "timeComplexity" in SYSTEM_PROMPT
        assert "spaceComplexity" in SYSTEM_PROMPT


class TestGroupSystemPrompt:
    """GROUP_SYSTEM_PROMPT 상수 검증"""

    def test_group_system_prompt_contains_fields(self):
        assert "comparison" in GROUP_SYSTEM_PROMPT
        assert "bestApproach" in GROUP_SYSTEM_PROMPT
        assert "optimizedCode" in GROUP_SYSTEM_PROMPT
        assert "learningPoints" in GROUP_SYSTEM_PROMPT


class TestGroupSqlSystemPrompt:
    """GROUP_SQL_SYSTEM_PROMPT 상수 검증"""

    def test_contains_comparison_fields(self):
        assert "comparison" in GROUP_SQL_SYSTEM_PROMPT
        assert "bestApproach" in GROUP_SQL_SYSTEM_PROMPT
        assert "optimizedCode" in GROUP_SQL_SYSTEM_PROMPT
        assert "learningPoints" in GROUP_SQL_SYSTEM_PROMPT

    def test_contains_sql_specific_terms(self):
        assert "SQL" in GROUP_SQL_SYSTEM_PROMPT
        assert "쿼리" in GROUP_SQL_SYSTEM_PROMPT


class TestGetGroupSystemPrompt:
    """get_group_system_prompt() 분기 테스트"""

    def test_sql_returns_sql_group_prompt(self):
        assert get_group_system_prompt("sql") is GROUP_SQL_SYSTEM_PROMPT

    def test_sql_case_insensitive(self):
        assert get_group_system_prompt("SQL") is GROUP_SQL_SYSTEM_PROMPT

    def test_python_returns_default_group_prompt(self):
        assert get_group_system_prompt("python") is GROUP_SYSTEM_PROMPT

    def test_javascript_returns_default_group_prompt(self):
        assert get_group_system_prompt("javascript") is GROUP_SYSTEM_PROMPT


class TestBuildUserPromptPlatformContext:
    """build_user_prompt() 플랫폼 맥락 주입 테스트 (A4)"""

    def test_build_user_prompt_with_boj_platform(self):
        # Given: BOJ 플랫폼 식별자와 Python 코드
        # When: build_user_prompt 호출 시
        result = build_user_prompt(code="x=1", language="python", source_platform="BOJ")
        # Then: BOJ 플랫폼 맥락 문구 + 입출력 보존 명령이 포함되어야 함
        assert "백준(BOJ)" in result
        assert "절대 변경하지 마세요" in result

    def test_build_user_prompt_with_programmers_platform(self):
        # Given: PROGRAMMERS 플랫폼 식별자와 solution 함수 코드
        # When: build_user_prompt 호출 시
        result = build_user_prompt(
            code="def solution(x): return x",
            language="python",
            source_platform="PROGRAMMERS",
        )
        # Then: 프로그래머스 플랫폼 맥락 + 시그니처 보존 명령이 포함되어야 함
        assert "프로그래머스" in result
        assert "절대 변경하지 마세요" in result

    def test_build_user_prompt_without_platform_backward_compat(self):
        # Given: source_platform 미지정 (None, 기존 호출 방식)
        # When: build_user_prompt 호출 시
        result = build_user_prompt(code="x=1", language="python")
        # Then: 플랫폼 맥락 문구가 포함되지 않아야 함 (기존 동작 유지)
        assert "백준" not in result
        assert "프로그래머스" not in result
        # 기존 프롬프트 구조는 유지 (코드 블록 포함)
        assert "python" in result
        assert "x=1" in result

    def test_build_group_user_prompt_with_platform(self):
        # Given: PROGRAMMERS 플랫폼 + 복수 풀이 스니펫
        # When: build_group_user_prompt 호출 시
        snippets = [
            {
                "language": "python",
                "userId": "user-1111-aaaa",
                "code": "def solution(x): return x",
            },
            {
                "language": "python",
                "userId": "user-2222-bbbb",
                "code": "def solution(n): return n * 2",
            },
        ]
        result = build_group_user_prompt(snippets, source_platform="PROGRAMMERS")
        # Then: 프로그래머스 플랫폼 맥락 + 시그니처 보존 명령이 포함되어야 함
        assert "프로그래머스" in result
        assert "절대 변경하지 마세요" in result


class TestBuildGroupUserPrompt:
    """build_group_user_prompt() 테스트"""

    def test_single_snippet(self):
        snippets = [{"language": "python", "userId": "user-1234-5678", "code": "x = 1"}]
        result = build_group_user_prompt(snippets)
        assert "풀이 1" in result
        assert "python" in result
        assert "x = 1" in result
        assert "user-12" in result

    def test_multiple_snippets(self):
        snippets = [
            {"language": "python", "userId": "user-aaaa-bbbb", "code": "a = 1"},
            {"language": "java", "userId": "user-cccc-dddd", "code": "int b = 2;"},
        ]
        result = build_group_user_prompt(snippets)
        assert "풀이 1" in result
        assert "풀이 2" in result
        assert "---" in result

    def test_long_code_truncated_to_500(self):
        long_code = "x" * 1000
        snippets = [
            {"language": "python", "userId": "user-eeee-ffff", "code": long_code}
        ]
        result = build_group_user_prompt(snippets)
        # 코드는 500자로 잘림
        assert "x" * 500 in result
        assert "x" * 501 not in result


class TestSqlSystemPrompt:
    """SQL_SYSTEM_PROMPT 상수 검증"""

    def test_sql_system_prompt_contains_categories(self):
        """5개 카테고리 동일 이름 사용 확인"""
        assert "correctness" in SQL_SYSTEM_PROMPT
        assert "efficiency" in SQL_SYSTEM_PROMPT
        assert "readability" in SQL_SYSTEM_PROMPT
        assert "structure" in SQL_SYSTEM_PROMPT
        assert "bestPractice" in SQL_SYSTEM_PROMPT

    def test_sql_system_prompt_contains_json_schema(self):
        """동일 JSON 스키마 필드 확인"""
        assert "totalScore" in SQL_SYSTEM_PROMPT
        assert "categories" in SQL_SYSTEM_PROMPT
        assert "optimizedCode" in SQL_SYSTEM_PROMPT

    def test_sql_system_prompt_contains_complexity_fields(self):
        """timeComplexity/spaceComplexity 필드 존재 확인"""
        assert "timeComplexity" in SQL_SYSTEM_PROMPT
        assert "spaceComplexity" in SQL_SYSTEM_PROMPT

    def test_sql_system_prompt_contains_sql_specific_terms(self):
        """SQL 특화 키워드 포함 확인"""
        assert "JOIN" in SQL_SYSTEM_PROMPT
        assert "CTE" in SQL_SYSTEM_PROMPT
        assert "GROUP BY" in SQL_SYSTEM_PROMPT

    def test_sql_system_prompt_weights(self):
        """SQL 가중치 확인 (correctness 40%, efficiency 15%, bestPractice 15%)"""
        assert "correctness 40%" in SQL_SYSTEM_PROMPT
        assert "efficiency 15%" in SQL_SYSTEM_PROMPT
        assert "readability 15%" in SQL_SYSTEM_PROMPT
        assert "structure 15%" in SQL_SYSTEM_PROMPT
        assert "bestPractice 15%" in SQL_SYSTEM_PROMPT

    def test_sql_system_prompt_query_execution_context(self):
        """timeComplexity/spaceComplexity가 SQL 맥락으로 재해석 확인"""
        assert "Full Table Scan" in SQL_SYSTEM_PROMPT
        assert "Index Scan" in SQL_SYSTEM_PROMPT
        assert "Using Temporary" in SQL_SYSTEM_PROMPT


class TestGetSystemPrompt:
    """get_system_prompt() 분기 테스트"""

    def test_sql_returns_sql_prompt(self):
        """sql 입력 시 SQL_SYSTEM_PROMPT 반환"""
        assert get_system_prompt("sql") is SQL_SYSTEM_PROMPT

    def test_sql_case_insensitive(self):
        """대소문자 무관하게 SQL 프롬프트 반환"""
        assert get_system_prompt("SQL") is SQL_SYSTEM_PROMPT
        assert get_system_prompt("Sql") is SQL_SYSTEM_PROMPT

    def test_python_returns_default_prompt(self):
        """python 입력 시 기본 SYSTEM_PROMPT 반환"""
        assert get_system_prompt("python") is SYSTEM_PROMPT

    def test_javascript_returns_default_prompt(self):
        """javascript 입력 시 기본 SYSTEM_PROMPT 반환"""
        assert get_system_prompt("javascript") is SYSTEM_PROMPT

    def test_java_returns_default_prompt(self):
        """java 입력 시 기본 SYSTEM_PROMPT 반환"""
        assert get_system_prompt("java") is SYSTEM_PROMPT


class TestWeights:
    """가중치 상수 및 get_weights() 테스트"""

    def test_algorithm_weights_sum_to_one(self):
        assert abs(sum(ALGORITHM_WEIGHTS.values()) - 1.0) < 1e-9

    def test_sql_weights_sum_to_one(self):
        assert abs(sum(SQL_WEIGHTS.values()) - 1.0) < 1e-9

    def test_algorithm_weights_has_five_categories(self):
        assert len(ALGORITHM_WEIGHTS) == 5
        assert set(ALGORITHM_WEIGHTS.keys()) == {
            "correctness",
            "efficiency",
            "readability",
            "structure",
            "bestPractice",
        }

    def test_sql_weights_has_five_categories(self):
        assert len(SQL_WEIGHTS) == 5
        assert set(SQL_WEIGHTS.keys()) == {
            "correctness",
            "efficiency",
            "readability",
            "structure",
            "bestPractice",
        }

    def test_get_weights_sql(self):
        assert get_weights("sql") is SQL_WEIGHTS

    def test_get_weights_sql_case_insensitive(self):
        assert get_weights("SQL") is SQL_WEIGHTS

    def test_get_weights_python(self):
        assert get_weights("python") is ALGORITHM_WEIGHTS

    def test_algorithm_and_sql_weight_values(self):
        """correctness 40% 강화 후 구체 가중치 값 검증 (Sprint 143)"""
        assert ALGORITHM_WEIGHTS["correctness"] == 0.40
        assert ALGORITHM_WEIGHTS["efficiency"] == 0.20
        assert ALGORITHM_WEIGHTS["bestPractice"] == 0.10
        assert SQL_WEIGHTS["correctness"] == 0.40
        assert SQL_WEIGHTS["efficiency"] == 0.15
        assert SQL_WEIGHTS["bestPractice"] == 0.15


class TestBehaviorEquivalenceRules:
    """행동 동등성 규칙 검증 (Sprint 142)"""

    def test_system_prompt_contains_behavior_equivalence_rule(self):
        assert "행동 동등성" in SYSTEM_PROMPT
        assert "동일한 입력" in SYSTEM_PROMPT
        assert "동일한 출력" in SYSTEM_PROMPT

    def test_system_prompt_forbids_signature_change(self):
        assert "함수 시그니처" in SYSTEM_PROMPT
        assert "절대 변경하지 마세요" in SYSTEM_PROMPT

    def test_sql_system_prompt_contains_behavior_equivalence_rule(self):
        assert "행동 동등성" in SQL_SYSTEM_PROMPT
        assert "동일한 결과 집합" in SQL_SYSTEM_PROMPT

    def test_sql_system_prompt_forbids_column_change(self):
        assert "컬럼명" in SQL_SYSTEM_PROMPT
        assert "컬럼 순서" in SQL_SYSTEM_PROMPT

    def test_system_prompt_contains_optimized_code_meta_schema(self):
        assert "optimizedCodeMeta" in SYSTEM_PROMPT
        assert "signaturePreserved" in SYSTEM_PROMPT
        assert "behaviorEquivalent" in SYSTEM_PROMPT

    def test_sql_system_prompt_contains_behavior_equivalent_only(self):
        """SQL은 시그니처 개념 없으므로 signaturePreserved 미포함, behaviorEquivalent만 (Critic R4 P2)"""
        assert "optimizedCodeMeta" in SQL_SYSTEM_PROMPT
        assert "behaviorEquivalent" in SQL_SYSTEM_PROMPT
        assert "signaturePreserved" not in SQL_SYSTEM_PROMPT

    def test_correctness_rubric_separates_score_from_optimized_code(self):
        """correctness 점수는 제출된 코드만 평가 (Critic R4 P1 회귀 보호)

        optimizedCode 자가 검증은 별도 optimizedCodeMeta가 담당.
        LLM이 잘못된 optimizedCode를 제안해도 사용자 점수는 페널티 받지 않음.
        """
        assert "제출된 코드만 평가" in SYSTEM_PROMPT
        assert "자가 검증 메타로 별도 처리" in SYSTEM_PROMPT

    def test_sql_correctness_rubric_separates_score_from_optimized_code(self):
        """SQL correctness 점수도 제출된 쿼리만 평가"""
        assert "제출된 쿼리만 평가" in SQL_SYSTEM_PROMPT
        assert "자가 검증 메타로 별도 처리" in SQL_SYSTEM_PROMPT


class TestPlatformContextImperative:
    """플랫폼 컨텍스트 명령형 강화 검증 (Sprint 142)"""

    def test_programmers_forbids_signature_change(self):
        from src.prompt import _build_platform_context

        result = _build_platform_context("PROGRAMMERS")
        assert "절대 변경하지 마세요" in result
        assert "채점이 실패합니다" in result
        assert "함수명" in result

    def test_boj_forbids_io_change(self):
        from src.prompt import _build_platform_context

        result = _build_platform_context("BOJ")
        assert "절대 변경하지 마세요" in result
        assert "채점이 실패합니다" in result
        assert "표준 입력" in result
        assert "표준 출력" in result

    def test_boj_is_language_neutral(self):
        """BOJ 컨텍스트는 Python API를 하드코딩하지 않아야 함 (Critic P2-2 회귀 보호)"""
        from src.prompt import _build_platform_context

        result = _build_platform_context("BOJ")
        # Java/C++/JS BOJ 제출도 받기 위해 Python 전용 API는 명시 금지
        assert "input()" not in result
        assert "sys.stdin" not in result
        assert "print()" not in result

    def test_none_platform_returns_empty(self):
        from src.prompt import _build_platform_context

        assert _build_platform_context(None) == ""

    def test_unknown_platform_returns_empty(self):
        from src.prompt import _build_platform_context

        assert _build_platform_context("LEETCODE") == ""

    def test_programmers_sql_uses_resultset_rules(self):
        """PROGRAMMERS + sql → 결과셋 보존 규칙 (Critic R3 P2 회귀 보호)

        프로그래머스 SQL 카테고리는 함수 시그니처가 없으므로 결과 컬럼/순서 보존으로 분기.
        """
        from src.prompt import _build_platform_context

        result = _build_platform_context("PROGRAMMERS", "sql")
        assert "프로그래머스" in result
        assert "SQL 채점" in result
        assert "컬럼명" in result
        assert "컬럼 순서" in result
        # SQL에는 함수 시그니처 규칙 미주입
        assert "함수명" not in result
        assert "매개변수" not in result

    def test_programmers_sql_case_insensitive(self):
        """language='SQL' 대소문자 무관"""
        from src.prompt import _build_platform_context

        result = _build_platform_context("PROGRAMMERS", "SQL")
        assert "컬럼명" in result
        assert "함수명" not in result

    def test_programmers_python_keeps_signature_rules(self):
        """PROGRAMMERS + python → 함수 시그니처 규칙 유지 (회귀 보호)"""
        from src.prompt import _build_platform_context

        result = _build_platform_context("PROGRAMMERS", "python")
        assert "함수명" in result
        assert "매개변수" in result
        # 알고리즘 분기에는 SQL 컬럼 규칙 미주입
        assert "컬럼명" not in result

    def test_programmers_default_language_keeps_signature_rules(self):
        """PROGRAMMERS, language 미지정 → 기본 함수 시그니처 규칙 (하위 호환)"""
        from src.prompt import _build_platform_context

        result = _build_platform_context("PROGRAMMERS")
        assert "함수명" in result
