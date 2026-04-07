/**
 * @file API 라우팅 테이블 검증 스크립트
 * @description Gateway controller 파일을 파싱하여 실제 등록된 엔드포인트를 추출하고 출력한다.
 *
 * 사용법:
 *   node scripts/verify-routes.mjs                           # 테이블 출력
 *   node scripts/verify-routes.mjs --output routes.json      # JSON 파일 출력
 *   node scripts/verify-routes.mjs --json                    # stdout JSON 출력
 *
 * CI에서:
 *   npx tsx scripts/verify-routes.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Types ─────────────────────────────────────

interface RouteEntry {
  method: string;
  path: string;
  handler: string;
  controller: string;
  file: string;
}

// ─── Configuration ─────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GATEWAY_SRC = resolve(__dirname, '../services/gateway/src');
const PROJECT_ROOT = resolve(__dirname, '..');

const CONTROLLER_DECORATOR_RE =
  /@Controller\(\s*(?:'([^']*)'|"([^"]*)"|\`([^`]*)\`)?\s*\)/;

// Matches actual method definitions (not decorator calls like @UseGuards, @HttpCode, etc.)
const HANDLER_RE = /^\s+(?:async\s+)?(\w+)\s*\(/;
const DECORATOR_LINE_RE = /^\s*@/;

// ─── Glob helper (no external deps) ───────────

function walkDir(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Parser ────────────────────────────────────

function parseController(filePath: string): RouteEntry[] {
  const content = readFileSync(filePath, 'utf-8');
  const entries: RouteEntry[] = [];

  // Extract controller-level prefix
  const controllerMatch = content.match(CONTROLLER_DECORATOR_RE);
  const controllerPrefix = controllerMatch
    ? (controllerMatch[1] ?? controllerMatch[2] ?? controllerMatch[3] ?? '')
    : '';

  // Extract controller class name
  const classMatch = content.match(/class\s+(\w+)/);
  const controllerName = classMatch ? classMatch[1] : basename(filePath, '.ts');

  // Find all HTTP method decorators
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const decoratorRe =
      /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)'|"([^"]*)"|\`([^`]*)\`)?\s*\)/g;
    let match: RegExpExecArray | null;

    while ((match = decoratorRe.exec(line!)) !== null) {
      const method = match[1]!.toUpperCase();
      const routePath = match[2] ?? match[3] ?? match[4] ?? '';

      // Find handler name: look ahead for the method definition, skipping decorator lines
      let handlerName = '(unknown)';
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const currentLine = lines[j]!;
        // Skip decorator lines (@UseGuards, @HttpCode, @ApiOperation, etc.)
        if (DECORATOR_LINE_RE.test(currentLine)) continue;
        // Skip empty lines
        if (currentLine.trim() === '') continue;
        const handlerMatch = currentLine.match(HANDLER_RE);
        if (handlerMatch) {
          handlerName = handlerMatch[1]!;
          break;
        }
      }

      // Build full path
      const parts = [controllerPrefix, routePath].filter(Boolean);
      const fullPath = '/' + parts.join('/');

      entries.push({
        method,
        path: fullPath.replace(/\/+/g, '/'),
        handler: handlerName,
        controller: controllerName,
        file: relative(PROJECT_ROOT, filePath),
      });
    }
  }

  return entries;
}

// ─── Main ──────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const outputIdx = args.indexOf('--output');
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;

  // Find all controller files
  const controllerFiles = walkDir(GATEWAY_SRC, /\.controller\.ts$/);
  const allRoutes: RouteEntry[] = [];

  for (const file of controllerFiles.sort()) {
    allRoutes.push(...parseController(file));
  }

  // Sort by path, then method
  allRoutes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  // Output
  if (outputFile) {
    writeFileSync(outputFile, JSON.stringify(allRoutes, null, 2), 'utf-8');
    console.log(`[verify-routes] ${allRoutes.length} routes written to ${outputFile}`);
    return;
  }

  if (jsonFlag) {
    console.log(JSON.stringify(allRoutes, null, 2));
    return;
  }

  // Table output
  console.log(`\n  Gateway Route Table  (${allRoutes.length} endpoints)\n`);
  console.log(
    '  ' +
      'METHOD'.padEnd(8) +
      'PATH'.padEnd(50) +
      'HANDLER'.padEnd(30) +
      'CONTROLLER',
  );
  console.log('  ' + '-'.repeat(118));

  for (const route of allRoutes) {
    console.log(
      '  ' +
        route.method.padEnd(8) +
        route.path.padEnd(50) +
        route.handler.padEnd(30) +
        route.controller,
    );
  }

  console.log(`\n  Total: ${allRoutes.length} endpoints\n`);
}

main();
