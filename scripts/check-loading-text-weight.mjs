import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

const mustExistChecks = [
  {
    file: 'src/styles/loadingTypography.ts',
    pattern: /export const LOADING_TEXT_FONT_WEIGHT = 300;/,
    message: 'LOADING_TEXT_FONT_WEIGHT must be 300.',
  },
  {
    file: 'src/screens/appshell/render/GraphLoadingGate.tsx',
    pattern: /fontWeight:\s*LOADING_TEXT_FONT_WEIGHT/g,
    minCount: 6,
    message: 'GraphLoadingGate loading text styles must use LOADING_TEXT_FONT_WEIGHT in all slots.',
  },
  {
    file: 'src/screens/LoadingScreen.tsx',
    pattern: /fontWeight:\s*LOADING_TEXT_FONT_WEIGHT/,
    message: 'LoadingScreen text must use LOADING_TEXT_FONT_WEIGHT.',
  },
  {
    file: 'src/components/AnalysisOverlay.tsx',
    pattern: /fontWeight:\s*LOADING_TEXT_FONT_WEIGHT/,
    message: 'AnalysisOverlay text must use LOADING_TEXT_FONT_WEIGHT.',
  },
  {
    file: 'src/screens/appshell/appShellStyles.ts',
    pattern: /fontWeight:\s*LOADING_TEXT_FONT_WEIGHT/,
    message: 'AppShell FALLBACK_STYLE loading text must use LOADING_TEXT_FONT_WEIGHT.',
  },
];

let failures = 0;

for (const check of mustExistChecks) {
  const filePath = path.join(repoRoot, check.file);
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(check.pattern);
  if (!matches) {
    console.error(`[loading-typography] FAIL ${check.file}: ${check.message}`);
    failures += 1;
    continue;
  }
  if (typeof check.minCount === 'number' && matches.length < check.minCount) {
    console.error(
      `[loading-typography] FAIL ${check.file}: expected at least ${check.minCount} matches, got ${matches.length}.`
    );
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`[loading-typography] FAIL total=${failures}`);
  process.exit(1);
}

console.log('[loading-typography] PASS');
