"""GeminiClient 단위 테스트 (5개)

Mock: google.generativeai, CircuitBreaker
unittest.mock.patch로 genai 모킹.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock


@pytest.fixture
def mock_genai():
    """google.generativeai 모킹"""
    with patch("src.gemini_client.genai") as mock:
        mock_model = MagicMock()
        mock.GenerativeModel.return_value = mock_model
        yield mock, mock_model


@pytest.fixture
def mock_circuit_breaker():
    """모듈 레벨 circuit_breaker 모킹"""
    with patch("src.gemini_client.circuit_breaker") as mock_cb:
        mock_cb.can_execute.return_value = True
        yield mock_cb


@pytest.fixture
def client(mock_genai, mock_circuit_breaker):
    """GeminiClient 인스턴스 (모든 의존성 모킹)"""
    from src.gemini_client import GeminiClient
    return GeminiClient()


class TestAnalyzeCodeSuccess:
    """1. analyze_code() -- 정상: feedback + status='completed'"""

    @pytest.mark.asyncio
    async def test_normal_analysis_returns_completed(
        self, client, mock_genai, mock_circuit_breaker
    ):
        _, mock_model = mock_genai

        # generate_content 응답 모킹
        mock_response = MagicMock()
        mock_response.text = "좋은 코드입니다. 시간복잡도는 O(n)입니다."
        mock_model.generate_content.return_value = mock_response

        result = await client.analyze_code(
            code='def solution(n): return n * 2',
            language='python',
            problem_context='두 배 반환',
        )

        assert result["status"] == "completed"
        assert result["feedback"] == "좋은 코드입니다. 시간복잡도는 O(n)입니다."
        mock_circuit_breaker.record_success.assert_called_once()


class TestAnalyzeCodeCircuitBreakerOpen:
    """2. analyze_code() -- Circuit Breaker OPEN: fallback, status='delayed'"""

    @pytest.mark.asyncio
    async def test_circuit_breaker_open_returns_delayed(
        self, client, mock_genai, mock_circuit_breaker
    ):
        mock_circuit_breaker.can_execute.return_value = False

        result = await client.analyze_code(
            code='print("hello")',
            language='python',
        )

        assert result["status"] == "delayed"
        assert "지연" in result["feedback"] or "일시적" in result["feedback"]
        # Gemini API가 호출되지 않아야 함
        _, mock_model = mock_genai
        mock_model.generate_content.assert_not_called()


class TestAnalyzeCodeApiError:
    """3. analyze_code() -- Gemini API 오류: status='failed', record_failure 호출"""

    @pytest.mark.asyncio
    async def test_api_error_returns_failed(
        self, client, mock_genai, mock_circuit_breaker
    ):
        _, mock_model = mock_genai
        mock_model.generate_content.side_effect = Exception("API rate limit exceeded")

        result = await client.analyze_code(
            code='print("hello")',
            language='python',
        )

        assert result["status"] == "failed"
        assert "오류" in result["feedback"]
        mock_circuit_breaker.record_failure.assert_called_once()


class TestBuildPrompt:
    """4. _build_prompt() -- 프롬프트 포맷: 언어, 코드, 컨텍스트 포함"""

    def test_prompt_contains_language_code_context(self, client):
        code = 'def two_sum(nums, target): pass'
        language = 'python'
        context = 'Two Sum 문제'

        prompt = client._build_prompt(code, language, context)

        assert language in prompt
        assert code in prompt
        assert context in prompt
        # 프롬프트 구조 확인
        assert "알고리즘" in prompt
        assert "시간 복잡도" in prompt
        assert "공간 복잡도" in prompt

    def test_prompt_without_context(self, client):
        prompt = client._build_prompt('x = 1', 'python', '')

        assert 'x = 1' in prompt
        assert 'python' in prompt
        # 빈 컨텍스트일 때 "문제 컨텍스트:" 가 포함되지 않아야 함
        assert "문제 컨텍스트:" not in prompt


class TestSecurityCodeLogLimit:
    """5. 보안: 코드 로그 50자 제한"""

    @pytest.mark.asyncio
    async def test_long_code_logged_with_50_char_limit(
        self, client, mock_genai, mock_circuit_breaker
    ):
        _, mock_model = mock_genai

        mock_response = MagicMock()
        mock_response.text = "분석 결과"
        mock_model.generate_content.return_value = mock_response

        long_code = "x" * 100  # 100자 코드

        with patch("src.gemini_client.logger") as mock_logger:
            result = await client.analyze_code(
                code=long_code,
                language='python',
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
