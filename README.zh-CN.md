# agent-notify-tmux

[English](./README.md)

Linux 上 AI 编程助手的通知提醒工具。

```bash
# 使用 heavygee 仓库
curl -fsSL https://raw.githubusercontent.com/heavygee/agent-notify-tmux/main/install.sh | bash
```

## 功能

- 支持 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)、[Cursor](https://cursor.sh)、[OpenAI Codex](https://openai.com/index/openai-codex/) 和命令行 (CLI)
- 音效提示（终端响铃）
- 桌面通知（notify-send）
- 语音播报（可插拔 TTS 后端：传统本地命令、OpenAI 兼容接口或本地语音栈）
- tmux 跑马灯状态栏提醒（右下角 status-right）
- ntfy 推送通知（支持自托管或 ntfy.sh）

任务完成时通知你。

![平台和功能选择](./assets/image1.png)

![Linux 桌面通知](./assets/image2.png)

![手机上的 ntfy 推送通知](./assets/image3.png)

## 安装

### 一行命令安装（推荐）

```bash
# 可选：在发布下载时优先使用你的 fork
export AGENT_NOTIFY_REPO="https://github.com/<your-user>/agent-notify-tmux"
curl -fsSL https://raw.githubusercontent.com/heavygee/agent-notify-tmux/main/install.sh | bash
```

### 手动下载

```bash
# Linux ARM64
# 替换为你的仓库地址
AGENT_NOTIFY_REPO="https://github.com/<your-user>/agent-notify-tmux"
curl -fsSL "$AGENT_NOTIFY_REPO/releases/latest/download/agent-notify-linux-arm64.tar.gz" -o agent-notify-linux-arm64.tar.gz
tar -xzf agent-notify-linux-arm64.tar.gz && chmod +x ./agent-notify-arm64

# Linux x64
AGENT_NOTIFY_REPO="https://github.com/<your-user>/agent-notify-tmux"
curl -fsSL "$AGENT_NOTIFY_REPO/releases/latest/download/agent-notify-linux-x64.tar.gz" -o agent-notify-linux-x64.tar.gz
tar -xzf agent-notify-linux-x64.tar.gz && chmod +x ./agent-notify-x64

./agent-notify-arm64  # ARM64 主机上运行
./agent-notify-x64    # x64 主机上运行
```

### 从源码构建

```bash
bun install && bun run dev
```

## 配置

安装程序会**自动配置**所有平台：

| 平台 | 配置文件 | Hook |
|------|---------|------|
| Claude Code | `~/.claude/settings.json` | `Stop` |
| Cursor | `~/.cursor/hooks.json` | `stop` |
| OpenAI Codex | `~/.codex/config.toml` | `notify` |
| CLI | `~/.zshrc` 或 `~/.bashrc` | `notify` 函数 |

安装程序会在应用更改前显示 **diff 预览**，让你确认将要修改的内容。你的现有配置会被保留。

**自动备份：** 修改任何配置文件前，安装程序会在同目录创建带时间戳的备份（如 `settings.json.20250131-143022.bak`）。如有问题，重命名 `.bak` 文件即可恢复。

> **说明：** 由于各平台支持的 hook 事件不同，为保持一致性，仅配置"任务完成"这一个 hook。

语音 hook 踩坑与发布前核对清单见 [`docs/voice-hook-regressions.md`](docs/voice-hook-regressions.md)（英文）。

Cursor 安装时，实际写入的 stop 命令为 `cursor-stop-wrapper.sh`。该包装脚本会解析 stop 载荷中的 `conversation_id`、`status`、`loop_count`、`generation_id`、`transcript_path`，并补充 `AGENT_NOTIFY_CONTEXT`。开启 `AGENT_NOTIFY_DEBUG=1` 可将原始解析日志写入 `~/.local/state/agent-notify/cursor-stop-debug.log`，用于排查字段来源。

TTS 与播放器细节见 `~/.local/state/agent-notify/cursor-voice-debug.log`。若 **真实 agent 结束** 后 `cursor-stop-debug.log` 有记录，但 **`cursor-voice-debug.log` 没有对应 `generation_id` 的新块**，请重新运行部署（如 `bun scripts/deploy-cursor-local.ts`）以刷新 `~/.local/bin/cursor-stop-wrapper.sh`，然后再结束一次真实任务核对两份日志。

若 `cursor-stop-debug.log` 里只有 **`wrapper.start` 紧接 `wrapper.complete`**，没有 `wrapper.payload` / `wrapper.forward`，旧版包装脚本可能在解析 transcript 中的 `AGENT_NOTIFY_SUMMARY` 时因 `jq` 失败在 `set -e` 下直接退出；新版已改为忽略该错误。生成的 `cursor-done-sound.sh` 会对所有格式 **先尝试 ALSA 再 ffmpeg**，并在 **ffplay 退出码 0 但 stderr 含 xcb** 时视为失败以便继续用 `aplay`。

### 语音后端（可选）

`~/.config/agent-notify/.env` 中含空格的取值须用**双引号**（例如 `AGENT_NOTIFY_VOICE_PLAYER_ARGS="-D plughw:1,0"`、`AGENT_NOTIFY_VOICE_FALLBACK_PLAYER_LIST="aplay paplay ffplay"`），否则 `source` 时会把空格后内容当成命令执行，hook 在 TTS 之前就会失败。

默认使用本地语音栈（默认语音 `xev`）：

```bash
export AGENT_NOTIFY_VOICE_MODE=local
export AGENT_NOTIFY_VOICE_URL=http://localhost:18008/v1/audio/speech
```

若你坚持使用本地命令，需要自行设置可执行命令：

```bash
export AGENT_NOTIFY_VOICE_MODE=script
export AGENT_NOTIFY_VOICE_COMMAND=/path/to/executable
```

使用 OpenAI 兼容接口（含自建服务）：

```bash
export AGENT_NOTIFY_VOICE_MODE=openai
export AGENT_NOTIFY_VOICE_URL=https://api.openai.com/v1/audio/speech
export AGENT_NOTIFY_VOICE_API_KEY=<你的密钥>   # 可选，自托管服务按需设置
```

常用可选参数：

```bash
export AGENT_NOTIFY_VOICE_MODEL=tts-1
export AGENT_NOTIFY_VOICE_VOICE=xev # 默认请求 xev；未注册或留空可改为让网关使用默认音色
export AGENT_NOTIFY_VOICE_RESPONSE_FORMAT=mp3
export AGENT_NOTIFY_VOICE_TIMEOUT=30
export AGENT_NOTIFY_VOICE_STRICT_VOICE=1    # 1: 请求的音色不存在时不回退，0: 回退到网关默认音色
export AGENT_NOTIFY_VOICE_PLAYER=aplay      # 可选；生成脚本默认顺序为 aplay,paplay,ffplay（无头机优先 ALSA）
export AGENT_NOTIFY_VOICE_PLAYER_ARGS=""     # 可选：播放参数（空格分隔）
export AGENT_NOTIFY_VOICE_DEBUG=1           # 可选：输出请求与播放器调试信息
```

### 语义总结（本地优先 + 远端兜底）

Cursor stop 回传的 `transcript_path` 可用于生成一句运行总结。默认策略使用两条 OpenAI 兼容端点：

- 主线：`http://100.121.154.23:8080/v1/chat/completions`，模型 `qwen2.5-1.5b-instruct-q8_0`（可通过 `AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL` 覆盖）
- 兜底：`https://api.openai.com/v1/chat/completions`，模型 `gpt-5.4-mini`

如需自定义，请在安装前设置（或在 `.env` 中设置并重装）：

```bash
export AGENT_NOTIFY_SUMMARY_ENABLED=1
export AGENT_NOTIFY_SUMMARY_PRIMARY_URL=http://100.121.154.23:8080/v1/chat/completions
export AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL=qwen2.5-1.5b-instruct-q8_0
# 也可以用其他 OpenAI 兼容的服务，比如本地 ollama:
# export AGENT_NOTIFY_SUMMARY_PRIMARY_URL=http://localhost:11434/v1/chat/completions
export AGENT_NOTIFY_SUMMARY_FALLBACK_URL=https://api.openai.com/v1/chat/completions
export AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL=gpt-5.4-mini
export AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY=<openai-key>
export AGENT_NOTIFY_SUMMARY_TIMEOUT=30
```

在可用 transcript 的情况下，语音文本会优先使用 `<status>|<summary>` 结果，并和现有 `AGENT_NOTIFY_CONTEXT` 一起输出。

LLM 请求体会写入临时文件，用 `jq --rawfile` 组装 JSON，再用 `curl --data-binary @文件` 发送；用户段长度由 `AGENT_NOTIFY_SUMMARY_MAX_USER_BYTES`（默认 512 KiB）限制，避免超大内容经 shell / `jq --arg` 传入导致失败。

### 多 Agent 场景下的上下文（新增）

多个 Agent 同时工作时，通知可以附带上下文，确保你知道是谁在发声：

```bash
export AGENT_NOTIFY_AGENT_ID=my-agent        # 可选：当前 notifier 对应的固定名称
```

你也可以手动传入自定义上下文：

```bash
export AGENT_NOTIFY_CONTEXT="blocked, needs review"
```

如果未手动设置上下文，会自动尝试从以下来源构建：

- `AGENT_NOTIFY_AGENT_ID`（优先）
- tmux 窗口、会话、当前 pane 路径（若运行于 tmux，可用于推断项目）
- 当前 shell 目录（兜底）

这些上下文会自动附加到语音播报和 tmux marquee 文案中。

### 同时使用 Claude Code 和 Cursor

如果你同时使用 Claude Code 和 Cursor，Cursor 默认会加载 Claude Code 的 hooks 配置（通过"Include third-party skills"设置），这可能导致**收到重复通知**。

为避免此问题，请在 Cursor 中关闭该选项：

**Settings → Rules, Skills, Subagents → Include third-party skills, subagents, and other configs → 关闭**

## 自托管 ntfy（可选）

如果你想使用自己的 ntfy 服务器而不是 [ntfy.sh](https://ntfy.sh)：

```bash
docker compose up -d
```

默认端口是 80。如需修改端口，编辑 `docker-compose.yml`：

```yaml
ports:
  - 8080:80  # 将 8080 改为你需要的端口
```

安装时输入 `http://localhost:8080` 作为 ntfy URL 即可。

## 验证

发布前建议先跑：

- `bun install && bun run test:ci`
- `bun run scan:secrets`（需要 Docker）

### 从仓库直接部署到本机（非交互）

```bash
bun run deploy:cursor
```

会更新 `~/.local/bin` 下的 Cursor 脚本，并合并 `~/.cursor/hooks.json` 中托管的 `stop` 钩子。

### 提交钩子

也可以启用本地提交前检查（每次提交前自动跑测试和密钥扫描）：

```bash
bun run setup:githooks
```

## 许可证

MIT

## 致谢

灵感来源于 `cfngc4594/agent-notify`。
