import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {extractAll, createPackageFromStreams} from '@electron/asar';
import {openAsar} from './inspect-asar.mjs';
import {makeRemoteModelMenu} from './remote-model-menu.mjs';
import {patchRemoteUsage, buildRemoteUsageFrontend} from './remote-usage-build.mjs';
import {loadConfig, resolveProviderConfig, requireFile} from './lib/config.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig(process.env.CLAUDE_PATCH_CONFIG || path.join(root, '..', 'config.json'));
const trialRoot = config.trialRoot;
const original = path.join(config.officialApp, 'resources', 'app.asar');
const ionOriginal = path.join(config.officialApp, 'resources', 'ion-dist.asar');
const exePath = path.join(trialRoot, 'app', 'claude.exe');
const staging = path.join(trialRoot, 'source');
const output = path.join(trialRoot, 'app', 'resources', 'app.asar');
const ionOutput = path.join(trialRoot, 'app', 'resources', 'ion-dist.asar');
const checkMode = process.argv.includes('--check');

requireFile(original, '官方 app.asar');
requireFile(ionOriginal, '官方 ion-dist.asar');
requireFile(exePath, '副本 claude.exe');
requireFile(config.modelCatalogFile, '模型目录（先运行 refresh-remote-models.ps1）');

fs.rmSync(staging, {recursive: true, force: true});
const archive = openAsar(original);
const originalHeaderHash = crypto.createHash('sha256').update(archive.headerBytes).digest('hex');
const unpacked = archive.files.filter(file => file.unpacked).map(file => file.name);
archive.close();
extractAll(original, staging);

const changes = [];
function replace(name, before, after) {
  const filename = path.join(staging, '.vite', 'build', name);
  const source = fs.readFileSync(filename, 'utf8');
  if (source.split(before).length !== 2) throw new Error('补丁定位不唯一：' + name + ' ' + before.slice(0, 70));
  fs.writeFileSync(filename, source.replace(before, after));
  changes.push({file: name, anchor: before.slice(0, 85)});
}

// 1) 数据目录固定到副本 profile。
replace('index.pre.js', 'function i0(){if(process.env.CLAUDE_USER_DATA_DIR)',
  'function i0(){return p.join(p.dirname(process.execPath),"..","profile");if(process.env.CLAUDE_USER_DATA_DIR)');
replace('index.pre.js', 'D.app.isPackaged&&!vue&&zY(process.env),LY(yue());',
  'D.app.isPackaged&&!vue&&zY(process.env),LY(yue());process.env.CLAUDE_USER_DATA_DIR=p.default.join(p.default.dirname(process.execPath),"..","profile");');

// 2) 指定 SSH 主机跳过本机 localhost 网关前置检查。
const hostLiteral = JSON.stringify(config.ssh.host);
replace('index.chunk-CGMjDglc.js', 'function D(e,n){let r=t.Ect().getProvider();',
  `function D(e,n){if(e==="ssh"&&n?.sshHostname===${hostLiteral})return;let r=t.Ect().getProvider();`);

// 3) 远端订阅分支：不上送本机凭据，不继承网关专用策略。
replace('index.chunk-CG7VroHu.js', '"use strict";', '"use strict";const __oraclePolicy=require("./oracle-policy.cjs");');
replace('index.chunk-CG7VroHu.js', 'Ke=He.l(V)||F?.credentialWithheld===!0;',
  '__oracleSubscription=__oraclePolicy.isOracleTarget(M),Ke=__oracleSubscription||He.l(V)||F?.credentialWithheld===!0;');
replace('index.chunk-CG7VroHu.js', 'Ii()&&(Ye[Fi]??="1");let vt=',
  'Ii()&&(Ye[Fi]??="1");if(__oracleSubscription){__oraclePolicy.cleanEnv(Ye);t.Pdt.info("[RemoteTrial] remote subscription environment prepared; client credentials withheld");}let vt=');
replace('index.chunk-CG7VroHu.js', 'pushSupported:dt===!0&&!He.l(V),',
  'pushSupported:!__oracleSubscription&&dt===!0&&!He.l(V),');
replace('index.chunk-CG7VroHu.js', 'getOAuthToken:Pt,getHostAuthToken:Pe.n(',
  'getOAuthToken:__oracleSubscription?void 0:Pt,getHostAuthToken:__oracleSubscription?void 0:Pe.n(');
replace('index.chunk-CG7VroHu.js', 'credentialWithheld:Mn.launcher===!0||On,autoModeClassifierRulesAtSpawn:',
  'credentialWithheld:__oracleSubscription||Mn.launcher===!0||On,autoModeClassifierRulesAtSpawn:');
replace('index.chunk-CG7VroHu.js', 'managedSettings:Dt.settings,settings:',
  'managedSettings:__oraclePolicy.hostSettings(M,Dt.settings),settings:');
replace('index.chunk-CG7VroHu.js', 'Yt=e=>t.ap(t.np(Jt,{remoteDeployedPin:!0,windowsHost:e},{log:!1}),Et),',
  'Yt=e=>__oraclePolicy.hostSettings(M,t.ap(t.np(Jt,{remoteDeployedPin:!0,windowsHost:e},{log:!1}),Et)),');
