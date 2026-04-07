"""ClaudeClient 단위 테스트 (6개)

Mock: anthropic, CircuitBreaker
unittest.mock.patch로 anthropic 모킹.
"""

import json
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def mock_anthropic():
    """anthropic.Anthropic 모킹"""
    with patch("src.claude_client.anthropic") as mock:
        mock_client = MagicMock()
        mock.Anthropic.return_value = mock_client
        # RateLimitError를 실제 Exception 서브클래스로 설정
        mock.RateLimitError = type("RateLimitError", (Exception,), {})
        yield mock, mock_client


@pytest.fixture
def mock_circuit_breaker():
    """모듈 레벨 circuit_breaker 모킹"""
    with patch("src.claude_client.circuit_breaker") as mock_cb:
        mock_cb.can_execute.return_value = True
        yield mock_cb


@pytest.fixture
def client(mock_anthropic, mock_circuit_breaker):
    """ClaudeClient 인스턴스 (모든 의존성 모킹)"""
    with patch("src.claude_client.settings") as mock_settings:
        mock_settings.anthropic_api_key = "test-api-key"
        from src.claude_client import ClaudeClient

        return ClaudeClient()


class TestAnalyzeCodeSuccess:
    """1. analyze_code() -- 정상: feedback + status='completed'"""

    @pytest.mark.asyncio
    async def test_normal_analysis_returns_completed(
        self, client, mock_anthropic, mock_circuit_breaker
    ):
        _, mock_client = mock_anthropic

        # messages.create 응답 모킹
        mock_content = MagicMock()
        mock_content.text = json.dumps(
            {
                "totalScore": 85,
                "summary": "좋은 코드입니다. 시간복잡도는 O(n)입니다.",
                "categories": [
                    {
                        "name": "correctness",
                        "score": 90,
                        "comment": "정확함",
                        "highlights": [],
                    },
                ],
                "optimizedCode": "def solution(n): return n * 2",
            }
        )
        mock_message = MagicMock()
        mock_message.content = [mock_content]
        mock_client.messages.create.return_value = mock_message

        result = await client.analyze_code(
            code="def solution(n): return n * 2",
            language="python",
            problem_title="두 배 반환",
        )

        assert result["status"] == "completed"
        assert result["score"] == 85
        mock_circuit_breaker.record_success.assert_called_once()


class TestAnalyzeCodeCircuitBreakerOpen:
    """2. analyze_code() -- Circuit Breaker OPEN: CircuitBreakerOpenError raise"""

    @pytest.mark.asyncio
    async def test_circuit_breaker_open_raises_error(
        self, client, mock_anthropic, mock_circuit_breaker
    ):
        from src.claude_client import CircuitBreakerOpenError

        mock_circuit_breaker.can_execute.return_value = False

        with pytest.raises(CircuitBreakerOpenError):
            await client.analyze_code(
                code='print("hello")',
                language="python",
            )

        # Claude API가 호출되지 않아야 함
        _, mock_client = mock_anthropic
        mock_client.messages.create.assert_not_called()


class TestAnalyzeCodeApiError:
    """3. analyze_code() -- Claude API 오류: status='failed', record_failure 호출"""

    @pytest.mark.asyncio
    async def test_api_error_returns_failed(
        self, client, mock_anthropic, mock_circuit_breaker
    ):
        _, mock_client = mock_anthropic
        mock_client.messages.create.side_effect = Exception("API rate limit exceeded")

        result = await client.analyze_code(
            code='print("hello")',
            language="python",
        )

        assert result["status"] == "failed"
        assert "오류" in result["feedback"]
        mock_circuit_breaker.record_failure.assert_called_once()


class TestBuildPrompt:
    """4. build_user_prompt() -- 프롬프트 포맷: 언어, 코드, 컨텍스트 포함"""

    def test_prompt_contains_language_code_context(self):
        from src.prompt import build_user_prompt

        code = "def two_sum(nums, target): pass"
        language = "python"

        prompt = build_user_prompt(
            code=code,
            language=language,
            problem_title="Two Sum 문제",
            problem_description="두 수의 합",
        )

        assert language in prompt
        assert code in prompt
        assert "Two Sum 문제" in prompt

    def test_prompt_without_context(self):
        from src.prompt import build_user_prompt

        prompt = build_user_prompt(code="x = 1", language="python")

        assert "x = 1" in prompt
        assert "python" in prompt
        # 빈 컨텍스트일 때 "문제 정보:" 가 포함되지 않아야 함
        assert "문제 정보:" not in prompt


