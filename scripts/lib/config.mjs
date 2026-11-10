import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_CONFIG_PATH = path.join(REPO_ROOT, 'config.json');

const requiredStrings = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} 必须是非空字符串`);
  return value.trim();
};

const resolveFromRepo = value => path.isAbsolute(value) ? path.normalize(value) : path.resolve(REPO_ROOT, value);

export function validateConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('config 必须是 JSON 对象');
  const ssh = raw.ssh;
  if (!ssh || typeof ssh !== 'object' || Array.isArray(ssh)) throw new Error('config.ssh 必须是对象');

  const officialApp = resolveFromRepo(requiredStrings(raw.officialApp, 'officialApp'));
  const officialProfile = resolveFromRepo(requiredStrings(raw.officialProfile, 'officialProfile'));
  const trialRoot = resolveFromRepo(typeof raw.trialRoot === 'string' && raw.trialRoot.trim() ? raw.trialRoot.trim() : 'trial');
  const host = requiredStrings(ssh.host, 'ssh.host');
  const user = typeof ssh.user === 'string' && ssh.user.trim() ? ssh.user.trim() : 'deploy';
  const port = Number(ssh.port ?? 22);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('ssh.port 必须是 1-65535 的整数');
  const identityFile = resolveFromRepo(requiredStrings(ssh.identityFile, 'ssh.identityFile'));
  const remoteCwd = typeof ssh.remoteCwd === 'string' && ssh.remoteCwd.trim() ? ssh.remoteCwd.trim() : `/home/${user}/project`;
  const testCwd = typeof ssh.testCwd === 'string' && ssh.testCwd.trim() ? ssh.testCwd.trim() : `/home/${user}/claude-remote-test`;
  const modelCatalogFile = resolveFromRepo(typeof raw.modelCatalogFile === 'string' && raw.modelCatalogFile.trim()
    ? raw.modelCatalogFile.trim()
    : path.join(trialRoot, 'remote-models.json'));
  const providerConfigFile = typeof raw.providerConfigFile === 'string' && raw.providerConfigFile.trim()
    ? resolveFromRepo(raw.providerConfigFile.trim())
    : null;
  const hosts = [...new Set([host, `${user}@${host}`])];

  return {
    ...raw,
    officialApp,
    officialProfile,
    trialRoot,
    ssh: {...ssh, host, user, port, identityFile, remoteCwd, testCwd, hosts},
    modelCatalogFile,
    providerConfigFile,
    usagePanel: raw.usagePanel !== false,
    nodePath: typeof raw.nodePath === 'string' && raw.nodePath.trim() ? raw.nodePath.trim() : null
  };
}

export function loadConfig(file = process.env.CLAUDE_PATCH_CONFIG || DEFAULT_CONFIG_PATH) {
  const configPath = path.resolve(file);
  if (!fs.existsSync(configPath)) throw new Error(`找不到配置文件：${configPath}；请从 config.example.json 复制并填写`);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`无法解析配置文件 ${configPath}：${error.message}`);
  }
  return {...validateConfig(raw), configPath};
}

export function requireFile(file, label = '文件') {
  if (!fs.existsSync(file)) throw new Error(`缺少${label}：${file}`);
  return file;
}

export function discoverProviderConfig(profile) {
  const dir = path.join(profile, 'configLibrary');
  if (!fs.existsSync(dir)) throw new Error(`找不到 configLibrary：${dir}`);
  const files = fs.readdirSync(dir)
    .filter(name => /^[0-9a-f-]{36}\.json$/i.test(name))
    .map(name => path.join(dir, name));
  if (files.length === 0) throw new Error(`configLibrary 中没有 provider 配置：${dir}`);
  if (files.length > 1) throw new Error(`configLibrary 中有多个 provider 配置，请在 config.json 设置 providerConfigFile：${files.join(', ')}`);
  return files[0];
}

export function resolveProviderConfig(config) {
  return config.providerConfigFile ? requireFile(config.providerConfigFile, 'provider 配置') : discoverProviderConfig(path.join(config.trialRoot, 'profile'));
}
