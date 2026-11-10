param(
  [switch]$Check,
  [string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'config.json')
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (!(Test-Path -LiteralPath $ConfigPath)) {
  throw "找不到 config.json。请先复制 config.example.json 为 config.json 并填写。"
}
$cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
$trialRoot = if ([IO.Path]::IsPathRooted([string]$cfg.trialRoot)) { [IO.Path]::GetFullPath([string]$cfg.trialRoot) } else { [IO.Path]::GetFullPath((Join-Path $repo ([string]$cfg.trialRoot))) }
$officialApp = if ([IO.Path]::IsPathRooted([string]$cfg.officialApp)) { [IO.Path]::GetFullPath([string]$cfg.officialApp) } else { [IO.Path]::GetFullPath((Join-Path $repo ([string]$cfg.officialApp))) }
$nodeCommand = if ($cfg.nodePath) { [string]$cfg.nodePath } else { 'node' }
$checks = [ordered]@{
  officialApp = Test-Path -LiteralPath (Join-Path $officialApp 'claude.exe')
  officialAsar = Test-Path -LiteralPath (Join-Path $officialApp 'resources\app.asar')
  officialProfile = Test-Path -LiteralPath ([string]$cfg.officialProfile)
  sshKey = Test-Path -LiteralPath ([string]$cfg.ssh.identityFile)
  node = [bool](Get-Command $nodeCommand -ErrorAction SilentlyContinue)
  npm = [bool](Get-Command npm -ErrorAction SilentlyContinue)
}
$failed = @($checks.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object Key)
if ($failed.Count -gt 0) { throw ("检查失败： " + ($failed -join ', ')) }
Write-Output ("配置检查通过。trialRoot=" + $trialRoot)
if ($Check) { return }
$exe = Join-Path $trialRoot 'app\claude.exe'
if (Test-Path -LiteralPath $exe) {
  $running = @(Get-Process -Name claude -ErrorAction SilentlyContinue | Where-Object { $_.Path -and [IO.Path]::GetFullPath($_.Path) -eq [IO.Path]::GetFullPath($exe) })
  if ($running.Count -gt 0) { throw '试验副本正在运行，请先运行 stop-trial.ps1。' }
}
$node = if ($cfg.nodePath) { [string]$cfg.nodePath } else { 'node' }
$oldEnv = $env:CLAUDE_PATCH_CONFIG
$env:CLAUDE_PATCH_CONFIG = $ConfigPath
try {
  if (!(Test-Path -LiteralPath (Join-Path $repo 'node_modules'))) { & npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci 失败' } }
  & $node (Join-Path $PSScriptRoot 'prepare.mjs'); if ($LASTEXITCODE -ne 0) { throw 'prepare.mjs 失败' }
  & $node (Join-Path $PSScriptRoot 'build.mjs'); if ($LASTEXITCODE -ne 0) { throw 'build.mjs 失败' }
} finally {
  $env:CLAUDE_PATCH_CONFIG = $oldEnv
}
Write-Output '安装/构建完成。运行 scripts\start-trial.ps1 启动副本。'
