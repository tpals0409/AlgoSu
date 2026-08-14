/**
 * @file       chart-registry.ts
 * @domain     blog
 * @layer      data
 * @related    src/components/blog/mermaid.tsx
 *
 * Mermaid 차트 레지스트리.
 * MDX에서 template literal prop이 컴파일 시 제거되는 문제를 우회하기 위해,
 * 차트 정의를 별도 TS 파일에 관리하고 name prop으로 참조합니다.
 *
 * ⚠️ 색상 동기화: 아래 classDef 의 fill/stroke/color 리터럴은
 * globals.css 의 `--chart-state-{ok,done,warn}-{fill,stroke,text}` 토큰과 동일 값으로
 * 동기화됨. mermaid 는 classDef 색상을 khroma 로 파싱·명도 계산하여 detached DOM 에서
 * SVG 를 렌더하므로(mermaid.tsx securityLevel:'strict'), `fill:var(--x)` 형태는
 * :root 컨텍스트 부재로 해석되지 않아 적용 불가 → 리터럴 유지가 SSOT 규칙.
 * 토큰 값 변경 시 이 파일도 함께 수정할 것.
 *   ok:   fill=#eeecfb stroke=#5b45c9 color=#322476
 *   done: fill=#ecfdf5 stroke=#0d9488 color=#065f46
 *   warn: fill=#fffbeb stroke=#d97706 color=#92400e
 */

export const chartRegistry: Record<string, string> = {
  'saga-state-transition': `flowchart LR
    A[DB_SAVED]:::ok --> B[GITHUB_QUEUED]:::ok
    B --> C[AI_QUEUED]:::ok
    C --> D([DONE]):::done
    B -. GitHub 실패 .-> C
    C -. AI 실패 .-> E([DONE · aiDelayed]):::warn
    B -. TOKEN_INVALID .-> F([DONE · aiSkipped]):::warn

    classDef ok fill:#eeecfb,stroke:#5b45c9,color:#322476
    classDef done fill:#ecfdf5,stroke:#0d9488,color:#065f46
    classDef warn fill:#fffbeb,stroke:#d97706,color:#92400e`,

  'saga-state-transition-en': `flowchart LR
    A[DB_SAVED]:::ok --> B[GITHUB_QUEUED]:::ok
    B --> C[AI_QUEUED]:::ok
    C --> D([DONE]):::done
    B -. GitHub failure .-> C
    C -. AI failure .-> E([DONE · aiDelayed]):::warn
    B -. TOKEN_INVALID .-> F([DONE · aiSkipped]):::warn

    classDef ok fill:#eeecfb,stroke:#5b45c9,color:#322476
    classDef done fill:#ecfdf5,stroke:#0d9488,color:#065f46
    classDef warn fill:#fffbeb,stroke:#d97706,color:#92400e`,
};
