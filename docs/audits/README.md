---
type: index
domain: docs/audits
---
# 감사 산출물 (Audits)

전수 감사(audit) 자동화의 산출물을 sprint 단위로 보관한다.

## 디렉토리 구조

```
docs/audits/
├─ README.md           ← 본 문서 (보존 정책 SSOT)
└─ sprint-{NN}/        ← sprint별 감사 산출물
   ├─ README.md        ← 종합 대시보드 (서비스별 LOC/findings 집계)
   └─ {service}.md     ← 서비스별 정리본 (frontmatter + finding 표)
```

## 보존 정책

- **정리본 `.md`**: **영구 보존**. sprint 회고 / 후속 백로그 / 컨벤션 진화 근거로 활용
- **원시 `.jsonl`** (이전 `_raw/` 하위): **비보존**. 자동화 스크립트의 일회성 출력으로,
  정리본 `.md`에 모두 흡수된 후에는 git 트리에서 제거

> Sprint 153에서 `docs/audits/sprint-118/_raw/*.jsonl` 7건(260K)을 제거.
> 정리본 `.md` 7건은 그대로 보존.

## 신규 audit 추가 시

1. `docs/audits/sprint-{NN}/` 디렉토리 생성
2. 각 서비스 `{service}.md` 작성 — frontmatter에 `sprint: NN`, `service: {name}` 포함
3. `README.md`에 종합 대시보드(LOC / 파일 수 / P0/P1/P2/Low / 합계) 작성
4. 원시 `.jsonl` 출력은 **임시 파일**로 처리, 정리본 흡수 후 즉시 삭제 (`.gitignore`로 차단)

## 현재 보유 sprint

| Sprint | 서비스 수 | 종합 LOC | 종합 findings |
|--------|----------|----------|---------------|
| [sprint-118](./sprint-118/README.md) | 7 | 56,812 | 591 (P0: 17 / P1: 279 / P2: 289 / Low: 6) |

> Sprint 118은 단일 차수 전수 감사 산출물. 이후 sprint들은 회고형 ADR(`docs/adr/sprints/`)에서 변경 단위 audit 결과를 포함.
