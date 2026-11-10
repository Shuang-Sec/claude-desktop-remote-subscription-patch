import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './lib/config.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig(process.env.CLAUDE_PATCH_CONFIG || path.join(root, '..', 'config.json'));
// 只复用本机已签名验证的 Claude Code 缓存；不复制远端状态或登录数据。
const source = path.join(config.officialProfile, 'claude-code');
if (!fs.existsSync(source)) {
  console.log('没有找到官方 claude-code 缓存，跳过。');
  process.exit(0);
}
function copy(src, dst) {
  fs.mkdirSync(dst, {recursive: true});
  for (const entry of fs.readdirSync(src, {withFileTypes: true})) {
    const from = path.join(src, entry.name), to = path.join(dst, entry.name);
    if (entry.isDirectory()) copy(from, to);
    else if (entry.isFile() && !entry.name.endsWith('.tmp')) fs.writeFileSync(to, fs.readFileSync(from));
  }
}
copy(source, path.join(config.trialRoot, 'profile', 'claude-code'));
console.log('已复用本机 Claude Code 缓存；未复制登录数据。');