class TestAnalyzeCodeRateLimitError:
    """6. analyze_code() -- RateLimitError: fallback 반환 + record_failure"""

    @pytest.mark.asyncio
    async def test_rate_limit_error_returns_delayed(
        self, client, mock_anthropic, mock_circuit_breaker
    ):
        mock_anthropic_mod, mock_client = mock_anthropic
        # RateLimitError를 실제 Exception 서브클래스로 만들어서 raise
        mock_client.messages.create.side_effect = mock_anthropic_mod.RateLimitError(
            "Rate limit exceeded"
        )

        result = await client.analyze_code(
            code='print("hello")',
            language="python",
        )

        assert result["status"] == "delayed"
        assert "일시적" in result["feedback"]
        mock_circuit_breaker.record_failure.assert_called_once()


class TestParseResponseMarkdown:
    """_parse_response() -- 마크다운 코드블록 파싱"""

    def test_parse_markdown_code_block(self):
        from src.claude_client import ClaudeClient

        with (
            patch("src.claude_client.anthropic"),
            patch("src.claude_client.circuit_breaker"),
            patch("src.claude_client.settings") as mock_settings,
        ):
            mock_settings.anthropic_api_key = "test-key"
            c = ClaudeClient()

        import json

        payload = json.dumps(
            {
                "totalScore": 75,
                "summary": "마크다운 블록 테스트",
                "categories": [{"name": "style", "score": 75, "comment": "ok"}],
                "optimizedCode": None,
            }
        )
        raw = f"```json\n{payload}\n```"
        result = c._parse_response(raw)
        assert result["status"] == "completed"
        assert result["score"] == 75

    def test_parse_invalid_json_returns_raw(self):
        from src.claude_client import ClaudeClient

        with (
            patch("src.claude_client.anthropic"),
            patch("src.claude_client.circuit_breaker"),
            patch("src.claude_client.settings") as mock_settings,
        ):
            mock_settings.anthropic_api_key = "test-key"
            c = ClaudeClient()

        result = c._parse_response("not valid json {{{")
        assert result["status"] == "failed"
        assert result["score"] == 0
        assert result["feedback"] == "not valid json {{{"

    def test_parse_plain_json_no_backticks(self):
        """마크다운 없이 순수 JSON 파싱"""
        from src.claude_client import ClaudeClient

        with (
            patch("src.claude_client.anthropic"),
            patch("src.claude_client.circuit_breaker"),
            patch("src.claude_client.settings") as mock_settings,
        ):
            mock_settings.anthropic_api_key = "test-key"
            c = ClaudeClient()

        import json

        payload = json.dumps(
            {
                "totalScore": 90,
                "summary": "plain json",
                "categories": [],
                "optimizedCode": "optimized",
            }
        )
        result = c._parse_response(payload)
        assert result["status"] == "completed"
        assert result["score"] == 90
        assert result["optimized_code"] == "optimized"

    def test_parse_json_with_trailing_text(self):
        """JSON 뒤에 마크다운 텍스트가 추가된 경우 첫 번째 JSON 객체만 추출"""
        from src.claude_client import ClaudeClient

        with (
            patch("src.claude_client.anthropic"),
            patch("src.claude_client.circuit_breaker"),
            patch("src.claude_client.settings") as mock_settings,
        ):
            mock_settings.anthropic_api_key = "test-key"
            c = ClaudeClient()

        import json

        payload = json.dumps(
            {
                "totalScore": 85,
                "summary": "trailing text test",
                "categories": [{"name": "logic", "score": 85, "comment": "good"}],
                "optimizedCode": None,
            }
        )
        raw = payload + "\n\n위 분석 결과를 참고하여 코드를 개선해 보세요."
        result = c._parse_response(raw)
        assert result["status"] == "completed"
        assert result["score"] == 85

    def test_parse_json_with_no_braces(self):
        """중괄호가 없는 텍스트 — fallback"""
        from src.claude_client import ClaudeClient

        with (
            patch("src.claude_client.anthropic"),
            patch("src.claude_client.circuit_breaker"),
            patch("src.claude_client.settings") as mock_settings,
        ):
            mock_settings.anthropic_api_key = "test-key"
            c = ClaudeClient()

        result = c._parse_response("no json here at all")
        assert result["status"] == "failed"
        assert result["score"] == 0

    @pytest.mark.asyncio
    async def test_empty_content_returns_completed(
        self, client, mock_anthropic, mock_circuit_breaker
    ):
        """빈 content 처리 -- raw_text='' 로 파싱 시 completed 반환"""
        _, mock_client = mock_anthropic
        mock_message = MagicMock()
        mock_message.content = []
        mock_client.messages.create.return_value = mock_message

        result = await client.analyze_code(code="x=1", language="python")
        # empty content => raw_text="" => json decode fails => fallback to failed
        assert result["status"] == "failed"

    def test_parse_broken_optimized_code_recovers(self):
        """optimizedCode 내 이스케이프 깨짐 시 필드 제거 후 재파싱"""
        from src.claude_client import ClaudeClient

        with (
            patch("src.claude_client.anthropic"),
            patch("src.claude_client.circuit_breaker"),
            patch("src.claude_client.settings") as mock_settings,
        ):
            mock_settings.anthropic_api_key = "test-key"
            c = ClaudeClient()

        # optimizedCode 내부에 이스케이프된 문자가 있지만 뒤에 깨진 부분이 있는 경우
        # regex가 optimizedCode 값을 정상적으로 매칭하여 null로 치환
        raw = '{"totalScore": 80, "summary": "good", "categories": [], "optimizedCode": "int x = 1;\\nint y = 2;"}\nextra text'
        result = c._parse_response(raw)
        assert result["status"] == "completed"
        assert result["score"] == 80

    def test_parse_fallback_extracts_total_score_via_regex(self):
        """파싱 완전 실패 시 정규식으로 totalScore 추출"""
        from src.claude_client import ClaudeClient

        with (
            patch("src.claude_client.anthropic"),
            patch("src.claude_client.circuit_breaker"),
            patch("src.claude_client.settings") as mock_settings,
        ):
            mock_settings.anthropic_api_key = "test-key"
            c = ClaudeClient()

        # 마크다운 블록 안에 깨진 JSON (totalScore는 존재)
        raw = '```json\n{"totalScore": 76, broken json +++\n```'
        result = c._parse_response(raw)
        # score 추출 성공 시 completed 처리 (JSON 파싱만 실패)
        assert result["status"] == "completed"
        assert result["score"] == 76

    def test_parse_total_score_zero_with_categories_recalculates(self):
        """totalScore=0이지만 카테고리 점수 존재 시 가중 평균 재계산"""
        import json as _json

        from src.claude_client import ClaudeClient

        with (
            patch("src.claude_client.anthropic"),
            patch("src.claude_client.circuit_breaker"),
            patch("src.claude_client.settings") as mock_settings,
        ):
            mock_settings.anthropic_api_key = "test-key"
            c = ClaudeClient()

        payload = _json.dumps(
            {
                "totalScore": 0,
                "summary": "test",
                "categories": [
                    {"name": "correctness", "score": 80, "comment": "ok"},
                    {"name": "efficiency", "score": 70, "comment": "ok"},
                    {"name": "readability", "score": 60, "comment": "ok"},
                    {"name": "structure", "score": 60, "comment": "ok"},
                    {"name": "bestPractice", "score": 60, "comment": "ok"},
                ],
                "optimizedCode": None,
            }
        )
        result = c._parse_response(payload)
        assert result["status"] == "completed"
        # 80*0.3 + 70*0.25 + 60*0.15 + 60*0.15 + 60*0.15 = 24+17.5+9+9+9 = 68.5 → 68
        assert result["score"] == 68


