param([string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'config.json'))
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $ConfigPath)) { throw "找不到配置文件：$ConfigPath" }
$cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
$repo = Split-Path -Parent $PSScriptRoot
$trialRoot = if ([IO.Path]::IsPathRooted([string]$cfg.trialRoot)) { [IO.Path]::GetFullPath([string]$cfg.trialRoot) } else { [IO.Path]::GetFullPath((Join-Path $repo ([string]$cfg.trialRoot))) }
$exe = [IO.Path]::GetFullPath((Join-Path $trialRoot 'app\claude.exe'))
$instances = @(Get-Process -Name claude -ErrorAction SilentlyContinue | Where-Object { $_.Path -and [IO.Path]::GetFullPath($_.Path) -eq $exe })
foreach ($instance in $instances) {
  try { $instance.CloseMainWindow() | Out-Null } catch {}
}
Start-Sleep -Seconds 3
$left = @(Get-Process -Name claude -ErrorAction SilentlyContinue | Where-Object { $_.Path -and [IO.Path]::GetFullPath($_.Path) -eq $exe })
foreach ($instance in $left) {
  try { Stop-Process -Id $instance.Id -Force -ErrorAction Stop } catch {}
}
Write-Output ("已停止副本进程数：" + $instances.Count)
