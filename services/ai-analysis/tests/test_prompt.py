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
        """SQL 가중치 확인 (correctness 30%, efficiency 20%, bestPractice 20%)"""
        assert "correctness 30%" in SQL_SYSTEM_PROMPT
        assert "efficiency 20%" in SQL_SYSTEM_PROMPT
        assert "readability 15%" in SQL_SYSTEM_PROMPT
        assert "structure 15%" in SQL_SYSTEM_PROMPT
        assert "bestPractice 20%" in SQL_SYSTEM_PROMPT

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

    def test_sql_efficiency_differs_from_algorithm(self):
        """D4: SQL과 알고리즘의 efficiency/bestPractice 가중치가 다른지 확인"""
        assert SQL_WEIGHTS["efficiency"] == 0.20
        assert ALGORITHM_WEIGHTS["efficiency"] == 0.25
        assert SQL_WEIGHTS["bestPractice"] == 0.20
        assert ALGORITHM_WEIGHTS["bestPractice"] == 0.15


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

    def test_sql_system_prompt_contains_optimized_code_meta_schema(self):
        assert "optimizedCodeMeta" in SQL_SYSTEM_PROMPT
        assert "signaturePreserved" in SQL_SYSTEM_PROMPT
        assert "behaviorEquivalent" in SQL_SYSTEM_PROMPT

    def test_correctness_rubric_evaluates_optimized_code(self):
        assert "optimizedCode 모두 평가" in SYSTEM_PROMPT

    def test_sql_correctness_rubric_evaluates_optimized_code(self):
        assert "optimizedCode 모두 평가" in SQL_SYSTEM_PROMPT


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
        assert "입력 파싱" in result

    def test_none_platform_returns_empty(self):
        from src.prompt import _build_platform_context

        assert _build_platform_context(None) == ""

    def test_unknown_platform_returns_empty(self):
        from src.prompt import _build_platform_context

        assert _build_platform_context("LEETCODE") == ""