class TestSecurityCodeLogLimit:
    """5. 보안: 코드 로그 50자 제한"""

    @pytest.mark.asyncio
    async def test_long_code_logged_with_50_char_limit(
        self, client, mock_anthropic, mock_circuit_breaker
    ):
        _, mock_client = mock_anthropic

        mock_content = MagicMock()
        mock_content.text = json.dumps(
            {
                "totalScore": 70,
                "summary": "분석 결과",
                "categories": [],
                "optimizedCode": None,
            }
        )
        mock_message = MagicMock()
        mock_message.content = [mock_content]
        mock_client.messages.create.return_value = mock_message

        long_code = "x" * 100  # 100자 코드

        with patch("src.claude_client.logger") as mock_logger:
            result = await client.analyze_code(
                code=long_code,
                language="python",
            )

            assert result["status"] == "completed"

            # logger.info 호출에서 코드가 50자 + "..."로 제한되었는지 확인
            info_calls = mock_logger.info.call_args_list
            assert len(info_calls) > 0

            log_message = info_calls[0][0][0]
            # 원본 100자 코드가 그대로 로그에 노출되면 안 됨
            assert long_code not in log_message
            # 50자 프리뷰가 포함되어야 함
            assert "x" * 50 in log_message


# ─── GROUP ANALYSIS RESPONSE PARSING ────────────


