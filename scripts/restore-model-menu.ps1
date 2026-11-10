param(
  [switch]$Preview,
  [string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'config.json')
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $ConfigPath)) { throw "找不到配置文件：$ConfigPath" }
$cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
$repo = Split-Path -Parent $PSScriptRoot
$trialRoot = if ([IO.Path]::IsPathRooted([string]$cfg.trialRoot)) { [IO.Path]::GetFullPath([string]$cfg.trialRoot) } else { [IO.Path]::GetFullPath((Join-Path $repo ([string]$cfg.trialRoot))) }
$backupConfig = Join-Path $trialRoot 'backup\configLibrary-before.json'
$modelsValue = if ($cfg.modelCatalogFile) { [string]$cfg.modelCatalogFile } else { Join-Path $trialRoot 'remote-models.json' }
$modelsFile = if ([IO.Path]::IsPathRooted($modelsValue)) { [IO.Path]::GetFullPath($modelsValue) } else { [IO.Path]::GetFullPath((Join-Path $repo $modelsValue)) }
$previousModels = $modelsFile + '.previous'
$providerFile = if ($cfg.providerConfigFile) {
  [IO.Path]::GetFullPath([string]$cfg.providerConfigFile)
} else {
  Get-ChildItem -LiteralPath (Join-Path $trialRoot 'profile\configLibrary') -Filter '*.json' |
    Where-Object { $_.Name -ne '_meta.json' } | Select-Object -First 1 -ExpandProperty FullName
}
if (!$providerFile) { throw '找不到 provider 配置。' }
foreach ($file in @($backupConfig, $previousModels)) { if (!(Test-Path -LiteralPath $file)) { throw "缺少回滚文件：$file" } }
if ($Preview) {
  Write-Output '将执行：stop-trial.ps1 → 恢复 configLibrary-before.json 和 remote-models.json.previous → start-trial.ps1'
  return
}
& (Join-Path $PSScriptRoot '停止试验.ps1') -ConfigPath $ConfigPath
Copy-Item -LiteralPath $backupConfig -Destination $providerFile -Force
Copy-Item -LiteralPath $previousModels -Destination $modelsFile -Force
& (Join-Path $PSScriptRoot '启动试验.ps1') -ConfigPath $ConfigPath
Write-Output '已恢复上一份模型菜单。'
