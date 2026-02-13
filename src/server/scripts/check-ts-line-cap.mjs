import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const root = new URL('../src', import.meta.url).pathname;
const limit = Number(process.env.TS_LINE_CAP || 850);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!full.endsWith('.ts')) continue;
    out.push(full);
  }
}

const files = [];
walk(root, files);
files.sort();

let hasViolation = false;
for (const file of files) {
  const count = readFileSync(file, 'utf8').split('\n').length;
  const rel = file.split('/src/server/')[1] || file;
  console.log(`${count.toString().padStart(4, ' ')} ${rel}`);
  if (count > limit) hasViolation = true;
}

if (hasViolation) {
  console.error(`[line-cap] violation: one or more .ts files exceed ${limit} lines`);
  process.exit(1);
}

console.log(`[line-cap] ok: all .ts files are <= ${limit} lines`);