def _make_client():
    """테스트용 ClaudeClient 인스턴스 생성 (모든 의존성 모킹)"""
    with (
        patch("src.claude_client.anthropic"),
        patch("src.claude_client.circuit_breaker"),
        patch("src.claude_client.settings") as mock_settings,
    ):
        mock_settings.anthropic_api_key = "test-key"
        from src.claude_client import ClaudeClient

        return ClaudeClient()


class TestParseGroupResponse:
    """_parse_group_response() -- 그룹 분석 전용 파싱"""

    def test_parse_valid_group_response(self):
        """정상 그룹 분석 JSON 파싱"""
        c = _make_client()

        payload = json.dumps(
            {
                "comparison": "풀이 1은 BFS, 풀이 2는 DFS를 사용했습니다.",
                "bestApproach": "풀이 1의 BFS가 최적입니다.",
                "optimizedCode": "def solution(): pass",
                "learningPoints": ["BFS vs DFS 선택 기준", "시간복잡도 분석"],
            }
        )
        result = c._parse_group_response(payload)
        assert result["status"] == "completed"
        assert "BFS" in result["comparison"]
        assert result["bestApproach"] == "풀이 1의 BFS가 최적입니다."
        assert result["optimizedCode"] == "def solution(): pass"
        assert len(result["learningPoints"]) == 2

    def test_parse_group_response_markdown_block(self):
        """마크다운 코드 블록 감싸진 그룹 응답 파싱"""
        c = _make_client()

        payload = json.dumps(
            {
                "comparison": "비교 분석 내용",
                "bestApproach": "최적 풀이",
                "optimizedCode": None,
                "learningPoints": ["포인트 1"],
            }
        )
        raw = f"```json\n{payload}\n```"
        result = c._parse_group_response(raw)
        assert result["status"] == "completed"
        assert result["comparison"] == "비교 분석 내용"

    def test_parse_group_response_missing_fields(self):
        """필수 필드 누락 시 기본값 반환"""
        c = _make_client()

        # comparison만 있는 응답
        payload = json.dumps({"comparison": "간단한 비교"})
        result = c._parse_group_response(payload)
        assert result["status"] == "completed"
        assert result["comparison"] == "간단한 비교"
        assert result["bestApproach"] == ""
        assert result["optimizedCode"] is None
        assert result["learningPoints"] == []

    def test_parse_group_response_invalid_json(self):
        """잘못된 JSON 시 fallback 반환"""
        c = _make_client()

        result = c._parse_group_response("not valid json at all")
        assert result["status"] == "failed"
        assert result["comparison"] == "not valid json at all"
        assert result["learningPoints"] == []

    def test_parse_group_response_learning_points_not_list(self):
        """learningPoints가 문자열인 경우 리스트로 보정"""
        c = _make_client()

        payload = json.dumps(
            {
                "comparison": "비교",
                "bestApproach": "최적",
                "optimizedCode": None,
                "learningPoints": "단일 포인트",
            }
        )
        result = c._parse_group_response(payload)
        assert result["status"] == "completed"
        assert result["learningPoints"] == ["단일 포인트"]

    def test_parse_group_response_with_trailing_text(self):
        """JSON 뒤에 추가 텍스트가 있는 경우 첫 번째 JSON 추출"""
        c = _make_client()

        payload = json.dumps(
            {
                "comparison": "비교 분석",
                "bestApproach": "최적",
                "optimizedCode": "code",
                "learningPoints": [],
            }
        )
        raw = payload + "\n\n추가 설명 텍스트입니다."
        result = c._parse_group_response(raw)
        assert result["status"] == "completed"
        assert result["comparison"] == "비교 분석"

    def test_parse_group_response_empty_string(self):
        """빈 문자열 입력 시 fallback"""
        c = _make_client()

        result = c._parse_group_response("")
        assert result["status"] == "failed"


