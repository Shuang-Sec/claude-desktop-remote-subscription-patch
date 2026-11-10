import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.CLAUDE_PATCH_SSH_HOSTS = 'example.test,user@example.test';
const require = createRequire(import.meta.url);
const usage = require(path.join(root, 'scripts', 'oracle-usage.cjs'));
const fixture = {
  status: 'ok', subscription: 'pro', queried_at: '2026-11-04T10:04:49Z',
  windows: {five_hour: {utilization: 9, resets_at: '2026-11-04T13:50:00Z'}, seven_day: {utilization: 9, resets_at: '2026-11-10T08:00:00Z'}},
  extra_usage_enabled: false
};

test('只返回白名单字段，非法数值不变成零使用', () => {
  const result = usage.sanitizeUsage({...fixture, accessToken: 'DO_NOT_RETURN', email: 'private@example.invalid', windows: {...fixture.windows, raw_token: 'DO_NOT_RETURN'}});
  assert.deepEqual(result, fixture);
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_RETURN|private@example/);
  assert.equal(usage.sanitizeUsage({...fixture, windows: {five_hour: {utilization: '9', resets_at: null}}}).status, 'error');
});

test('同一目标并发合并，一分钟缓存', async () => {
  let calls = 0, time = 1000, finish;
  const reader = usage.createUsageReader({now: () => time, run: () => { calls++; return new Promise(resolve => { finish = resolve; }); }});
  const target = {sshHost: 'user@example.test', sshPort: 22, sshIdentityFile: 'C:\\test.key'};
  const first = reader(target), second = reader(target);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish(fixture);
  assert.deepEqual(await first, fixture);
  assert.deepEqual(await second, fixture);
  await reader(target);
  assert.equal(calls, 1);
  time += 60001;
  const third = reader(target);
  await Promise.resolve();
  assert.equal(calls, 2);
  finish(fixture);
  await third;
});

test('只接受配置中的主机，其他目标不发起查询', async () => {
  let calls = 0;
  const reader = usage.createUsageReader({run: async () => { calls++; return fixture; }});
  for (const target of [null, {sshHost: 'localhost'}, {sshHost: 'root@example.test', sshPort: 22}, {sshHost: 'user@example.test', sshPort: 2222}]) {
    assert.equal((await reader(target)).status, 'not_applicable');
  }
  assert.equal(calls, 0);
});

test('从本地会话文件识别远端目标', () => {
  const id = 'local_11111111-1111-4111-8111-111111111111';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-'));
  const dir = path.join(profile, 'claude-code-sessions', 'account', 'org');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({sshConfig: {sshHost: 'user@example.test', sshPort: 22, sshIdentityFile: 'C:\\test.key'}}));
  assert.equal(usage.loadSessionTarget(profile, id)?.sshHost, 'user@example.test');
  assert.equal(usage.loadSessionTarget(profile, '../../config.json'), null);
});