replace('index.chunk-CG7VroHu.js', '$.managedSettings=t.np(Dt,d),GP($,Jt===Dt?$.managedSettings:t.np(Jt,d,{log:!1})),',
  '$.managedSettings=__oraclePolicy.hostSettings(M,t.np(Dt,d)),GP($,__oraclePolicy.hostSettings(M,Jt===Dt?$.managedSettings:t.np(Jt,d,{log:!1}))),');
replace('index.chunk-CG7VroHu.js', 'wn=t.UZ(Cn),$.managedSettings=t.np(Dt,wn),',
  'wn=t.UZ(Cn),$.managedSettings=__oraclePolicy.hostSettings(M,t.np(Dt,wn)),');

// 4) 远端用量面板（可选）。
if (config.usagePanel) patchRemoteUsage({root, staging, replace, hosts: config.ssh.hosts.join(',')});

// 5) 写入带目标主机列表的 oracle-policy，避免把主机硬编码在仓库源码里。
const policyTemplate = fs.readFileSync(path.join(root, 'oracle-policy.cjs'), 'utf8');
if (policyTemplate.split("'__ORACLE_HOSTS__'").length !== 2) throw new Error('oracle-policy 主机占位不唯一');
const policySource = policyTemplate.replace("'__ORACLE_HOSTS__'", JSON.stringify(config.ssh.hosts.join(',')));
fs.writeFileSync(path.join(staging, '.vite', 'build', 'oracle-policy.cjs'), policySource);

// 6) 更新副本 configLibrary；sealed key 只在本机 profile 中存在，不写入仓库。
const providerFile = resolveProviderConfig(config);
const provider = JSON.parse(fs.readFileSync(providerFile, 'utf8'));
provider.disableAutoUpdates = true;
provider.sshHostAllowlist = [config.ssh.host];
provider.inferenceGatewayBaseUrl = 'http://127.0.0.1:1';
if (typeof provider.inferenceGatewayApiKey !== 'string' || !provider.inferenceGatewayApiKey) {
  logger('提示：provider 配置没有 inferenceGatewayApiKey；请先完成官方 3P 配置，或使用本机已有的配置。');
}
provider.inferenceModels = makeRemoteModelMenu(JSON.parse(fs.readFileSync(config.modelCatalogFile, 'utf8')));
if (!checkMode) {
  const backupDir = path.join(trialRoot, 'backup');
  fs.mkdirSync(backupDir, {recursive: true});
  fs.copyFileSync(providerFile, path.join(backupDir, 'configLibrary-before.json'));
  fs.writeFileSync(providerFile, JSON.stringify(provider, null, 2) + '\n');
}

if (checkMode) {
  console.log(JSON.stringify({check: true, patches: changes.length, unpacked: unpacked.length, originalHeaderHash, models: provider.inferenceModels.length}, null, 2));
  process.exit(0);
}

const streams = [];
function collect(dir, pre = '') {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name), relative = pre + entry.name;
    if (entry.isDirectory()) {
      streams.push({path: relative, type: 'directory', unpacked: false});
      collect(full, relative + '/');
    } else {
      streams.push({path: relative, type: 'file', stat: fs.statSync(full), unpacked: unpacked.includes(relative), streamGenerator: () => fs.createReadStream(full)});
    }
  }
}
collect(staging);
await createPackageFromStreams(output, streams);

let usageFrontend = null;
if (config.usagePanel) {
  usageFrontend = await buildRemoteUsageFrontend({root, originalApp: config.officialApp, outputApp: ionOutput});
} else {
  fs.copyFileSync(ionOriginal, ionOutput);
}
const built = openAsar(output);
const newHash = crypto.createHash('sha256').update(built.headerBytes).digest('hex');
built.close();

const exe = fs.readFileSync(exePath);
const oldBytes = Buffer.from(originalHeaderHash), positions = [];
let position = -1;
while ((position = exe.indexOf(oldBytes, position + 1)) !== -1) positions.push(position);
if (positions.length !== 1) throw new Error('完整性资源定位不是唯一值，拒绝修改可执行文件。');
Buffer.from(newHash).copy(exe, positions[0]);

if (usageFrontend) {
  const ionOld = Buffer.from(usageFrontend.originalHeaderHash), ionPositions = [];
  let ionPosition = -1;
  while ((ionPosition = exe.indexOf(ionOld, ionPosition + 1)) !== -1) ionPositions.push(ionPosition);
  if (ionPositions.length !== 1) throw new Error('网页包完整性资源定位不是唯一值，拒绝修改可执行文件。');
  Buffer.from(usageFrontend.headerHash).copy(exe, ionPositions[0]);
}
fs.writeFileSync(exePath, exe);

fs.writeFileSync(path.join(trialRoot, 'patch-manifest.json'), JSON.stringify({
  builtAt: new Date().toISOString(),
  version: config.version || '4.4212.0',
  changes,
  originalHeaderHash,
  headerHash: newHash,
  unpackedFileCount: unpacked.length,
  usageFrontend
}, null, 2));
console.log(JSON.stringify({patches: changes.length, unpacked: unpacked.length, headerHash: newHash}));

function logger(message) {
  // 只打印状态，不打印配置值或凭据。
  process.stderr.write(message + '\n');
}
