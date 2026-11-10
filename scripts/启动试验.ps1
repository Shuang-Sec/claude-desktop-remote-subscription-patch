param([string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'config.json'))
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $ConfigPath)) { throw "找不到配置文件：$ConfigPath" }
$cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
$repo = Split-Path -Parent $PSScriptRoot
$trialRoot = if ([IO.Path]::IsPathRooted([string]$cfg.trialRoot)) { [IO.Path]::GetFullPath([string]$cfg.trialRoot) } else { [IO.Path]::GetFullPath((Join-Path $repo ([string]$cfg.trialRoot))) }
$exe = Join-Path $trialRoot 'app\claude.exe'
if (!(Test-Path -LiteralPath $exe)) { throw "副本不存在：$exe；请先运行 install.ps1" }
Start-Process -FilePath $exe -ArgumentList '--force-renderer-accessibility' -WorkingDirectory (Split-Path -Parent $exe) -WindowStyle Normal
Write-Output "已启动：$exe"
