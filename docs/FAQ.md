# FAQ

## Is this an official Anthropic project?

No. It is an unofficial compatibility patch. It is not affiliated with,
endorsed by, or supported by Anthropic.

## 官方 Desktop 不是有 SSH 远程吗？为什么还需要补丁？

官方 Desktop 的 SSH 会话使用的是 Desktop 自己的客户端认证/3P provider 配置。它不会自动把远端 VPS 上已有的 Claude Code 订阅当作本机 Desktop 的认证来源；3P 路径还会把本机 provider 凭据带过去并拒绝 localhost 网关。因此在“Windows 没有官方登录条件、VPS 已有订阅”的组合下，官方原版没有可直接使用的路径，SSH 入口存在也不等于能用远端订阅。

## 把订阅放在 VPS 能降低封号概率吗？

稳定的 VPS 公网 IP、固定地区、稳定出口和 24/7 在线，可以减少因 Windows 本机 IP/网络/登录环境频繁变化导致的额外验证和异常触发，从而降低误封/风控概率；但这**不能保证不封号**。账号安全取决于是否遵守 Anthropic 条款、是否共享账号、使用行为等。本项目不提供账号共享、多账号轮换或地区规避。

## Does it include Claude Desktop or a modified exe?

No. The repository contains only our own scripts and documentation. It does not
contain `claude.exe`, `app.asar`, `ion-dist.asar`, extracted app code, or a
prebuilt modified client. You must use your own official installation.

## Does it copy my subscription token to Windows?

No. The remote Claude Code process keeps and uses its own login. The Windows
copy deliberately points its local gateway at an unused address.

## Can I use someone else's subscription?

No. Use only your own account/server and comply with Anthropic's terms. The
project is not a credential-sharing tool.

## Why 3P mode?

The desktop's third-party mode is the supported way to use a separate model
provider. The patch adjusts its SSH path so the remote host's own Claude Code
login is used instead of forwarding the local gateway credentials.

## Why does the model menu need refreshing?

The 3P menu is an administrator list (`inferenceModels`), not the official
catalog. It is generated from the remote engine's initialization response. A
new remote model requires a refresh and a restart.

## Why does Fable 5.2 show 200k in an old session?

The context window is established when a session/engine starts. Switching the
model in an existing session may keep the old window. Create a new session
after the menu refresh/restart. New sessions have been verified to show 1M.

## Does it work with a newer Claude Desktop?

Not by default. The patch anchors target 4.4212.0. A newer app requires a new
adaptation, fresh anchors, and full verification. Do not reuse the old build on
a new version.

## Can I use macOS/Linux desktop?

The scripts target Windows paths and Electron ASAR/hash handling. Porting is
possible but not supported in 0.1.0.

## Is the usage panel official?

It calls an official internal endpoint from the server, but the endpoint is not
a stable public API. It may change or stop working.

## Where are logs?

`trial/profile/Logs/main.log` and related logs. Do not paste them publicly
without removing server addresses, usernames, session IDs, and tokens.

## How do I uninstall?

```powershell
pwsh scripts/stop-trial.ps1
Remove-Item -Recurse -Force .\trial
```

The original official app and profile are untouched.
