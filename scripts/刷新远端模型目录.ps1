param([string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'config.json'))
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $ConfigPath)) { throw "找不到配置文件：$ConfigPath" }
$cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
$repo = Split-Path -Parent $PSScriptRoot
$trialRoot = if ([IO.Path]::IsPathRooted([string]$cfg.trialRoot)) { [IO.Path]::GetFullPath([string]$cfg.trialRoot) } else { [IO.Path]::GetFullPath((Join-Path $repo ([string]$cfg.trialRoot))) }
$modelsValue = if ($cfg.modelCatalogFile) { [string]$cfg.modelCatalogFile } else { Join-Path $trialRoot 'remote-models.json' }
$modelsFile = if ([IO.Path]::IsPathRooted($modelsValue)) { [IO.Path]::GetFullPath($modelsValue) } else { [IO.Path]::GetFullPath((Join-Path $repo $modelsValue)) }
$reader = Join-Path $PSScriptRoot 'read-remote-models.py'
$sshExe = Join-Path $env:SystemRoot 'System32\OpenSSH\ssh.exe'
if (!(Test-Path -LiteralPath $sshExe)) { $sshExe = 'ssh' }
$target = "$($cfg.ssh.user)@$($cfg.ssh.host)"
$sshArgs = @('-T','-o','BatchMode=yes','-o','ConnectTimeout=10','-i',[string]$cfg.ssh.identityFile,'-p',[string]$cfg.ssh.port)
$pyArgs = @('python3','-')
if ($cfg.ssh.testCwd) { $pyArgs += @('--test-cwd',[string]$cfg.ssh.testCwd) }
if ($cfg.ssh.desktopCli) { $pyArgs += @('--desktop-cli',[string]$cfg.ssh.desktopCli) }
$result = Get-Content -LiteralPath $reader -Raw -Encoding utf8 | & $sshExe @sshArgs $target @pyArgs
if ($LASTEXITCODE -ne 0) { throw '模型目录刷新失败，保留现有菜单。' }
$catalog = $result -join "`n"
$parsed = $catalog | ConvertFrom-Json
if (@($parsed | Where-Object { $_.status -eq 'success' -and $_.models.Count -gt 0 }).Count -ne 2) { throw '模型目录响应不完整，保留现有菜单。' }
$candidate = $modelsFile + '.candidate'
[IO.File]::WriteAllText($candidate, $catalog, [Text.UTF8Encoding]::new($false))
$node = if ($cfg.nodePath) { [string]$cfg.nodePath } else { 'node' }
$oldEnv = $env:CLAUDE_PATCH_CONFIG
$env:CLAUDE_PATCH_CONFIG = $ConfigPath
try {
  & $node (Join-Path $PSScriptRoot 'apply-model-menu.mjs') $candidate
  if ($LASTEXITCODE -ne 0) { throw '目录兼容性检查未通过，现有菜单未改动。' }
} finally {
  $env:CLAUDE_PATCH_CONFIG = $oldEnv
}
Write-Output '模型菜单已刷新。请在会话空闲时重开独立副本，以加载更新的模型目录。'
