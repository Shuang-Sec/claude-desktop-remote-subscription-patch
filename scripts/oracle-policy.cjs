'use strict';
// 只识别配置中指定的 SSH 连接。真正解析后的 HostName 仍由 Desktop 的允许列表检查。
// 构建时 __ORACLE_HOSTS__ 会被替换成 "host,user@host"；测试可用环境变量覆盖。
const HOSTS = (process.env.CLAUDE_PATCH_SSH_HOSTS || '__ORACLE_HOSTS__')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
function isOracleTarget(target) {
  return target?.kind === 'ssh' && HOSTS.includes(target.sshHost);
}
// 只处理该连接的启动环境；不读取、传送、保存服务器令牌。
function cleanEnv(env) {
  const exact = new Set(['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_OAUTH_REFRESH_TOKEN', 'CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST', 'CLAUDE_CODE_HOST_AUTH_ENV_VAR', 'CLAUDE_CODE_HOST_CREDS_FILE', 'CLAUDE_CODE_SDK_HAS_OAUTH_REFRESH', 'CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH', 'CLAUDE_CODE_API_BASE_URL', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY']);
  for (const key of Object.keys(env)) if (exact.has(key.toUpperCase()) || /^ANTHROPIC_/i.test(key) || /^CLAUDE_CODE_USE_/i.test(key)) delete env[key];
  env.CLAUDE_CODE_ENTRYPOINT = 'claude-desktop';
  return env;
}
// Desktop 的网关网络白名单会强制开启嵌套沙箱；专用连接让远端原有设置决定命令环境。
function hostSettings(target, settings) {
  if (!isOracleTarget(target) || !settings) return settings;
  const result = {...settings};
  delete result.sandbox;
  // 模型目录来自远端初始化响应，实际许可由服务器和官方账户决定。
  delete result.availableModels;
  delete result.enforceAvailableModels;
  return result;
}
module.exports = {isOracleTarget, cleanEnv, hostSettings, _hosts: HOSTS};
