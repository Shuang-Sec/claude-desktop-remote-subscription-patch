import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const source = fs.readFileSync(path.join(root, 'scripts', 'oracle-policy.cjs'), 'utf8')
  .replace("'__ORACLE_HOSTS__'", JSON.stringify('example.test,user@example.test'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-'));
const file = path.join(temp, 'policy.cjs');
fs.writeFileSync(file, source);
const policy = require(file);

test('只匹配配置中的 SSH 目标', () => {
  assert.equal(policy.isOracleTarget({kind: 'ssh', sshHost: 'user@example.test'}), true);
  assert.equal(policy.isOracleTarget({kind: 'ssh', sshHost: 'example.test'}), true);
  assert.equal(policy.isOracleTarget({kind: 'ssh', sshHost: 'other.test'}), false);
  assert.equal(policy.isOracleTarget({kind: 'wsl', sshHost: 'example.test'}), false);
});

test('清理客户端凭据但保留会话协议字段', () => {
  const env = {ANTHROPIC_API_KEY: 'synthetic', ANTHROPIC_BASE_URL: 'http://127.0.0.1:1', CLAUDE_CODE_OAUTH_TOKEN: 'synthetic', CLAUDE_CODE_HOST_SESSION_ID: 'trial', HOME: '/home/test'};
  policy.cleanEnv(env);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, undefined);
  assert.equal(env.HOME, undefined);
  assert.equal(env.CLAUDE_CODE_HOST_SESSION_ID, 'trial');
  assert.equal(env.CLAUDE_CODE_ENTRYPOINT, 'claude-desktop');
});

test('只对目标连接移除网关专用策略', () => {
  const settings = {sandbox: {enabled: true}, permissions: {allow: []}, availableModels: ['x'], enforceAvailableModels: true};
  const remote = policy.hostSettings({kind: 'ssh', sshHost: 'example.test'}, settings);
  assert.equal(remote.sandbox, undefined);
  assert.equal(remote.availableModels, undefined);
  assert.equal(settings.sandbox.enabled, true);
  assert.equal(policy.hostSettings({kind: 'ssh', sshHost: 'other.test'}, settings), settings);
});