class TestGroupAnalyze:
    """group_analyze() -- 그룹 분석 전체 흐름"""

    @pytest.mark.asyncio
    async def test_group_analyze_success(
        self, client, mock_anthropic, mock_circuit_breaker
    ):
        """정상 그룹 분석 호출"""
        _, mock_client = mock_anthropic

        mock_content = MagicMock()
        mock_content.text = json.dumps(
            {
                "comparison": "풀이 비교 결과",
                "bestApproach": "풀이 1이 최적",
                "optimizedCode": "def best(): pass",
                "learningPoints": ["핵심 포인트"],
            }
        )
        mock_message = MagicMock()
        mock_message.content = [mock_content]
        mock_client.messages.create.return_value = mock_message

        result = await client.group_analyze(
            [
                {
                    "language": "python",
                    "userId": "user-1234-5678",
                    "code": "def a(): pass",
                },
                {
                    "language": "python",
                    "userId": "user-8765-4321",
                    "code": "def b(): pass",
                },
            ]
        )

        assert result["status"] == "completed"
        assert result["comparison"] == "풀이 비교 결과"
        assert result["bestApproach"] == "풀이 1이 최적"
        assert result["optimizedCode"] == "def best(): pass"
        assert result["learningPoints"] == ["핵심 포인트"]
        mock_circuit_breaker.record_success.assert_called_once()

    @pytest.mark.asyncio
    async def test_group_analyze_circuit_breaker_open(
        self, client, mock_anthropic, mock_circuit_breaker
    ):
        """Circuit Breaker OPEN 시 예외 발생"""
        from src.claude_client import CircuitBreakerOpenError

        mock_circuit_breaker.can_execute.return_value = False

        with pytest.raises(CircuitBreakerOpenError):
            await client.group_analyze(
                [
                    {"language": "python", "userId": "user-1234", "code": "x = 1"},
                ]
            )

    @pytest.mark.asyncio
    async def test_group_analyze_api_error(
        self, client, mock_anthropic, mock_circuit_breaker
    ):
        """API 오류 시 fallback 반환"""
        _, mock_client = mock_anthropic
        mock_client.messages.create.side_effect = Exception("API error")

        result = await client.group_analyze(
            [
                {"language": "python", "userId": "user-1234", "code": "x = 1"},
            ]
        )

        assert result["status"] == "failed"
        assert "오류" in result["comparison"]
        mock_circuit_breaker.record_failure.assert_called_once()


class TestSharedHelpers:
    """_strip_markdown_block() / _extract_first_json_object() 공유 헬퍼"""

    def test_strip_markdown_block_no_backticks(self):
        c = _make_client()
        assert c._strip_markdown_block('{"key": "val"}') == '{"key": "val"}'

    def test_strip_markdown_block_with_backticks(self):
        c = _make_client()
        raw = '```json\n{"key": "val"}\n```'
        assert c._strip_markdown_block(raw) == '{"key": "val"}'

    def test_extract_first_json_object(self):
        c = _make_client()
        text = 'some text {"a": 1} trailing'
        result = c._extract_first_json_object(text)
        assert result == {"a": 1}

    def test_extract_first_json_object_no_brace(self):
        c = _make_client()
        with pytest.raises(json.JSONDecodeError):
            c._extract_first_json_object("no json here")
