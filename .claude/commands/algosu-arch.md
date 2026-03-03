AlgoSu MSA 아키텍처 설계 문서를 읽고 관련 질문에 답하거나 작업을 수행합니다.

기본 문서: /root/AlgoSu/plan/Project Plan/AlgoSu_MSA_Architecture_v3.md
Oracle 결정 v1.1: /root/AlgoSu/plan/추가사항 문서/AlgoSu_Oracle_Decisions_Update_v1.1.md
Oracle 결정 v1.2: /root/AlgoSu/plan/추가사항 문서/AlgoSu_Oracle_Decisions_Update_v1.2.md

이 문서들을 참조하여 다음 내용을 도와주세요:
- 마이크로서비스 설계 및 구조
- Saga Orchestration 패턴
- 인프라 및 기술 스택 결정
- 신뢰성 설계 (Circuit Breaker, DLQ 등)
- CI/CD 파이프라인
- DB 이행 전략 (Dual Write, Expand-Contract)
- 페인포인트 해결 방안

### v1.1+v1.2 핵심 변경사항
- **다중 스터디 지원** (studies/study_members/study_invites 테이블, X-Study-ID 헤더)
- **X-User-Role 폐기** → study_members 캐시 기반 권한
- **스터디별 GitHub 레포** (studies.github_repo, SKIPPED 상태)
- **Custom Auth** (Supabase Auth 미사용, Google/Naver/Kakao/GitHub OAuth 직접 연동)
- **GitHub 2단계 연동** (1차 소셜 로그인 → 2차 GitHub 필수)

### 모니터링 로그 규칙
- 모니터링 로그 규칙: `/root/AlgoSu/docs/monitoring-log-rules.md`

사용자의 요청: $ARGUMENTS
