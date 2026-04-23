"""FastAPI 엔드포인트 단위 테스트

Mock: redis, worker, circuit_breaker
httpx.AsyncClient(TestClient) 사용
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# 테스트용 UUID 상수
_TEST_PROBLEM_ID = "00000000-0000-4000-8000-000000000001"
_TEST_STUDY_ID = "00000000-0000-4000-8000-000000000002"
_TEST_USER_ID = "00000000-0000-4000-8000-000000000003"


@pytest.fixture
def mock_app_deps():
    """main.py 의존성 모킹"""
    with (
        patch("src.main.redis") as mock_redis_mod,
        patch("src.main.AIAnalysisWorker") as mock_worker_cls,
        patch("src.main.circuit_breaker") as mock_cb,
        patch("src.main.update_circuit_breaker_gauge"),
        patch("src.main.settings") as mock_settings,
    ):
        mock_settings.internal_api_key = "test-key"
        mock_settings.redis_url = "redis://localhost:6379"
        mock_settings.ai_daily_limit = 5
        mock_settings.submission_service_url = "http://submission:3003"
        mock_settings.submission_service_key = "sub-key"

        mock_cb.state.value = "CLOSED"
        mock_cb.failure_count = 0
        mock_cb.can_execute.return_value = True

        mock_redis_client = MagicMock()
        mock_redis_mod.from_url.return_value = mock_redis_client

        yield {
            "cb": mock_cb,
            "settings": mock_settings,
            "redis_client": mock_redis_client,
            "worker_cls": mock_worker_cls,
        }


@pytest.fixture
def client(mock_app_deps):
    """TestClient 생성"""
    from src.main import app

    return TestClient(app, raise_server_exceptions=False)


class TestHealth:
    """GET /health"""

    def test_health_returns_ok(self, client, mock_app_deps):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "circuit_breaker" in data


class TestCircuitBreakerStatus:
    """GET /circuit-breaker/status"""

    def test_cb_status_requires_internal_key(self, client, mock_app_deps):
        resp = client.get("/circuit-breaker/status")
        assert resp.status_code == 401

    def test_cb_status_with_valid_key(self, client, mock_app_deps):
        deps = mock_app_deps
        deps["cb"].last_failure_time = 0
        deps["cb"].half_open_successes = 0

        resp = client.get(
            "/circuit-breaker/status",
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "state" in data


class TestGetQuota:
    """GET /quota"""

    def test_quota_requires_internal_key(self, client, mock_app_deps):
        resp = client.get("/quota", params={"userId": "user-1"})
        assert resp.status_code == 401

    def test_quota_requires_user_id(self, client, mock_app_deps):
        resp = client.get(
            "/quota",
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 400

    def test_quota_returns_usage(self, client, mock_app_deps):
        deps = mock_app_deps
        deps["redis_client"].get.return_value = b"3"

        # redis_client를 main 모듈에 주입
        import src.main as main_mod

        main_mod.redis_client = deps["redis_client"]

        resp = client.get(
            "/quota",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["used"] == 3
        assert data["limit"] == 5
        assert data["remaining"] == 2


class TestCheckAndIncrementQuota:
    """POST /quota/check"""

    def test_quota_check_requires_internal_key(self, client, mock_app_deps):
        resp = client.post("/quota/check", params={"userId": "user-1"})
        assert resp.status_code == 401

    def test_quota_check_allowed(self, client, mock_app_deps):
        deps = mock_app_deps
        # Lua eval이 current 값을 직접 반환
        deps["redis_client"].eval.return_value = 2

        import src.main as main_mod

        main_mod.redis_client = deps["redis_client"]

        resp = client.post(
            "/quota/check",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["allowed"] is True
        assert data["used"] == 2

    def test_quota_check_denied_over_limit(self, client, mock_app_deps):
        deps = mock_app_deps
        deps["redis_client"].eval.return_value = 6  # limit=5, current=6

        import src.main as main_mod

        main_mod.redis_client = deps["redis_client"]

        resp = client.post(
            "/quota/check",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["allowed"] is False
        deps["redis_client"].decr.assert_called()

    def test_quota_check_sets_ttl_on_first_use(self, client, mock_app_deps):
        """첫 사용 시 Lua 스크립트가 EXPIRE를 원자적으로 처리함을 확인"""
        deps = mock_app_deps
        # Lua 스크립트가 current=1 반환 → 스크립트 내부에서 EXPIRE 처리
        deps["redis_client"].eval.return_value = 1

        import src.main as main_mod

        main_mod.redis_client = deps["redis_client"]

        resp = client.post(
            "/quota/check",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        # eval 호출 시 TTL=86400이 인수로 포함되었는지 확인
        call_args = deps["redis_client"].eval.call_args
        assert call_args is not None
        assert 86400 in call_args.args
        # expire는 Lua 내부에서 처리되므로 별도 호출 없음
        deps["redis_client"].expire.assert_not_called()

    def test_quota_check_no_redis(self, client, mock_app_deps):
        import src.main as main_mod

        main_mod.redis_client = None

        resp = client.post(
            "/quota/check",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 503

    def test_quota_check_empty_user_id_returns_400(self, client, mock_app_deps):
        """userId가 빈 문자열이면 400 반환 (POST /quota/check)"""
        resp = client.post(
            "/quota/check",
            params={"userId": ""},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 400
        assert "userId" in resp.json()["detail"]


class TestHealthReady:
    """GET /health/ready"""

    def test_ready_no_worker_thread(self, client, mock_app_deps):
        """Worker 스레드가 없으면 503"""
        import src.main as main_mod

        main_mod.worker_thread = None
        main_mod.redis_client = mock_app_deps["redis_client"]

        resp = client.get("/health/ready")
        assert resp.status_code == 503
        assert "Worker" in resp.json()["detail"]

    def test_ready_worker_dead(self, client, mock_app_deps):
        """Worker 스레드가 죽어 있으면 503"""
        import src.main as main_mod

        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = False
        main_mod.worker_thread = mock_thread
        main_mod.redis_client = mock_app_deps["redis_client"]

        resp = client.get("/health/ready")
        assert resp.status_code == 503

    def test_ready_redis_not_initialized(self, client, mock_app_deps):
        """Redis가 초기화되지 않으면 503"""
        import src.main as main_mod

        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = True
        main_mod.worker_thread = mock_thread
        main_mod.redis_client = None

        resp = client.get("/health/ready")
        assert resp.status_code == 503
        assert "Redis" in resp.json()["detail"]

    def test_ready_redis_ping_fails(self, client, mock_app_deps):
        """Redis ping 실패 시 503"""
        import src.main as main_mod

        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = True
        main_mod.worker_thread = mock_thread

        mock_redis = MagicMock()
        mock_redis.ping.side_effect = Exception("Connection refused")
        main_mod.redis_client = mock_redis

        resp = client.get("/health/ready")
        assert resp.status_code == 503
        assert "Redis" in resp.json()["detail"]

    def test_ready_all_ok(self, client, mock_app_deps):
        """모든 조건 충족 시 200"""
        import src.main as main_mod

        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = True
        main_mod.worker_thread = mock_thread
        main_mod.redis_client = mock_app_deps["redis_client"]

        resp = client.get("/health/ready")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestGroupAnalysis:
    """POST /group-analysis"""

    def test_group_analysis_requires_internal_key(self, client, mock_app_deps):
        """Internal Key 없으면 401"""
        resp = client.post(
            "/group-analysis",
            json={"problem_id": _TEST_PROBLEM_ID, "study_id": _TEST_STUDY_ID, "user_id": _TEST_USER_ID},
        )
        assert resp.status_code == 401

    @pytest.mark.parametrize(
        "bad_payload",
        [
            {"problem_id": "../../admin", "study_id": _TEST_STUDY_ID, "user_id": _TEST_USER_ID},
            {"problem_id": _TEST_PROBLEM_ID, "study_id": "not-a-uuid", "user_id": _TEST_USER_ID},
            {"problem_id": _TEST_PROBLEM_ID, "study_id": _TEST_STUDY_ID, "user_id": "abc"},
        ],
        ids=["path-traversal-problem_id", "invalid-study_id", "invalid-user_id"],
    )
    def test_group_analysis_rejects_non_uuid_ids(
        self, bad_payload, client, mock_app_deps
    ):
        """UUID 형식이 아닌 ID는 422 — 경로 삽입 방지"""
        resp = client.post(
            "/group-analysis",
            json=bad_payload,
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 422

    def test_group_analysis_circuit_breaker_open(self, client, mock_app_deps):
        """Circuit Breaker OPEN이면 503"""
        mock_app_deps["cb"].can_execute.return_value = False

        resp = client.post(
            "/group-analysis",
            json={"problem_id": _TEST_PROBLEM_ID, "study_id": _TEST_STUDY_ID, "user_id": _TEST_USER_ID},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 503

    def test_group_analysis_no_redis(self, client, mock_app_deps):
        """Redis 미연결 시 503"""
        import src.main as main_mod

        main_mod.redis_client = None

        resp = client.post(
            "/group-analysis",
            json={"problem_id": _TEST_PROBLEM_ID, "study_id": _TEST_STUDY_ID, "user_id": _TEST_USER_ID},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 503

    def test_group_analysis_quota_exceeded(self, client, mock_app_deps):
        """Quota 초과 시 429"""
        import src.main as main_mod

        deps = mock_app_deps
        deps["redis_client"].eval.return_value = 6  # limit=5, current=6
        main_mod.redis_client = deps["redis_client"]

        resp = client.post(
            "/group-analysis",
            json={"problem_id": _TEST_PROBLEM_ID, "study_id": _TEST_STUDY_ID, "user_id": _TEST_USER_ID},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 429
        deps["redis_client"].decr.assert_called()

    @patch("src.main.httpx")
    def test_group_analysis_submission_fetch_error(
        self, mock_httpx, client, mock_app_deps
    ):
        """제출 조회 실패 시 502"""
        import src.main as main_mod

        deps = mock_app_deps
        deps["redis_client"].eval.return_value = 1
        main_mod.redis_client = deps["redis_client"]

        # AsyncClient mock이 예외 발생
        mock_async_client = AsyncMock()
        mock_async_client.get.side_effect = Exception("connection error")
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx.AsyncClient.return_value = mock_async_client

        resp = client.post(
            "/group-analysis",
            json={"problem_id": _TEST_PROBLEM_ID, "study_id": _TEST_STUDY_ID, "user_id": _TEST_USER_ID},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 502

    @patch("src.main.ClaudeClient")
    @patch("src.main.httpx")
    def test_group_analysis_no_submissions(
        self, mock_httpx, mock_claude_cls, client, mock_app_deps
    ):
        """제출이 없으면 404"""
        import src.main as main_mod

        deps = mock_app_deps
        deps["redis_client"].eval.return_value = 1
        main_mod.redis_client = deps["redis_client"]

        # 빈 제출 목록 -- httpx.AsyncClient 응답은 MagicMock 사용 (json()이 동기)
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"data": []}
        mock_resp.raise_for_status = MagicMock()

        mock_async_client = MagicMock()
        mock_async_client.get = AsyncMock(return_value=mock_resp)
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx.AsyncClient.return_value = mock_async_client

        resp = client.post(
            "/group-analysis",
            json={"problem_id": _TEST_PROBLEM_ID, "study_id": _TEST_STUDY_ID, "user_id": _TEST_USER_ID},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 404

    @patch("src.main.ClaudeClient")
    @patch("src.main.httpx")
    def test_group_analysis_success(
        self, mock_httpx, mock_claude_cls, client, mock_app_deps
    ):
        """정상 그룹 분석"""
        import src.main as main_mod

        deps = mock_app_deps
        deps["redis_client"].eval.return_value = 1
        main_mod.redis_client = deps["redis_client"]

        # 제출 목록 -- json()은 동기 메서드이므로 MagicMock 사용
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": [
                {"language": "python", "userId": "u1", "code": "def sol(): pass"},
            ]
        }
        mock_resp.raise_for_status = MagicMock()

        mock_async_client = MagicMock()
        mock_async_client.get = AsyncMock(return_value=mock_resp)
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx.AsyncClient.return_value = mock_async_client

        # Claude 모킹
        mock_claude = MagicMock()
        mock_message = MagicMock()
        mock_message.content = [
            MagicMock(text='{"totalScore": 80, "summary": "Good", "categories": []}')
        ]
        mock_claude.client.messages.create.return_value = mock_message
        mock_claude._parse_response.return_value = {
            "feedback": "Good",
            "optimized_code": None,
            "score": 80,
            "status": "completed",
        }
        mock_claude_cls.return_value = mock_claude

        resp = client.post(
            "/group-analysis",
            json={"problem_id": _TEST_PROBLEM_ID, "study_id": _TEST_STUDY_ID, "user_id": _TEST_USER_ID},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["problemId"] == _TEST_PROBLEM_ID
        assert data["submissionCount"] == 1

    @patch("src.main.ClaudeClient")
    @patch("src.main.httpx")
    def test_group_analysis_claude_error(
        self, mock_httpx, mock_claude_cls, client, mock_app_deps
    ):
        """Claude API 실패 시 502"""
        import src.main as main_mod

        deps = mock_app_deps
        deps["redis_client"].eval.return_value = 1
        main_mod.redis_client = deps["redis_client"]

        # 제출 목록
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": [
                {"language": "python", "userId": "u1", "code": "pass"},
            ]
        }
        mock_resp.raise_for_status = MagicMock()

        mock_async_client = MagicMock()
        mock_async_client.get = AsyncMock(return_value=mock_resp)
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx.AsyncClient.return_value = mock_async_client

        # Claude 호출에서 예외 발생
        mock_claude = MagicMock()
        mock_claude.client.messages.create.side_effect = Exception("API error")
        mock_claude_cls.return_value = mock_claude

        resp = client.post(
            "/group-analysis",
            json={"problem_id": _TEST_PROBLEM_ID, "study_id": _TEST_STUDY_ID, "user_id": _TEST_USER_ID},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 502

    def test_group_analysis_first_use_sets_ttl(self, client, mock_app_deps):
        """첫 사용 시 Lua 스크립트가 EXPIRE를 원자적으로 처리함을 확인"""
        import src.main as main_mod

        deps = mock_app_deps
        # Lua eval이 current=1 반환 → 스크립트 내부에서 EXPIRE 원자 처리
        deps["redis_client"].eval.return_value = 1
        main_mod.redis_client = deps["redis_client"]

        with patch("src.main.httpx") as mock_httpx:
            mock_async_client = AsyncMock()
            mock_async_client.get.side_effect = Exception("conn error")
            mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
            mock_async_client.__aexit__ = AsyncMock(return_value=False)
            mock_httpx.AsyncClient.return_value = mock_async_client

            client.post(
                "/group-analysis",
                json={"problem_id": _TEST_PROBLEM_ID, "study_id": _TEST_STUDY_ID, "user_id": _TEST_USER_ID},
                headers={"X-Internal-Key": "test-key"},
            )
            # eval이 호출되었고 TTL=86400이 인수로 포함됨
            deps["redis_client"].eval.assert_called_once()
            call_args = deps["redis_client"].eval.call_args
            assert 86400 in call_args.args
            # expire는 Lua 내부에서 처리되므로 별도 호출 없음
            deps["redis_client"].expire.assert_not_called()


class TestStartupShutdownEvents:
    """startup/shutdown 이벤트 처리"""

    def test_startup_initializes_worker_and_redis(self, mock_app_deps):
        """startup_event: Worker 및 Redis 초기화"""
        import src.main as main_mod

        _ = mock_app_deps

        # worker_thread/instance 초기값 확인을 위해 TestClient 생성
        # TestClient는 lifespan/on_event를 트리거하지 않으므로 직접 호출
        import asyncio

        # 기존 상태 초기화
        main_mod.worker_instance = None
        main_mod.worker_thread = None
        main_mod.redis_client = None

        asyncio.get_event_loop().run_until_complete(main_mod.startup_event())

        # Worker가 생성되었는지 확인
        assert main_mod.worker_instance is not None
        assert main_mod.worker_thread is not None
        assert main_mod.redis_client is not None

    def test_shutdown_stops_worker_and_redis(self, mock_app_deps):
        """shutdown_event: Worker 중지 및 Redis 정리"""
        import asyncio

        import src.main as main_mod

        mock_worker = MagicMock()
        mock_redis = MagicMock()
        main_mod.worker_instance = mock_worker
        main_mod.redis_client = mock_redis

        asyncio.get_event_loop().run_until_complete(main_mod.shutdown_event())

        mock_worker.stop.assert_called_once()
        mock_redis.close.assert_called_once()

    def test_shutdown_with_no_worker(self, mock_app_deps):
        """shutdown_event: Worker 없을 때도 정상"""
        import asyncio

        import src.main as main_mod

        main_mod.worker_instance = None
        mock_redis = MagicMock()
        main_mod.redis_client = mock_redis

        asyncio.get_event_loop().run_until_complete(main_mod.shutdown_event())
        mock_redis.close.assert_called_once()

    def test_shutdown_with_no_redis(self, mock_app_deps):
        """shutdown_event: Redis 없을 때도 정상"""
        import asyncio

        import src.main as main_mod

        mock_worker = MagicMock()
        main_mod.worker_instance = mock_worker
        main_mod.redis_client = None

        asyncio.get_event_loop().run_until_complete(main_mod.shutdown_event())
        mock_worker.stop.assert_called_once()


class TestGetQuotaXUserIdFallback:
    """GET /quota -- X-User-ID 헤더 fallback"""

    def test_quota_x_user_id_header_fallback(self, client, mock_app_deps):
        """userId 파라미터 없을 때 X-User-ID 헤더로 fallback"""
        deps = mock_app_deps
        deps["redis_client"].get.return_value = b"1"

        import src.main as main_mod

        main_mod.redis_client = deps["redis_client"]

        resp = client.get(
            "/quota",
            headers={"X-Internal-Key": "test-key", "X-User-ID": "user-from-header"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["used"] == 1

    def test_quota_redis_none_returns_zero(self, client, mock_app_deps):
        """Redis에 값이 없으면 used=0"""
        deps = mock_app_deps
        deps["redis_client"].get.return_value = None

        import src.main as main_mod

        main_mod.redis_client = deps["redis_client"]

        resp = client.get(
            "/quota",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["used"] == 0


class TestGetQuotaRedisNone:
    """GET /quota -- redis_client가 None인 경우 (branch 254->259)"""

    def test_quota_redis_client_none_returns_used_zero(self, client, mock_app_deps):
        """redis_client=None이면 Redis 조회 없이 used=0 반환 (branch 254->259)"""
        import src.main as main_mod

        main_mod.redis_client = None

        resp = client.get(
            "/quota",
            params={"userId": "user-no-redis"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["used"] == 0
        assert data["limit"] == 5
        assert data["remaining"] == 5


class TestRollbackQuotaRedisNone:
    """_rollback_quota() -- redis_client=None 시 즉시 반환 (line 107)"""

    def test_rollback_quota_returns_immediately_when_redis_none(self, mock_app_deps):
        """redis_client가 None이면 _rollback_quota는 아무 작업 없이 반환"""
        import src.main as main_mod

        main_mod.redis_client = None
        # 예외 없이 조용히 반환해야 함
        result = main_mod._rollback_quota("user-rollback-none")
        assert result is None


class TestLifespan:
    """lifespan context manager -- startup/shutdown 통합 (lines 144-146)"""

    def test_lifespan_triggers_startup_and_shutdown(self, mock_app_deps):
        """TestClient 컨텍스트 매니저 사용 시 lifespan startup/shutdown 실행"""
        from src.main import app

        with TestClient(app) as c:
            resp = c.get("/health")
            assert resp.status_code == 200
