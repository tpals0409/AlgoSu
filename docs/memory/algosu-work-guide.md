# AlgoSu 작업 진행 가이드 요약

> 원본: `/root/AlgoSu/docs/work-progress-guide.md`

## Agent 작업 흐름
1. **수령**: Oracle이 TaskCreate → Agent가 TaskGet 확인
2. **착수**: TaskUpdate(in_progress) + `@domain` grep으로 관련 파일 파악
3. **구현**: 클린 코드 + SOLID + 어노테이션 규칙 준수
4. **자체 검증**: 빌드, 회귀, 어노테이션, 하드코딩, 민감정보, @related
5. **보고**: 변경 파일 + 검증 결과 → Oracle 검증 후 completed

## Agent 금지 사항
- 독자 아키텍처 변경 (Oracle/PM 승인 필수)
- Oracle 승인 없이 타 Agent 영역 수정
- PM 직접 소통 (Oracle 경유만)
- skill 미로드 상태 코드 작업
- 범용 Agent로 코드 작업

## Oracle 현황판 포맷
```
═══ Sprint {ID} 현황 ═══
📊 진행률: ████████░░ 8/10 (80%)
✅ 완료 / 🔄 진행 중 / ⏳ 대기 / 🚫 블로커
```

## 작업 ID: FE-/BE-/DB-/CI-/DOC-{번호}

## PM Discord 보고
- report → #work-report
- approval → #work-approval
- emergency → #emergency-alert
- oracle → #oracle-chat
- 2000자 제한, 결론 먼저, 선택지 제시

## 블로커 등급
- P1 Critical: Sprint 전체 차단 → PM 즉시 보고
- P2 High: 2+ 작업 차단 → 1시간 미해소 시 PM
- P3 Medium: 단일 작업 → Oracle 자체 해소

## TF 구성 (11명)
| Tier 1 (Opus) | Conductor, Gatekeeper, Librarian, Palette |
| Tier 2 (Sonnet) | Architect, Postman, Curator, Scribe |
| Tier 3 (Sonnet) | Herald, Sensei, Scout |

## 메모리 구조
- MEMORY.md: 200줄 제한, 자동 로드
- algosu-{토픽}.md: 상세 기억
- agent/{agent명}.md: Agent별 작업 기록 (Oracle만 수정)

## Skill 파일: `~/.claude/commands/algosu-{agent명}.md` (Oracle만 수정)
- 100줄 상한, 경로 참조만 (본문 복붙 금지)
- 7섹션 표준: 역할, 규칙참조, Sprint컨텍스트, 주의사항, 기술스택
