/**
 * @file check-wcag.ts
 * @domain design-system
 * @layer script
 * @related frontend/src/app/globals.css
 *
 * WCAG AA 대비비 검증 스크립트.
 * globals.css에서 Light/Dark 모드 토큰을 정규식으로 파싱하고,
 * WCAG 2.1 상대 휘도 공식(sRGB → linear RGB → luminance)으로
 * 지정된 색상 페어의 대비비가 4.5:1 이상인지 자동 검증합니다.
 *
 * 의존성 추가 없이 자체 구현합니다.
 */

import * as fs from 'fs';
import * as path from 'path';

/* ── Types ── */

interface TokenMap {
  [key: string]: string;
}

interface ContrastPair {
  /** 전경색 토큰 이름 */
  fg: string;
  /** 배경색 토큰 이름 */
  bg: string;
  /** 설명 */
  label: string;
  /** 최소 대비비 기준 */
  threshold: number;
}

interface CheckResult {
  pair: ContrastPair;
  fgHex: string;
  bgHex: string;
  ratio: number;
  pass: boolean;
}

/* ── WCAG 2.1 상대 휘도 계산 ── */

/**
 * sRGB 채널 값(0–255)을 linear RGB로 변환합니다.
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045
    ? c / 12.92
    : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * sRGB hex 색상의 상대 휘도(relative luminance)를 계산합니다.
 * L = 0.2126·R + 0.7152·G + 0.0722·B (linear 공간)
 */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const rLin = srgbToLinear(r);
  const gLin = srgbToLinear(g);
  const bLin = srgbToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * 두 색상 간 WCAG 대비비를 계산합니다.
 * ratio = (L_lighter + 0.05) / (L_darker + 0.05)
 */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ── Hex 파싱 유틸 ── */

/**
 * #RRGGBB 또는 #RGB 형식의 hex 문자열을 RGB 객체로 변환합니다.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  }
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

/* ── CSS 파싱 ── */

/**
 * CSS 블록 내 --token: #hex; 패턴을 추출하여 TokenMap으로 반환합니다.
 */
function parseTokensFromBlock(block: string): TokenMap {
  const tokens: TokenMap = {};
  const tokenRegex = /--([\w-]+):\s*(#[0-9A-Fa-f]{3,8})\s*;/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(block)) !== null) {
    tokens[`--${match[1]}`] = match[2];
  }

  return tokens;
}

/**
 * globals.css에서 :root { ... } 블록의 내용을 추출합니다.
 */
function extractRootBlock(css: string): string {
  const rootRegex = /:root\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/;
  const match = rootRegex.exec(css);
  if (!match) {
    throw new Error(':root 블록을 찾을 수 없습니다.');
  }
  return match[1];
}

/**
 * globals.css에서 .dark { ... } 블록의 내용을 추출합니다.
 */
function extractDarkBlock(css: string): string {
  const darkRegex = /\.dark\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/;
  const match = darkRegex.exec(css);
  if (!match) {
    throw new Error('.dark 블록을 찾을 수 없습니다.');
  }
  return match[1];
}

/* ── 검증 페어 정의 ── */

const REQUIRED_TOKENS = ['--bg-alt', '--primary', '--bg-card', '--text', '--text-3'];

const CONTRAST_PAIRS: ContrastPair[] = [
  {
    fg: '--primary',
    bg: '--bg-alt',
    label: '토글 활성 텍스트 (primary on bg-alt)',
    threshold: 4.5,
  },
  {
    fg: '--primary',
    bg: '--bg-card',
    label: '카드 위 primary 텍스트 (primary on bg-card)',
    threshold: 4.5,
  },
  {
    fg: '--text',
    bg: '--bg-alt',
    label: 'bg-alt 위 일반 텍스트 (text on bg-alt)',
    threshold: 4.5,
  },
];

/* ── 메인 로직 ── */

/**
 * 지정된 토큰이 모두 존재하는지 검증합니다.
 */
function validateTokens(tokens: TokenMap, mode: string): void {
  const missing = REQUIRED_TOKENS.filter((t) => !tokens[t]);
  if (missing.length > 0) {
    throw new Error(
      `[${mode}] 필수 토큰 누락: ${missing.join(', ')}`
    );
  }
}

/**
 * 모드별 검증 페어의 대비비를 계산하고 결과를 반환합니다.
 */
