#!/usr/bin/env node
/**
 * @file  scripts/translate-adr.mjs
 * @domain  ci / docs
 * @layer  script
 * @related docs/adr-en/README.md, scripts/check-adr-en-coverage.mjs, blog/src/lib/adr/loader.ts
 *
 * AlgoSu ADR Claude API 기반 한국어 → 영문 자동 번역기.
 *
 * 입력: docs/adr/**\/*.md
 * 출력: docs/adr-en/<same-relative-path>
 *
 * 정책
 * - frontmatter: `title`만 영문화, 나머지 키(sprint/date/status/agents/related_adrs/...)는 보존
 * - 본문: 기술 용어 영문 유지(Outbox/Saga/Gateway/Identity/Submission 등), 코드/링크/표 데이터 보존
 * - 마크다운 구조(헤더 레벨, 리스트, 표) 그대로 유지
 *
 * 사용법
 *   node scripts/translate-adr.mjs --target docs/adr/ADR-001-*.md
 *   node scripts/translate-adr.mjs --all
 *   node scripts/translate-adr.mjs --dry-run --target <path>
 *   node scripts/translate-adr.mjs --force --target <path>
 *
 * exit
 *   0: 성공
 *   1: 인자 오류 / API 호출 실패 / write 실패
 *   2: ANTHROPIC_API_KEY 미설정
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(import.meta.dirname, '..');
const KR_BASE = resolve(ROOT, 'docs', 'adr');
const EN_BASE = resolve(ROOT, 'docs', 'adr-en');

/** Claude API 호출에 사용할 모델 ID */
const MODEL_ID = 'claude-opus-4-7';

/** 직접 실행 여부 (entry point guard) */
const __selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] === __selfPath) {
  runMain().catch((err) => {
    console.error(`[FAIL] ${err.message}`);
    process.exit(1);
  });
}

// ──────────────────────────────────────────────────────────────────
// CLI entry point
// ──────────────────────────────────────────────────────────────────

/**
 * CLI 인자를 파싱하여 액션을 분기한다.
 *
 * @returns {Promise<void>}
 */
