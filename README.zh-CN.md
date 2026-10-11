<!-- 翻译自 README.md @ docs/readme-template-v2。只翻 "For AI agents" 以上的章节，英文版更新时一起改。 -->

<div align="center">

<h1>today-mod</h1>

<p><strong>日历、E3 截止日期与提醒事项，浓缩成 Claude Code 输入框上方的一行。</strong></p>

[![CI](https://img.shields.io/github/actions/workflow/status/zyx1121/today-mod/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/zyx1121/today-mod/actions)
[![Release](https://img.shields.io/github/v/release/zyx1121/today-mod?style=flat-square&sort=semver)](https://github.com/zyx1121/today-mod/releases)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-mod-d97757?style=flat-square)](https://github.com/anthropics/claude-code/tree/main/mods)
[![License](https://img.shields.io/github/license/zyx1121/today-mod?style=flat-square)](LICENSE)

[English](README.md) | [繁體中文](README.zh-TW.md) | **简体中文**

</div>

```
📅 13:20 3D遊戲程式 · ED102 · in 3h 20m  📝 1 due (1 within 3d)  ☑ 1 overdue
```

session 常以「我今天要做什么？」开始，以错过一节课结束。today-mod 读一次你的一天，让下一件事一直看得到，并把完整日程交给 Claude。问「上课前来得及做这个吗？」就能得到真实的答案。

## 功能

- **输入框上方一行**：正在进行或下一个日程与倒计时、接下来的 E3 截止日期、到期的提醒事项。
- **日程进入 context**：每段对话的第一条消息会带一个 `today` 区块，内含 Markdown 格式的完整日程。
- **所有 session 共用一次读取**：打开的 session 每 5 分钟共用一次读取，倒计时每分钟更新。
- **部分失败也看得到**：某个来源失败时，那一行会显示 `⚠️`，其他来源照常显示。

## 快速开始

function hooks 仍在抢先体验。在 shell profile 或 `settings.json` 的 `env` 里开启：

```sh
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
```

再到 Claude Code 安装：

```
/plugin marketplace add zyx1121/today-mod
/plugin install today-mod@today-mod
```

开新 session，输入框上方就会出现这一行。

## 使用方式

```
/today          Markdown 格式的完整日程
/today off      隐藏这一行(会记住)
/today on       重新显示
```

| 部分 | 显示 |
|------|------|
| `📅` | 正在进行的日程(`now`)或今天下一个日程(`in 1h 12m`)，或 `no more events today` |
| `📝` | `dueDays` 天内的 E3 截止日期，以及其中几个在 3 天内 |
| `☑` | 已逾期或今天稍晚到期的提醒事项 |
| `⚠️` | 几个来源失败。`/today` 会列出是哪些 |

## 配置

| 需要 | 用途 |
|------|------|
| [macos@zyx1121](https://github.com/zyx1121/macos) 0.2.0 以上 | 通过 EventKit 读日历与提醒事项 |
| [nycu@zyx1121](https://github.com/zyx1121/nycu)，并登录 E3 | E3 截止日期 |
| `/opt/homebrew/bin/uv` | 运行 macos 与 nycu 的脚本 |
| 终端拥有日历与提醒事项的完全访问权限 | EventKit 读取，不会打开 app |

| 设置 | 默认 | 作用 |
|------|------|------|
| `macosScriptsDir` | `macos@zyx1121` 的 user 安装位置 | `productivity.py` 所在目录 |
| `nycuScriptsDir` | `nycu@zyx1121` 的 user 安装位置 | `e3p.py` 所在目录 |
| `refreshMs` | `300000` | 两次读取的间隔，至少 60000 |
| `dueDays` | `7` | E3 截止日期往后看几天 |
| `remindersList` | `TODO` | 提醒事项列表名称或原生 ID |
| `showOnStart` | `true` | session 开始时显示这一行。用过 `/today on` 或 `off` 后以它为准 |

## 工作原理

- `hooks/register.ts` 在 `session.start` 注册 `/today`，并行读取 3 个来源并启动定时器。`ui.render` 在 `AbovePrompt` 画出这一行，`prompt.context` 加入 `today` 区块。
- `hooks/shared-read.ts` 把共用的读取结果存在 `$TMPDIR/today-mod/agenda.json`。一个 session 在读取时，其他 session 等它的结果，所以日历只读一次。
- `hooks/agenda.ts` 以 stdin 传 JSON 调用脚本，读完每一页并解析 API v2 结果。

## 限制

- 只支持 macOS，Claude Code 需开启 function hooks。
- E3 截止日期需要 NYCU 账号。

## 其他

给 AI agent 的结构化信息与开发说明在[英文版](README.md#for-ai-agents)。

## 许可证

[MIT](LICENSE)
