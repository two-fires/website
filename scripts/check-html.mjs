// Lightweight pre-push validation: syntax-check the JS embedded in our static
// HTML pages so a broken <script> block can't ship. Extend FILES as needed.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILES = ['insight/index.html', 'diagnosis/index.html', 'audit/index.html', 'dashboard/index.html', 'portal.html'];

let blocks = 0;
for (const file of FILES) {
  const html = readFileSync(file, 'utf8');
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const m of matches) {
    vm.compileFunction(m[1]); // throws on syntax error
    blocks++;
  }
  console.log(`ok: ${file} (${matches.length} inline script block(s))`);
}
console.log(`check-html: ${blocks} script block(s) validated`);
