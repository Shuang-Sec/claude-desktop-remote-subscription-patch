import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'scripts/build.mjs', 'scripts/prepare.mjs', 'scripts/seed-cache.mjs', 'scripts/apply-model-menu.mjs',
  'scripts/remote-model-menu.mjs', 'scripts/remote-usage-build.mjs', 'scripts/inspect-asar.mjs',
  'scripts/oracle-policy.cjs', 'scripts/oracle-usage.cjs', 'scripts/check.mjs', 'scripts/lib/config.mjs'
];
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], {stdio: 'inherit', windowsHide: true});
  if (result.status !== 0) { failed = true; console.error('语法检查失败：' + file); }
}
if (failed) process.exit(1);
console.log('Node 语法检查通过：' + files.length + ' 个文件');
