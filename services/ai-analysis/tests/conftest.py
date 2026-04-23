"""
ai-analysis 테스트 공통 설정

@file pytest conftest — 테스트 환경 변수 사전 초기화
@domain ai
@layer test
@related Settings (src/config.py)

주의: 이 파일은 pytest가 테스트 모듈을 임포트하기 전에 실행된다.
      src.config.Settings.internal_api_key는 기본값이 없는 필수 필드이므로,
      INTERNAL_API_KEY 환경변수를 여기서 미리 설정해야 Settings() 인스턴스화가 성공한다.
      개별 테스트에서 다른 값을 테스트할 때는 monkeypatch.setenv / delenv 를 사용한다.
"""

import os

# 테스트 전용 더미 키 — 실제 키 절대 사용 금지
os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key-for-pytest-only")