async function runMain() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  /* ANTHROPIC_API_KEY 사전 검증 (dry-run 제외) */
  if (!args.dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error('[FAIL] ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
    console.error('       export ANTHROPIC_API_KEY=sk-ant-... 후 다시 실행하세요.');
    console.error('       토큰 비용 계산만 필요하면 --dry-run 옵션을 사용하세요.');
    process.exit(2);
  }

  /* 대상 ADR 파일 목록 결정 */
  const targets = args.all ? collectAllKrAdrs() : [resolveTarget(args.target)];

  if (targets.length === 0) {
    console.log('[INFO] 번역할 ADR이 없습니다 (--all: 모든 ADR이 이미 번역됨).');
    process.exit(0);
  }

  console.log(`[INFO] ${targets.length}개 ADR 번역 ${args.dryRun ? '시뮬레이션' : '실행'}`);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const krPath of targets) {
    const relPath = relative(KR_BASE, krPath);
    const enPath = join(EN_BASE, relPath);

    if (!args.force && !args.all && existsSync(enPath)) {
      console.log(`[SKIP] ${relPath} — 이미 번역됨 (--force 로 덮어쓰기)`);
      skip++;
      continue;
    }

    try {
      const krRaw = readFileSync(krPath, 'utf-8');

      if (args.dryRun) {
        const tokenEstimate = estimateTokens(krRaw);
        console.log(`[DRY ] ${relPath} — 입력 약 ${tokenEstimate} tokens`);
        ok++;
        continue;
      }

      const enRaw = await translateAdr(krRaw, relPath);

      mkdirSync(dirname(enPath), { recursive: true });
      writeFileSync(enPath, enRaw, 'utf-8');

      const inTok = estimateTokens(krRaw);
      const outTok = estimateTokens(enRaw);
      console.log(`[OK]   ${relPath} → docs/adr-en/${relPath} (${inTok} → ${outTok} tokens)`);
      ok++;
    } catch (err) {
      console.error(`[FAIL] ${relPath} — ${err.message}`);
      fail++;
    }
  }

  console.log(`[INFO] 완료: ok=${ok}, skip=${skip}, fail=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

/**
 * 사용법을 표준출력에 출력한다.
 */
function printUsage() {
  console.log(`사용법:
  node scripts/translate-adr.mjs --target <path>     # 단일 ADR 번역
  node scripts/translate-adr.mjs --all               # 미번역 KR ADR 전체 번역
  node scripts/translate-adr.mjs --dry-run --target <path>  # 토큰만 추정 (API 호출 X)
  node scripts/translate-adr.mjs --force --target <path>    # 기존 영문판 덮어쓰기

환경변수:
  ANTHROPIC_API_KEY  Claude API 키 (필수, --dry-run 제외)
`);
}

// ──────────────────────────────────────────────────────────────────
// CLI argument parsing
// ──────────────────────────────────────────────────────────────────

/**
 * argv에서 CLI 옵션을 파싱한다.
 *
 * @param {string[]} argv  process.argv.slice(2)
 * @returns {{target?:string, all:boolean, dryRun:boolean, force:boolean, help:boolean}}
 */
export function parseArgs(argv) {
  const result = { all: false, dryRun: false, force: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--help' || token === '-h') {
      result.help = true;
    } else if (token === '--all') {
      result.all = true;
    } else if (token === '--dry-run') {
      result.dryRun = true;
    } else if (token === '--force') {
      result.force = true;
    } else if (token === '--target') {
      result.target = argv[++i];
    } else {
      throw new Error(`알 수 없는 옵션: ${token}`);
    }
  }

  if (!result.help && !result.all && !result.target) {
    throw new Error('--target <path> 또는 --all 옵션 중 하나가 필요합니다.');
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────
// Target resolution
// ──────────────────────────────────────────────────────────────────

/**
 * --target 인자를 절대 경로로 해석한다.
 *
 * @param {string} input  사용자 입력 경로
 * @returns {string} ADR KR 파일 절대 경로
 */
export function resolveTarget(input) {
  const abs = isAbsolute(input) ? input : resolve(ROOT, input);
  if (!existsSync(abs)) throw new Error(`target 파일이 존재하지 않습니다: ${input}`);
  if (!abs.startsWith(KR_BASE)) {
    throw new Error(`target은 docs/adr/ 하위여야 합니다: ${input}`);
  }
  return abs;
}

/**
 * docs/adr/ 하위 .md 파일 중 docs/adr-en/에 영문판이 없는 항목만 수집한다.
 *
 * @returns {string[]} KR 파일 절대 경로 배열
 */
export function collectAllKrAdrs() {
  const all = [];
  collectMdRecursive(KR_BASE, all);

  /* README.md 제외 + 영문판 미존재 항목만 */
  return all
    .filter((p) => !p.endsWith('README.md'))
    .filter((p) => {
      const rel = relative(KR_BASE, p);
      return !existsSync(join(EN_BASE, rel));
    });
}

/**
 * 디렉토리를 재귀 순회하며 .md 파일을 수집한다.
 *
 * @param {string} dir  디렉토리 절대 경로
 * @param {string[]} out  결과 배열 (mutate)
 */
function collectMdRecursive(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMdRecursive(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
}

// ──────────────────────────────────────────────────────────────────
// Translation pipeline
// ──────────────────────────────────────────────────────────────────

/**
 * 단일 ADR을 번역한다.
 *
 * @param {string} krRaw    한국어 원본 마크다운 전체 (frontmatter 포함)
 * @param {string} relPath  표시용 상대 경로 (예: 'sprints/sprint-156.md')
 * @returns {Promise<string>} 영문 마크다운 전체
 */
export async function translateAdr(krRaw, relPath) {
  /* @anthropic-ai/sdk는 blog/node_modules 우선, 없으면 ROOT */
  const sdk = loadAnthropicSdk();

  const client = new sdk.Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(krRaw, relPath);

  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = extractTextFromResponse(response);
  if (!text) throw new Error('Claude 응답에서 텍스트 블록을 찾을 수 없습니다.');

  return normalizeOutput(text);
}

/**
 * Anthropic SDK를 동적으로 로드한다.
 *
 * @returns {{ Anthropic: any }}
 */
function loadAnthropicSdk() {
  const candidates = [
    join(ROOT, 'blog', 'package.json'),
    join(ROOT, 'package.json'),
  ];

  for (const pkgPath of candidates) {
    if (!existsSync(pkgPath)) continue;
    try {
      const req = createRequire(pkgPath);
      return req('@anthropic-ai/sdk');
    } catch {
      /* 다음 후보로 */
    }
  }

  throw new Error(
    '@anthropic-ai/sdk가 설치되지 않았습니다. `cd blog && npm install @anthropic-ai/sdk` 실행 후 재시도하세요.',
  );
}

/**
 * System prompt를 구성한다.
 *
 * @returns {string}
 */
function buildSystemPrompt() {
  return `You are translating AlgoSu Architecture Decision Records (ADRs) from Korean to English.

CRITICAL RULES:
1. Technical accuracy is paramount. Translate as literally as possible while keeping the text natural English. Avoid creative paraphrasing.
2. Preserve the original Markdown structure EXACTLY: heading levels (# / ## / ###), bullet/numbered lists, blockquotes, fenced code blocks, tables, mermaid diagrams.
3. Frontmatter: translate ONLY the \`title\` value. Keep all other keys (\`sprint\`, \`date\`, \`status\`, \`agents\`, \`related_adrs\`, \`related_memory\`, etc.) and their values byte-for-byte identical, including YAML quoting style. Do not add or remove keys.
4. Technical terms stay in English: Outbox, Saga, Gateway, Identity, Submission, Problem, AI Analysis, GitHub Worker, NestJS, FastAPI, JWT, RBAC, RabbitMQ, Redis, Prometheus, Grafana, ArgoCD, k3d, k3s, TypeORM, etc.
5. Sprint references: "Sprint NN" or "Sprint NN — title" style. The slug \`sprint-NN\` (lowercase, hyphen) inside markdown links / paths / IDs MUST stay unchanged.
6. Code blocks (\`\`\`...\`\`\`): preserve the code verbatim. Only translate Korean comments inside (# … or // …); keep English comments untouched.
7. Mermaid diagrams: translate node labels (text between \`["..."]\`, \`("...")\`, \`{"..."}\` etc.) only. Preserve diagram syntax, node IDs, arrows, classDef, and any English labels.
8. Markdown tables: translate header cells and any Korean prose inside data cells. PR numbers, commit hashes, file paths, URLs, dates, and counts stay unchanged.
9. Links: \`[text](url)\` — translate \`text\`, never touch \`url\` (paths, anchors, external links).
10. Filenames, paths, branch names, commit hashes, PR numbers (\`#249\`), URLs: preserve exactly.
11. Inline code (\`...\`): preserve verbatim.

OUTPUT FORMAT:
- Return ONLY the translated Markdown document. No preamble, no explanation, no fenced wrapper.
- The first line must be either \`---\` (frontmatter start) or \`# \` (H1 heading) depending on the original.
- Preserve trailing newline if present in the source.`;
}

/**
 * User prompt를 구성한다.
 *
 * @param {string} krRaw   한국어 원본
 * @param {string} relPath 표시용 상대 경로
 * @returns {string}
 */
function buildUserPrompt(krRaw, relPath) {
  return `Translate the following Korean ADR to English. Source file: docs/adr/${relPath}

---SOURCE_START---
${krRaw}
---SOURCE_END---`;
}

/**
 * Claude API response에서 텍스트 블록을 추출한다.
 *
 * @param {any} response  Anthropic SDK 응답 객체
 * @returns {string|null}
 */
function extractTextFromResponse(response) {
  if (!response || !Array.isArray(response.content)) return null;
  const textBlocks = response.content.filter((b) => b.type === 'text');
  if (textBlocks.length === 0) return null;
  return textBlocks.map((b) => b.text).join('\n');
}

/**
 * 모델 출력에서 sentinel/펜스 등을 정리한다.
 *
 * 모델이 가끔 \`\`\`markdown ... \`\`\` 펜스로 감싸거나 sentinel을 따라 출력하는 경우 제거한다.
 *
 * @param {string} text  raw 출력
 * @returns {string}
 */
export function normalizeOutput(text) {
  let out = text.trim();

  /* 시작 펜스 제거 */
  out = out.replace(/^```(?:markdown|md)?\s*\n/, '');
  /* 종료 펜스 제거 */
  out = out.replace(/\n```\s*$/, '');

  /* sentinel 누락 방지 */
  out = out.replace(/^---SOURCE_(?:START|END)---\s*\n/gm, '');

  if (!out.endsWith('\n')) out += '\n';
  return out;
}

// ──────────────────────────────────────────────────────────────────
// Token estimation
// ──────────────────────────────────────────────────────────────────

/**
 * 문자 길이 기반 token 추정 (한글 ~1.5 char/token, 영문 ~4 char/token 평균 ~2.5).
 * Anthropic 정확 tokenizer가 없어 빌드 비용 가늠용도로만 사용.
 *
 * @param {string} text  대상 문자열
 * @returns {number} 추정 토큰 수
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 2.5);
}
