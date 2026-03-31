# agent-notify-tmux

[中文](./README.zh-CN.md)

Notifications for AI coding agents on Linux.

```bash
# Use this project as packaged under heavygee:
curl -fsSL https://raw.githubusercontent.com/heavygee/agent-notify-tmux/main/install.sh | bash
```

## Features

- Works with [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Cursor](https://cursor.sh), [OpenAI Codex](https://openai.com/index/openai-codex/), and CLI
- Sound effects (terminal bell)
- Desktop notifications (notify-send)
- Voice announcements (custom local command in `~/coding/server-setup/.cursor/rules/system-voice.mdc`)
- tmux marquee status-line alerts (bottom-right status-right)
- ntfy push notifications (self-hosted or ntfy.sh)

Get notified when task completes.

![Platform and feature selection](./assets/image1.png)

![Desktop notification in Linux](./assets/image2.png)

![ntfy push notification on mobile](./assets/image3.png)

## Install

### One-line install (recommended)

```bash
# Optional: prefer your own fork in release lookup
export AGENT_NOTIFY_REPO="https://github.com/<your-user>/agent-notify-tmux"
curl -fsSL https://raw.githubusercontent.com/heavygee/agent-notify-tmux/main/install.sh | bash
```

### Manual download

```bash
# Linux ARM64
# Replace with your fork/repo path if needed
AGENT_NOTIFY_REPO="https://github.com/<your-user>/agent-notify-tmux"
curl -fsSL "$AGENT_NOTIFY_REPO/releases/latest/download/agent-notify-linux-arm64.tar.gz" -o agent-notify-linux-arm64.tar.gz
tar -xzf agent-notify-linux-arm64.tar.gz && chmod +x ./agent-notify-arm64

# Linux x64
AGENT_NOTIFY_REPO="https://github.com/<your-user>/agent-notify-tmux"
curl -fsSL "$AGENT_NOTIFY_REPO/releases/latest/download/agent-notify-linux-x64.tar.gz" -o agent-notify-linux-x64.tar.gz
tar -xzf agent-notify-linux-x64.tar.gz && chmod +x ./agent-notify-x64

./agent-notify-arm64  # on ARM64 hosts
./agent-notify-x64    # on x64 hosts
```

### From source

```bash
bun install && bun run dev
```

## Configuration

All platforms are **automatically configured** by the installer:

| Platform | Config File | Hook |
|----------|-------------|------|
| Claude Code | `~/.claude/settings.json` | `Stop` |
| Cursor | `~/.cursor/hooks.json` | `stop` |
| OpenAI Codex | `~/.codex/config.toml` | `notify` |
| CLI | `~/.zshrc` or `~/.bashrc` | `notify` function |

The installer shows a **diff preview** before applying changes, so you can review exactly what will be modified. Your existing configuration is preserved.

**Automatic backup:** Before modifying any config file, the installer creates a timestamped backup (e.g., `settings.json.20250131-143022.bak`) in the same directory. If something goes wrong, simply rename the `.bak` file to restore.

> **Note:** Since each platform supports different hook events, only the "task completion" hook is configured for consistency across all platforms.

### Using Both Claude Code and Cursor

If you use both Claude Code and Cursor, Cursor will load Claude Code's hooks by default (via "Include third-party skills" setting), which may cause **duplicate notifications**.

To avoid this, disable the option in Cursor:

**Settings → Rules, Skills, Subagents → Include third-party skills, subagents, and other configs → OFF**

## Self-hosted ntfy (Optional)

If you want to use your own ntfy server instead of [ntfy.sh](https://ntfy.sh):

```bash
docker compose up -d
```

Default port is 80. To use a different port, edit `docker-compose.yml`:

```yaml
ports:
  - 8080:80  # Change 8080 to your preferred port
```

Then enter `http://localhost:8080` as the ntfy URL during setup.

## Verification

Run these checks before merging:

- `bun install && bun run test:ci`
- `bun run scan:secrets` (requires Docker)

### Commit gate

You can wire local pre-commit checks so every commit also runs tests + secret scan:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

## License

MIT

## Credits

Inspired by `cfngc4594/agent-notify`.
