# Claude Desktop Remote Subscription Patch

> 在 Windows 上使用官方 Claude Desktop 的独立副本，通过 SSH 使用远端 Linux 服务器上已有的 Claude Code 订阅。
> 本机不登录 Anthropic、不填写官方 API Key、不复制远端订阅令牌。
>
> **非官方项目。** 本项目不包含 Anthropic 的 `claude.exe`、`app.asar`、`ion-dist.asar` 或解包源码；这些文件必须由使用者从自己合法安装的官方 Claude Desktop 获取。项目与 Anthropic 无关联。

## 目录

- [真实痛点：官方 SSH 远程为什么走不通](#真实痛点官方-ssh-远程为什么走不通)
- [为什么把订阅放在远端 VPS](#为什么把订阅放在远端-vps)
- [这是什么](#这是什么)
- [它解决什么问题](#它解决什么问题)
- [安全模型](#安全模型)
- [账号安全与合规边界](#账号安全与合规边界)
- [前置条件](#前置条件)
- [快速开始](#快速开始)
- [配置字段](#配置字段)
- [远端服务器](#远端服务器)
- [构建原理](#构建原理)
- [模型菜单与 Fable 5.2 的 1M](#模型菜单与-fable-52-的-1m)
- [远端订阅用量面板](#远端订阅用量面板)
- [故障排查](#故障排查)
- [已知限制](#已知限制)
- [回滚与卸载](#回滚与卸载)
- [目录结构](#目录结构)
- [测试](#测试)
- [安全与隐私](#安全与隐私)
- [许可证与免责声明](#许可证与免责声明)

## 真实痛点：官方 SSH 远程为什么走不通

官方 Claude Desktop 的 SSH 远程会话，本质上仍然使用 Desktop 的**客户端认证/3P provider 配置**。它不是“把远端 VPS 上已有的 Claude Code 订阅委托给本机使用”的通道。

在“Windows 没有稳定官方登录网络 + 远端 VPS 已有订阅 + 本机不想登录/填 API Key”的组合下，原版会遇到：

1. 官方订阅路径要求本机完成官方登录；Windows 网络无法直连/登录时，认证走不完。
2. 3P/第三方路径把本机 provider 凭据作为会话凭据，并拒绝 localhost 网关；VPS 上 `~/.claude` 的订阅登录不会自动成为 Desktop 的认证来源。
3. 因此 SSH 菜单/入口即使出现，也不等于能用 VPS 的订阅；会话仍可能要求本机凭据，或直接失败。
4. 本机使用第三方网关时，模型请求地址/凭据与远端订阅是两套东西；把二者混在一起会造成“连上了，但用的是本机网关”的假象。

本项目补丁只改这条**指定 SSH 主机**的分支：让 Desktop 把该主机的会话交给远端 Claude Code，由远端使用自己的订阅登录；本机不登录、不持有远端 token，也不把本机网关当作远端模型来源。

## 为什么把订阅放在远端 VPS

把订阅登录保留在远端 VPS，而不是在 Windows 上反复登录，主要目的不是“绕过”，而是把认证环境固定下来：

| 维度 | Windows 本机 | 远端 VPS |
|---|---|---|
| 公网 IP | 家庭/校园/代理出口，可能变化 | 固定公网 IP |
| 地区/网络 | 可能无法稳定访问官方登录 | 固定地区、稳定出口 |
| 在线时间 | 关机/休眠/换网 | 24/7 |
| 凭据位置 | 若登录需放本机 | 留在服务器，续期也在服务器 |
| 日常操作 | 每次从变化环境登录 | Windows 只通过 SSH 操作 |

VPS 的固定 IP、固定地区、稳定 DNS/TLS 出口和持续在线，能减少“环境频繁变化”带来的额外验证/风控触发；**在合规使用前提下，这可以降低因 IP/地区/设备环境频繁变化造成的异常触发，从而减少误封/风控概率，但不能保证不被封。** 账号安全最终取决于是否遵守 Anthropic 条款和正常使用行为，不能用来规避地区限制、共享账号或多账号滥用。

对本项目来说，VPS 方案还有一个直接好处：签名/登录状态只存在服务器，Windows 副本只负责界面和 SSH，不需要把订阅 token 复制到本机。

## 这是什么

官方 Claude Desktop 的第三方（3P）模式默认把本机模型凭据传给远端，并拒绝地址为本机 localhost 的网关。本项目是一组**可审计的补丁脚本**，用于：

1. 复制一份官方 Claude Desktop 到独立目录；
2. 修改副本的资源，使指定 SSH 连接：
   - 跳过 localhost 网关的前置检查；
   - 不把本机的 Anthropic/网关凭据注入远端；
   - 让远端 Claude Code 使用服务器上已有的订阅登录；
   - 保留服务器 HOME 和服务器自身的命令环境；
3. 更新 ASAR/EXE 完整性哈希，不关闭 Electron 完整性校验；
4. 从远端引擎读取模型目录，生成模型菜单；
5. 在用量弹窗中显示远端订阅额度（可选）。

它**不是** Anthropic 官方客户端，也不修改你原来的官方安装。

## 它解决什么问题

典型场景：

```text
Windows 本机（没有官方订阅网络/登录条件）
  └─ 官方 Claude Desktop 独立副本
       └─ SSH
            └─ Linux 服务器（已登录 Claude Code 订阅）
                 └─ Claude Code 引擎使用服务器上的订阅与网络
```

本机只负责界面和 SSH 传输；模型请求、文件读写、命令执行和订阅认证都发生在服务器。

## 安全模型

- 不把服务器订阅 token 复制到 Windows；
- 不在本机登录 Anthropic 官方账号；
- 不把本机 API Key、OAuth token、网关地址或第三方提供商标记发送给远端；
- 副本的 gateway 指向不可用地址（`http://127.0.0.1:1`），用于证明远端会话不经过本机网关；
- 远端引擎继续使用服务器 `~/.claude` 下已有的登录状态和续期机制；
- `config.json`、`trial/`、`profile/`、日志和密钥均被 `.gitignore` 排除，不进入仓库。

**注意：** 这是一个非官方兼容补丁，可能违反 Anthropic 的服务条款；只应对你自己的账号和服务器使用，风险自负。

## 账号安全与合规边界

- 固定 VPS 环境只能减少“IP/地区/登录环境频繁变化”带来的异常触发，不能保证账号不被限制或封禁。
- 不要共享订阅、代登录、多账号轮换、批量注册，也不要用本项目规避地区限制或付费要求。
- 账号安全取决于遵守 Anthropic 条款、正常使用行为和账号本身的信誉；补丁只解决客户端认证路径，不改变账号规则。
- 如果官方明确禁止这种远程订阅用法，请停止使用本项目。

## 前置条件

### Windows

- Windows 10/11 x64；
- 官方 Claude Desktop **4.4212.0**（补丁锚点按该版本编写；其他版本需要重新适配）；
- Node.js 20+（推荐 22/24）和 npm；
- 可用的 OpenSSH 客户端（Windows 自带即可）。

### 远端 Linux

- 可通过 SSH 登录；
- 已安装并登录 Claude Code，且拥有有效订阅；
- 已生成 Desktop 配套引擎缓存（通常是 `~/.claude/remote/ccd-cli/*`；首次用 Desktop 连接远端时下载）；
- 建议使用非 root 用户，并保留默认 HOME。

### 网络

- Windows 能 SSH 到服务器；
- 服务器能访问 Anthropic API 和 Claude Code 更新域名；
- 本机不需要能访问 Anthropic 官方 API（这正是本项目的用途）。

## 快速开始

### 1. 克隆与安装依赖

```powershell
git clone https://github.com/Shuang-Sec/claude-desktop-remote-subscription-patch.git
cd claude-desktop-remote-subscription-patch
npm ci
```

### 2. 准备配置

```powershell
Copy-Item config.example.json config.json
notepad config.json
```

至少填写：

- `officialApp`：官方 Claude Desktop 4.4212.0 的 `app` 目录；
- `officialProfile`：官方 3P 配置目录（通常是 `%LOCALAPPDATA%\Claude-3p`）；
- `ssh.user` / `ssh.host` / `ssh.identityFile`；
- `ssh.remoteCwd` / `ssh.testCwd`。

`config.json` 已被 `.gitignore` 排除，不要提交。

### 3. 检查环境

```powershell
pwsh scripts/install.ps1 -Check
```

会检查官方程序、官方配置、SSH 私钥、Node 和 npm。失败时按提示修正。

### 4. 首次连接远端（重要）

在官方/副本 Desktop 中先完成一次远端 SSH 连接，让 Desktop 下载 Linux 配套引擎到：

```text
~/.claude/remote/ccd-cli/
```

然后再执行构建。模型刷新脚本需要该目录。

### 5. 构建副本

```powershell
pwsh scripts/install.ps1
```

它会：

1. `npm ci`（如果还没有 `node_modules`）；
2. 运行 `prepare.mjs`：复制官方程序和本地 3P 配置到 `trial/`；
3. 运行 `build.mjs`：应用补丁、生成菜单、更新 ASAR/EXE 完整性哈希。

### 6. 启动

```powershell
pwsh scripts/start-trial.ps1
```

在副本里：

1. 新建 Code 会话；
2. 选择 **Remote subscription** SSH 主机；
3. 选择远端目录；
4. 选择模型，开始对话。

### 7. 刷新模型菜单

```powershell
pwsh scripts/refresh-remote-models.ps1
pwsh scripts/stop-trial.ps1
pwsh scripts/start-trial.ps1
```

模型列表在启动时读取；刷新后需要重开副本。建议新建会话，避免旧会话缓存旧的 Context 上限。

## 配置字段

`config.json` 的完整示例见 [`config.example.json`](config.example.json)。

| 字段 | 必填 | 说明 |
|---|---|---|
| `officialApp` | 是 | 官方 Desktop 的 `app` 目录；补丁从这里读取 `claude.exe` 和两个 asar |
| `officialProfile` | 是 | 官方 3P 配置目录，例如 `C:/Users/<you>/AppData/Local/Claude-3p` |
| `trialRoot` | 是 | 副本输出目录；建议 `./trial`，不要用官方安装目录 |
| `version` | 否 | 官方版本，默认 `4.4212.0`；仅用于记录 |
| `modelCatalogFile` | 否 | 远端模型目录 JSON，默认 `./trial/remote-models.json` |
| `providerConfigFile` | 否 | 指定 `configLibrary` 的 provider JSON；默认自动发现 |
| `ssh.alias` | 否 | 显示用别名，默认 `claude-remote` |
| `ssh.user` | 是 | SSH 用户，例如 `deploy` |
| `ssh.host` | 是 | 服务器域名/IP |
| `ssh.port` | 否 | 默认 22 |
| `ssh.identityFile` | 是 | Windows 上的私钥路径 |
| `ssh.remoteCwd` | 是 | Desktop 初始远端目录 |
| `ssh.testCwd` | 否 | 模型初始化使用的远端目录；建议独立测试目录 |
| `ssh.desktopCli` | 否 | 手动指定 `~/.claude/remote/ccd-cli/*` 的绝对路径 |
| `nodePath` | 否 | 自定义 Node 可执行文件；默认 `node` |
| `usagePanel` | 否 | 是否启用远端用量面板，默认 `true` |

## 远端服务器

### 1. SSH 密钥

```powershell
ssh -i C:\Users\<you>\.ssh\id_ed25519 <user>@<host>
```

确认不需要密码、不需要交互式确认主机指纹（或先手动接受一次）。

### 2. Claude Code 登录

在服务器上：

```bash
claude --version
claude
# 按官方流程登录你的订阅
```

### 3. Desktop 配套引擎

首次从 Desktop 连接远端后，应出现：

```bash
ls ~/.claude/remote/ccd-cli/
```

本项目只读取该目录的初始化模型元数据，不复制其中的认证信息。

### 4. 目录权限

- `remoteCwd` 必须存在并可读写；
- `testCwd` 建议单独创建，避免模型初始化污染项目目录；
- 不要用论文/生产目录做首次测试。

## 构建原理

```text
官方 app.asar
  ├─ 解包到 trial/source
  ├─ 替换数据目录解析为 trial/profile
  ├─ 为指定 SSH 主机增加认证旁路
  ├─ 清理远端启动环境中的本机凭据
  ├─ 注入 oracle-policy.cjs（目标主机来自 config）
  ├─ 注入远端用量路由（可选）
  ├─ 重新打包 app.asar
  └─ 同步 claude.exe 中的 ASAR 完整性哈希

官方 ion-dist.asar
  ├─ 注入用量弹窗前端
  └─ 同步 claude.exe 中的网页包完整性哈希
```

构建**不关闭** Electron 完整性校验，也不修改系统校验策略。

更详细的数据流见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 模型菜单与 Fable 5.2 的 1M

菜单来自远端两个引擎的官方初始化响应：

- `claude-vscode`（服务器上的 `claude` CLI）；
- `claude-desktop`（Desktop 配套引擎）。

`refresh-remote-models.ps1` 只发送 initialize 控制请求，不发送用户消息，不读取/复制 token。

**Fable 5.2 1M：**

- 本项目在菜单项中为 `claude-fable-5-2` 写入 `supports1m: true` / `prefer1m: true`；
- 已在 2026-11-10 的实际 Desktop 会话中验证 1M；
- **旧会话可能仍显示 200k**：Context 上限在会话/引擎创建时确定，切换模型不会重建旧会话；请新建会话或重新加载远端引擎；
- 其他模型（如 Opus 5.5）的 1M 由 Desktop 内置目录/远端引擎决定。

详见 [`docs/MODEL-MENU.md`](docs/MODEL-MENU.md)。

## 远端订阅用量面板

打开用量圆环后，会显示：

- 5 小时额度、每周额度的已用/剩余百分比；
- 北京时间重置时间；
- 刷新按钮；
- 查询经 SSH 在服务器上执行，凭据不离开服务器。

该功能依赖服务器上的 `~/.claude/.credentials.json`（Claude Code 登录状态）和官方用量接口。接口变化时可能失效；失败时显示原因，不会把旧额度冒充成新结果。

详见 [`docs/USAGE-PANEL.md`](docs/USAGE-PANEL.md)。

## 故障排查

### 副本打不开 / 完整性错误

- 确认 `build.mjs` 完整跑完，没有手动改 `app.asar`/`claude.exe`；
- 不要关闭完整性校验；
- 如果换过官方版本，补丁锚点可能不匹配，必须重新适配。

### `Can't reach 127.0.0.1:1`

这是副本故意保留的本机网关探测提示，不影响远端会话；可关闭提示后选择远端环境。

### `setgroups` / 嵌套沙箱错误

本项目只在指定 SSH 分支移除 Desktop 注入的 `sandbox` 策略，保留服务器原有设置。如果仍出现，检查：

- 是否选错 SSH 主机；
- 服务器是否禁止用户命名空间；
- 是否需要改用服务器的非沙箱命令环境。

### SSH 超时/重连

- 先用 `ssh -i ... user@host` 验证；
- 检查服务器是否限制了并发会话；
- Windows 网络/代理可能影响长连接；
- 不要修改服务器全局内核参数来“修复”客户端问题。

### 模型菜单没有新模型

- 运行 `refresh-remote-models.ps1`；
- 关闭副本后重启；
- 新建会话；
- 确认远端两个引擎都返回了该模型。

### Fable 5.2 显示 200k

- 先新建会话；旧会话不会重算 Context；
- 确认 `inferenceModels` 中 Fable 5.2 有 `supports1m`/`prefer1m`；
- 如果新会话仍是 200k，检查远端引擎版本/账号能力，不要只改本地菜单。

### 用量面板无数据

- 确认服务器上 `~/.claude/.credentials.json` 存在且未过期；
- 在服务器上直接测试官方用量接口；
- 查看错误提示（SSH/网络/限流/认证失效）；
- 不要为了排障把 token 复制到 Windows。

更多见 [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)。

## 已知限制

- 仅针对 **Claude Desktop 4.4212.0**；官方升级后需要重新适配补丁锚点。
- 仅支持 Windows + Linux 远端；不保证 macOS/Linux 客户端。
- 非官方；可能违反 Anthropic 服务条款，风险自负。
- 不发布 exe/asar/官方源码；用户必须自备官方安装。
- 远端用量接口是官方内部接口，可能变化。
- 旧会话的 Context 上限不会因为切换模型而重算；Fable 5.2 请新建会话。
- 不提供订阅共享/凭据转发；只使用你自己的服务器和账号。

## 回滚与卸载

### 只回滚模型菜单

```powershell
pwsh scripts/restore-model-menu.ps1 -Preview
pwsh scripts/restore-model-menu.ps1
```

它恢复构建前的 `configLibrary` 和上一份 `remote-models.json`，并重启副本。

### 完全卸载

```powershell
pwsh scripts/stop-trial.ps1
Remove-Item -Recurse -Force .\trial
```

不会影响原版官方 Desktop、原配置、CC Switch、VS Code 或服务器。

## 目录结构

```text
scripts/       构建、安装、刷新、启动、停止、回滚
scripts/lib/   配置加载
docs/          安装、配置、架构、安全、模型、用量、排障、FAQ、法律
examples/      配置示例（全部为占位符）
tests/unit/    不依赖官方程序的单元测试
tests/integration/ 需要用户自己的官方程序和 config
```

## 测试

```powershell
npm test
npm run check
```

- `npm test`：单元测试，不读取官方程序、不联网、不使用真实服务器；
- `npm run check`：Node 语法检查；
- PowerShell 语法检查：

```powershell
Get-ChildItem scripts\*.ps1 | ForEach-Object {
  [void][ScriptBlock]::Create((Get-Content -Raw $_.FullName))
}
```

集成构建需要你自己的官方 app 和 config；CI 不包含官方二进制。

## 安全与隐私

- 仓库不包含服务器 IP、SSH 用户名/别名/密钥路径、账号 UUID、session ID、论文内容、Cookie、token、sealed key；
- `.gitignore` 排除 `config.json`、`trial/`、`profile/`、`app/`、日志、图片、asar、exe；
- 提交身份使用 GitHub noreply，不使用个人邮箱；
- 如果你在 issue/PR 中贴日志，请先删除服务器地址、用户名、会话 ID 和凭据。

安全报告请走 GitHub Security Advisories，不要在公开 issue 里放敏感信息。详见 [`SECURITY.md`](SECURITY.md)。

## 许可证与免责声明

本项目原创代码使用 MIT License；Anthropic 的官方程序、名称和商标不属于本项目。详见 [`LICENSE`](LICENSE)、[`NOTICE`](NOTICE) 和 [`docs/LEGAL.md`](docs/LEGAL.md)。

**本项目按“现状”提供，不提供任何担保。使用前请确认你拥有官方 Claude Desktop 和远端 Claude Code 订阅的合法使用权，并自行承担兼容性、服务条款和账号风险。**
