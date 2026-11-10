import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {validateConfig} from '../../scripts/lib/config.mjs';

const sample = {
  officialApp: 'C:/Official/App',
  officialProfile: 'C:/Official/Profile',
  trialRoot: './trial',
  ssh: {user: 'deploy', host: 'example.test', port: 22, identityFile: 'C:/keys/id_ed25519', remoteCwd: '/home/deploy/project', testCwd: '/home/deploy/test'}
};

test('配置会解析相对路径并生成 host 允许列表', () => {
  const config = validateConfig(sample);
  assert.ok(path.isAbsolute(config.trialRoot));
  assert.ok(path.isAbsolute(config.modelCatalogFile));
  assert.deepEqual(config.ssh.hosts, ['example.test', 'deploy@example.test']);
  assert.equal(config.ssh.port, 22);
  assert.equal(config.usagePanel, true);
});

test('缺少 SSH 主机或密钥时拒绝继续', () => {
  assert.throws(() => validateConfig({...sample, ssh: {...sample.ssh, host: ''}}), /ssh\.host/);
  assert.throws(() => validateConfig({...sample, ssh: {...sample.ssh, identityFile: ''}}), /ssh\.identityFile/);
  assert.throws(() => validateConfig({...sample, officialApp: ''}), /officialApp/);
});

test('端口和 trialRoot 默认值可校验', () => {
  const config = validateConfig({...sample, trialRoot: undefined, ssh: {...sample.ssh, port: 2222}});
  assert.equal(config.ssh.port, 2222);
  assert.equal(path.basename(config.trialRoot), 'trial');
});