function checkPairs(tokens: TokenMap, pairs: ContrastPair[]): CheckResult[] {
  return pairs.map((pair) => {
    const fgHex = tokens[pair.fg];
    const bgHex = tokens[pair.bg];
    const ratio = contrastRatio(fgHex, bgHex);

    return {
      pair,
      fgHex,
      bgHex,
      ratio: Math.round(ratio * 100) / 100,
      pass: ratio >= pair.threshold,
    };
  });
}

/**
 * 결과 테이블을 콘솔에 출력합니다.
 */
function printResults(mode: string, results: CheckResult[]): void {
  const modeLabel = mode === 'Light' ? '☀ Light Mode' : '🌙 Dark Mode';

  // eslint-disable-next-line no-console -- 스크립트 전용 출력
  console.log(`\n${'═'.repeat(60)}`);
  // eslint-disable-next-line no-console -- 스크립트 전용 출력
  console.log(`  ${modeLabel}`);
  // eslint-disable-next-line no-console -- 스크립트 전용 출력
  console.log(`${'═'.repeat(60)}`);

  // eslint-disable-next-line no-console -- 스크립트 전용 출력
  console.log(
    `  ${'Status'.padEnd(8)} ${'Ratio'.padEnd(10)} ${'FG'.padEnd(10)} ${'BG'.padEnd(10)} Label`
  );
  // eslint-disable-next-line no-console -- 스크립트 전용 출력
  console.log(`  ${'─'.repeat(56)}`);

  for (const result of results) {
    const status = result.pass ? '[PASS]' : '[FAIL]';
    const ratio = `${result.ratio.toFixed(2)}:1`;
    const line = `  ${status.padEnd(8)} ${ratio.padEnd(10)} ${result.fgHex.padEnd(10)} ${result.bgHex.padEnd(10)} ${result.pair.label}`;

    if (result.pass) {
      // eslint-disable-next-line no-console -- 스크립트 전용 출력
      console.log(line);
    } else {
      // eslint-disable-next-line no-console -- 스크립트 전용 출력
      console.error(line);
    }
  }
}

/**
 * 메인 실행 함수
 */
function main(): void {
  const cssPath = path.resolve(__dirname, '..', 'src', 'app', 'globals.css');

  if (!fs.existsSync(cssPath)) {
    // eslint-disable-next-line no-console -- 스크립트 전용 출력
    console.error(`[ERROR] globals.css 파일을 찾을 수 없습니다: ${cssPath}`);
    process.exit(1);
  }

  const css = fs.readFileSync(cssPath, 'utf-8');

  /* Light 모드 토큰 파싱 */
  const rootBlock = extractRootBlock(css);
  const lightTokens = parseTokensFromBlock(rootBlock);
  validateTokens(lightTokens, 'Light');

  /* Dark 모드 토큰 파싱 */
  const darkBlock = extractDarkBlock(css);
  const darkTokens = parseTokensFromBlock(darkBlock);
  validateTokens(darkTokens, 'Dark');

  /* 검증 수행 */
  const lightResults = checkPairs(lightTokens, CONTRAST_PAIRS);
  const darkResults = checkPairs(darkTokens, CONTRAST_PAIRS);

  /* 결과 출력 */
  printResults('Light', lightResults);
  printResults('Dark', darkResults);

  /* 실패 페어 집계 */
  const allResults = [...lightResults, ...darkResults];
  const failures = allResults.filter((r) => !r.pass);

  // eslint-disable-next-line no-console -- 스크립트 전용 출력
  console.log(`\n${'═'.repeat(60)}`);

  if (failures.length > 0) {
    // eslint-disable-next-line no-console -- 스크립트 전용 출력
    console.error(
      `  ✗ WCAG AA 검증 실패: ${failures.length}건의 페어가 4.5:1 미달`
    );
    // eslint-disable-next-line no-console -- 스크립트 전용 출력
    console.error('');
    for (const f of failures) {
      const mode = lightResults.includes(f) ? 'Light' : 'Dark';
      // eslint-disable-next-line no-console -- 스크립트 전용 출력
      console.error(
        `    [${mode}] ${f.pair.label}: ${f.ratio.toFixed(2)}:1 (필요: ${f.pair.threshold}:1)`
      );
    }
    // eslint-disable-next-line no-console -- 스크립트 전용 출력
    console.log(`${'═'.repeat(60)}\n`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console -- 스크립트 전용 출력
  console.log(`  ✓ WCAG AA 검증 통과: 전체 ${allResults.length}건 페어 4.5:1+ 충족`);
  // eslint-disable-next-line no-console -- 스크립트 전용 출력
  console.log(`${'═'.repeat(60)}\n`);
  process.exit(0);
}

main();
