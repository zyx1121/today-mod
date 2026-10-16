<!-- 翻譯自 README.md @ docs/readme-template-v2。只翻 "For AI agents" 以上的章節，英文版更新時一起改。 -->

<div align="center">

<h1>today-mod</h1>

<p><strong>行事曆、E3 截止日與提醒事項，濃縮成 Claude Code 輸入框上方的一行。</strong></p>

[![CI](https://img.shields.io/github/actions/workflow/status/zyx1121/today-mod/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/zyx1121/today-mod/actions)
[![Release](https://img.shields.io/github/v/release/zyx1121/today-mod?style=flat-square&sort=semver)](https://github.com/zyx1121/today-mod/releases)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-mod-d97757?style=flat-square)](https://github.com/anthropics/claude-code/tree/main/mods)
[![License](https://img.shields.io/github/license/zyx1121/today-mod?style=flat-square)](LICENSE)

[English](README.md) | **繁體中文** | [简体中文](README.zh-CN.md)

</div>

```
╭─ TODAY ──────────────────────────────────────────────────────────────────────╮
│ 13:20 3D遊戲程式  ED102  in 3h 20m  │  DUE 1  1 within 3d  │  TODO 1 overdue │
╰──────────────────────────────────────────────────────────────────────────────╯
```

session 常以「我今天要做什麼？」開始，以錯過一堂課結束。today-mod 讀一次你的一天，讓下一件事一直看得到，並把完整行程交給 Claude。問「上課前來得及做這個嗎？」就能得到真的答案。

## 功能

- **輸入框上方一行**：正在進行或下一個行程與倒數、接下來的 E3 截止日、到期的提醒事項。
- **行程進入 context**：每段對話的第一則訊息會帶一個 `today` 區塊，內含 Markdown 格式的完整行程。
- **所有 session 共用一次讀取**：開著的 session 每 5 分鐘共用一次讀取，倒數每分鐘更新。
- **部分失敗也看得到**：某個來源失敗時，那一行會顯示 `FAILED`，面板外框變紅，其他來源照常顯示。

## 快速開始

function hooks 仍在搶先體驗。在 shell profile 或 `settings.json` 的 `env` 裡開啟：

```sh
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
```

再到 Claude Code 安裝：

```
/plugin marketplace add zyx1121/today-mod
/plugin install today-mod@today-mod
```

開新 session，輸入框上方就會出現這一行。

## 使用方式

```
/today          Markdown 格式的完整行程
/today off      隱藏這一行(會記住)
/today on       重新顯示
```

| 部分 | 顯示 |
|------|------|
| Event | 正在進行的行程(`now`)或今天下一個行程(`in 1h 12m`)，或 `no more events today` |
| `DUE` | `dueDays` 天內的 E3 截止日，以及其中幾個在 3 天內 |
| `TODO` | 已逾期或今天稍晚到期的提醒事項 |
| `FAILED` | 幾個來源失敗。`/today` 會列出是哪些 |

## 設定

| 需要 | 用途 |
|------|------|
| [macos@zyx1121](https://github.com/zyx1121/macos) 0.2.0 以上 | 透過 EventKit 讀行事曆與提醒事項 |
| [nycu@zyx1121](https://github.com/zyx1121/nycu)，並登入 E3 | E3 截止日 |
| `/opt/homebrew/bin/uv` | 執行 macos 與 nycu 的腳本 |
| 終端機擁有行事曆與提醒事項的完整取用權限 | EventKit 讀取，不會開啟 app |

| 設定 | 預設 | 作用 |
|------|------|------|
| `macosScriptsDir` | `macos@zyx1121` 的 user 安裝位置 | `productivity.py` 所在目錄 |
| `nycuScriptsDir` | `nycu@zyx1121` 的 user 安裝位置 | `e3p.py` 所在目錄 |
| `refreshMs` | `300000` | 兩次讀取的間隔，至少 60000 |
| `dueDays` | `7` | E3 截止日往後看幾天 |
| `remindersList` | `TODO` | 提醒事項清單名稱或原生 ID |
| `showOnStart` | `true` | session 開始時顯示這一行。用過 `/today on` 或 `off` 後以它為準 |

## 運作方式

- `hooks/register.ts` 在 `session.start` 註冊 `/today`，平行讀取 3 個來源並啟動計時器。`ui.render` 在 `AbovePrompt` 畫出這一行，`prompt.context` 加入 `today` 區塊。
- `hooks/shared-read.ts` 把共用的讀取結果存在 `$TMPDIR/today-mod/agenda.json`。一個 session 在讀取時，其他 session 等它的結果，所以行事曆只讀一次。
- `hooks/agenda.ts` 以 stdin 傳 JSON 呼叫腳本，跟完每一頁並解析 API v2 結果。

## 限制

- 只支援 macOS，Claude Code 需開啟 function hooks。
- E3 截止日需要 NYCU 帳號。

## 其他

給 AI agent 的結構化資訊與開發說明在[英文版](README.md#for-ai-agents)。

## 授權

[MIT](LICENSE)
