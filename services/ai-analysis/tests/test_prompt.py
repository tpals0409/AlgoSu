"""prompt 모듈 단위 테스트

build_user_prompt, build_group_user_prompt, 상수 검증
"""

from src.prompt import (
    GROUP_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_group_user_prompt,
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
