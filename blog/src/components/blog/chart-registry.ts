/**
 * @file       chart-registry.ts
 * @domain     blog
 * @layer      data
 * @related    src/components/blog/mermaid.tsx
 *
 * Mermaid 차트 레지스트리.
 * MDX에서 template literal prop이 컴파일 시 제거되는 문제를 우회하기 위해,
 * 차트 정의를 별도 TS 파일에 관리하고 name prop으로 참조합니다.
 */

export const chartRegistry: Record<string, string> = {
  'saga-state-transition': `flowchart LR
    A[DB_SAVED]:::ok --> B[GITHUB_QUEUED]:::ok
    B --> C[AI_QUEUED]:::ok
    C --> D([DONE]):::done
    B -. GitHub 실패 .-> C
    C -. AI 실패 .-> E([DONE · aiDelayed]):::warn
    B -. TOKEN_INVALID .-> F([DONE · aiSkipped]):::warn

    classDef ok fill:#eef2ff,stroke:#6366f1,color:#312e81
    classDef done fill:#ecfdf5,stroke:#10b981,color:#065f46
    classDef warn fill:#fffbeb,stroke:#f59e0b,color:#92400e`,

  'saga-state-transition-en': `flowchart LR
    A[DB_SAVED]:::ok --> B[GITHUB_QUEUED]:::ok
    B --> C[AI_QUEUED]:::ok
    C --> D([DONE]):::done
    B -. GitHub failure .-> C
    C -. AI failure .-> E([DONE · aiDelayed]):::warn
    B -. TOKEN_INVALID .-> F([DONE · aiSkipped]):::warn

    classDef ok fill:#eef2ff,stroke:#6366f1,color:#312e81
    classDef done fill:#ecfdf5,stroke:#10b981,color:#065f46
    classDef warn fill:#fffbeb,stroke:#f59e0b,color:#92400e`,
};
