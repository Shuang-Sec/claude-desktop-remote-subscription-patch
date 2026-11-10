'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFile} = require('node:child_process');
const reasons = new Set(['ssh_failed', 'remote_auth', 'network', 'rate_limited', 'invalid_response', 'missing_credentials']);
const subscriptions = new Set(['pro', 'max', 'team', 'enterprise']);
// 构建时 __ORACLE_HOSTS__ 会被替换；测试可用环境变量覆盖。
const HOSTS = (process.env.CLAUDE_PATCH_SSH_HOSTS || '__ORACLE_HOSTS__')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const applicable = target => !!target && HOSTS.includes(target.sshHost) && (target.sshPort ?? 22) === 22 && typeof target.sshIdentityFile === 'string' && target.sshIdentityFile.length > 0;
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

function sanitizeUsage(data) {
  if (data?.status !== 'ok') return {status: 'error', reason: reasons.has(data?.reason) ? data.reason : 'invalid_response'};
  const windows = {};
  for (const key of ['five_hour', 'seven_day']) {
    const value = data.windows?.[key];
    if (!value || typeof value.utilization !== 'number' || !Number.isFinite(value.utilization) || value.utilization < 0) continue;
    if (value.resets_at !== null && !validDate(value.resets_at)) continue;
    windows[key] = {utilization: value.utilization, resets_at: value.resets_at};
  }
  if (!Object.keys(windows).length || !validDate(data.queried_at)) return {status: 'error', reason: 'invalid_response'};
  return {
    status: 'ok',
    subscription: subscriptions.has(data.subscription) ? data.subscription : null,
    queried_at: data.queried_at,
    windows,
    extra_usage_enabled: typeof data.extra_usage_enabled === 'boolean' ? data.extra_usage_enabled : null
  };
}

function loadSessionTarget(profile, sessionId) {
  if (!/^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId ?? '')) return null;
  const base = path.join(profile, 'claude-code-sessions');
  try {
    // 两层目录对应客户端账号与组织；只读取指定会话的 SSH 连接元数据。
    for (const account of fs.readdirSync(base, {withFileTypes: true}).filter(entry => entry.isDirectory())) {
      const parent = path.join(base, account.name);
      for (const org of fs.readdirSync(parent, {withFileTypes: true}).filter(entry => entry.isDirectory())) {
        const file = path.join(parent, org.name, sessionId + '.json');
        if (!fs.existsSync(file)) continue;
        const target = JSON.parse(fs.readFileSync(file, 'utf8')).sshConfig;
        return applicable(target) ? {sshHost: target.sshHost, sshPort: 22, sshIdentityFile: path.normalize(target.sshIdentityFile)} : null;
      }
    }
  } catch {}
  return null;
}

function runQuery(target) {
  return new Promise(resolve => {
    let script;
    try { script = fs.readFileSync(path.join(__dirname, 'oracle-usage-query.py'), 'utf8'); }
    catch { resolve({status: 'error', reason: 'invalid_response'}); return; }
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/OpenSSH/ssh.exe');
    const args = ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'ConnectionAttempts=1',
      '-o', 'ServerAliveInterval=5', '-o', 'ServerAliveCountMax=1', '-i', target.sshIdentityFile,
      '-p', String(target.sshPort ?? 22), target.sshHost, 'python3', '-'];
    const child = execFile(executable, args, {windowsHide: true, timeout: 55000, maxBuffer: 32768, encoding: 'utf8'}, (error, stdout) => {
      if (error) { resolve({status: 'error', reason: 'ssh_failed'}); return; }
      try { resolve(sanitizeUsage(JSON.parse(stdout.trim()))); }
      catch { resolve({status: 'error', reason: 'invalid_response'}); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(script);
  });
}

function createUsageReader({run = runQuery, now = Date.now} = {}) {
  const cache = new Map(), inflight = new Map();
  return async function read(target) {
    if (!applicable(target)) return {status: 'not_applicable'};
    const key = JSON.stringify([target.sshHost, target.sshPort ?? 22, path.normalize(target.sshIdentityFile)]);
    if (inflight.has(key)) return inflight.get(key);
    const previous = cache.get(key);
    if (previous && now() - previous.at < 60000) return previous.value;
    const pending = Promise.resolve().then(() => run(target)).then(sanitizeUsage, () => ({status: 'error', reason: 'ssh_failed'}))
      .then(value => { cache.set(key, {value, at: now()}); return value; })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
    return pending;
  };
}

const read = createUsageReader();
async function response(request, profile) {
  const id = new URL(request.url).searchParams.get('session_id');
  const target = loadSessionTarget(profile, id);
  const result = await read(target);
  return new Response(JSON.stringify(result), {headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}});
}

module.exports = {sanitizeUsage, createUsageReader, loadSessionTarget, response, runQuery, _hosts: HOSTS};
