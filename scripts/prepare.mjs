import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig, requireFile} from './lib/config.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig(process.env.CLAUDE_PATCH_CONFIG || path.join(root, '..', 'config.json'));
const officialApp = config.officialApp;
const officialProfile = config.officialProfile;
const trialRoot = config.trialRoot;
const appTarget = path.join(trialRoot, 'app');
const profileTarget = path.join(trialRoot, 'profile');

requireFile(path.join(officialApp, 'claude.exe'), '官方 claude.exe');
requireFile(path.join(officialApp, 'resources', 'app.asar'), '官方 app.asar');
requireFile(path.join(officialProfile, 'configLibrary'), '官方 configLibrary');

if (fs.existsSync(path.join(appTarget, 'claude.exe'))) {
  throw new Error('副本已经存在。请先备份/删除目标目录，或使用 build.mjs 重建，避免覆盖正在使用的副本。');
}

function copyPlain(src, dst) {
  fs.mkdirSync(dst, {recursive: true});
  for (const entry of fs.readdirSync(src, {withFileTypes: true})) {
    const from = path.join(src, entry.name), to = path.join(dst, entry.name);
    if (entry.isDirectory()) copyPlain(from, to);
    else if (entry.isFile()) fs.writeFileSync(to, fs.readFileSync(from));
    else throw new Error('拒绝复制非普通文件：' + from);
  }
}

copyPlain(officialApp, appTarget);
fs.mkdirSync(path.join(profileTarget, 'configLibrary'), {recursive: true});
copyPlain(path.join(officialProfile, 'configLibrary'), path.join(profileTarget, 'configLibrary'));

const originalUi = JSON.parse(fs.readFileSync(path.join(officialProfile, 'config.json'), 'utf8'));
fs.writeFileSync(path.join(profileTarget, 'config.json'), JSON.stringify({locale: originalUi.locale || 'zh-CN', hasTrackedInitialActivation: true}, null, 2));
fs.writeFileSync(path.join(profileTarget, 'claude_desktop_config.json'), JSON.stringify({
  deploymentMode: '3p',
  coworkUserFilesPath: path.join(trialRoot, 'workspace'),
  preferences: {sidebarMode: 'code', ccdScheduledTasksEnabled: false}
}, null, 2));
const sshTarget = `${config.ssh.user}@${config.ssh.host}`;
fs.writeFileSync(path.join(profileTarget, 'ssh_configs.json'), JSON.stringify({
  configs: [{
    id: 'remote-subscription',
    name: 'Remote subscription',
    sshHost: sshTarget,
    sshPort: config.ssh.port,
    sshIdentityFile: config.ssh.identityFile,
    remoteCwd: config.ssh.remoteCwd
  }],
  trustedHosts: config.ssh.hosts
}, null, 2));
fs.writeFileSync(path.join(trialRoot, 'trial.json'), JSON.stringify({
  createdAt: new Date().toISOString(),
  version: config.version || '4.4212.0',
  sshHost: config.ssh.host
}, null, 2));
console.log(JSON.stringify({appCopied: true, profileCreated: true, sshHost: config.ssh.host, trialRoot}, null, 2));
