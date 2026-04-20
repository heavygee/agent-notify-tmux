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
- Voice announcements (pluggable TTS backend: legacy local command, OpenAI-compatible endpoint, or local speech stack)
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

For Cursor-specific hook-format truth (must be wrapped with `version` and `hooks`), see [`AGENTS.md`](./AGENTS.md).

To verify installation health, run:

```bash
agent-notify status
```

It reports wrapper/script/config health and stop/voice log state with clear green/yellow/red status.

**Automatic backup:** Before modifying any config file, the installer creates a timestamped backup (e.g., `settings.json.20250131-143022.bak`) in the same directory. If something goes wrong, simply rename the `.bak` file to restore.

> **Note:** Since each platform supports different hook events, only the "task completion" hook is configured for consistency across all platforms.

For Cursor, the generated command now points to `cursor-stop-wrapper.sh`. This wrapper parses the stop payload (`conversation_id`, `status`, `loop_count`, `generation_id`, `transcript_path`) and attempts to infer agent/project identifiers. It exports `AGENT_NOTIFY_AGENT_ID` and `AGENT_NOTIFY_PROJECT` for summary context and passes `voice` (`voice`/`voice_id` and related aliases) through to the speech request as `AGENT_NOTIFY_VOICE_VOICE`.
The package also installs `agent-notify-session-context.sh` as a lightweight fallback helper (for installs where the agent summary is missing or incomplete). It resolves a session/UUID to a best-effort class (`cursor|codex|claude|kimi`) and project name, and feeds that into summary context for clearer spoken output.

Set `AGENT_NOTIFY_DEBUG=1` to keep a full hook+notification debug log at `~/.local/state/agent-notify/cursor-stop-debug.log`; look there for:

- `AGENT_NOTIFY_SUMMARY_SOURCE`
- `AGENT_NOTIFY_SUMMARY_SKIP_REASON`
- `AGENT_NOTIFY_SUMMARY_CONTEXT_PREFIX`
- `AGENT_NOTIFY_SUMMARY_PROMPT`
- `AGENT_NOTIFY_SUMMARY_TEXT`
- `AGENT_NOTIFY_VOICE_TEXT`
- `transcript_original_path`
- `transcript_resolved_to`
- `transcript_resolved_lines`
- `transcript_resolve_by` (which token was used to remap the transcript path)

For the exact text payload sent to TTS, check `~/.local/state/agent-notify/cursor-voice-debug.log` (or `AGENT_NOTIFY_VOICE_LOG_FILE` override). Each entry is timestamped with `=== <ISO-8601> ===` and includes:

- `event=cursor.tts`
- `AGENT_NOTIFY_AGENT_ID`
- `AGENT_NOTIFY_PROJECT`
- `AGENT_NOTIFY_SUMMARY_TEXT`
- `AGENT_NOTIFY_VOICE_TEXT`
- `AGENT_NOTIFY_VOICE_LOG_FILE` (resolved destination used by this run)

For a concise **regression story and release checklist** (the "how we figured it out" doc), see [`docs/voice-hook-regressions.md`](docs/voice-hook-regressions.md).

**If you hear nothing:** `cursor-voice-debug.log` usually shows why. `event=cursor.tts.skip reason=empty_voice_text` means no summary/action text reached TTS (check `AGENT_NOTIFY_SUMMARY_*` debug lines for LLM failures). `event=cursor.tts.player.stderr` with `xcb_connection_has_error` on `ffplay` while exit code is 0 is a known headless footgun - put **`aplay` before `ffplay`** in `AGENT_NOTIFY_VOICE_PLAYER` (in `~/.config/agent-notify/.env` if you use it, because that file overrides the hook string defaults). Cursor **reloads** `hooks.json` automatically; you do not need a restart just to pick up hook edits unless something is wrong with the Hooks output channel.

If `cursor-stop-debug.log` shows a real stop but **no new block** appears in `cursor-voice-debug.log` for that `generation_id`, your installed `cursor-stop-wrapper.sh` may be stale or from an older generator bug; run **`bun scripts/deploy-cursor-local.ts`** (or your usual deploy) so `~/.local/bin/cursor-stop-wrapper.sh` is regenerated, then trigger **one real agent completion** and re-check both logs.

If `cursor-stop-debug.log` has **`wrapper.start` immediately followed by `wrapper.complete`** with **no** `wrapper.payload` / `wrapper.forward` lines, an older wrapper could **abort** while parsing `AGENT_NOTIFY_SUMMARY` from the transcript (`set -e` + failing `jq`); current generators treat that as non-fatal. Redeploy fixes it. Generated `cursor-done-sound.sh` also **prefers ALSA before ffmpeg** for every format and treats **ffplay exit 0 + xcb** as failure so a real `aplay` attempt runs next.

### Voice backend (optional)

In `~/.config/agent-notify/.env`, **quote values that contain spaces** (for example `AGENT_NOTIFY_VOICE_PLAYER_ARGS="-D plughw:1,0"` and `AGENT_NOTIFY_VOICE_FALLBACK_PLAYER_LIST="aplay paplay ffplay"`). Unquoted spaces make `bash` treat the rest of the line as separate commands when the file is sourced, and the hook will fail before TTS runs.

Voice announcements are optional and configurable through environment variables. The default mode is the local speech stack with the `xev` voice.

```bash
export AGENT_NOTIFY_VOICE_MODE=local
export AGENT_NOTIFY_VOICE_URL=http://localhost:18008/v1/audio/speech
```

Legacy script mode is still supported for power users, but only if `AGENT_NOTIFY_VOICE_COMMAND` is an actual executable command.

```bash
export AGENT_NOTIFY_VOICE_MODE=script
export AGENT_NOTIFY_VOICE_COMMAND=/path/to/executable
```

Use an OpenAI-compatible endpoint:

```bash
export AGENT_NOTIFY_VOICE_MODE=openai
export AGENT_NOTIFY_VOICE_URL=https://api.openai.com/v1/audio/speech
# Optional, if your endpoint requires auth:
export AGENT_NOTIFY_VOICE_API_KEY=<token>
```

Common optional knobs:

```bash
export AGENT_NOTIFY_VOICE_MODEL=tts-1
export AGENT_NOTIFY_VOICE_VOICE=xev         # default requested voice; use a valid voice or leave empty for default stack voice
export AGENT_NOTIFY_VOICE_RESPONSE_FORMAT=mp3
export AGENT_NOTIFY_VOICE_EXAGGERATION=0.8
export AGENT_NOTIFY_VOICE_CFG_WEIGHT=1.0
export AGENT_NOTIFY_VOICE_TEMPERATURE=0.8
export AGENT_NOTIFY_VOICE_TOP_P=0.9
export AGENT_NOTIFY_VOICE_MIN_P=0.05
export AGENT_NOTIFY_VOICE_REPETITION_PENALTY=1.05
export AGENT_NOTIFY_VOICE_STREAM_FORMAT=pcm
export AGENT_NOTIFY_VOICE_STREAMING_QUALITY=medium
export AGENT_NOTIFY_VOICE_STREAMING_STRATEGY=chunked
export AGENT_NOTIFY_VOICE_STREAMING_CHUNK_SIZE=1024
export AGENT_NOTIFY_VOICE_STREAMING_BUFFER_SIZE=2048
export AGENT_NOTIFY_VOICE_TIMEOUT=30
export AGENT_NOTIFY_VOICE_STRICT_VOICE=0       # 1: do not fallback if requested voice is rejected, 0: fallback to gateway default voice
export AGENT_NOTIFY_TMUX_MARQUEE=1             # 1: run tmux status-right marquee on completion
export AGENT_NOTIFY_VOICE_PLAYER=aplay      # optional override; generated default order is aplay,paplay,ffplay (headless ALSA first; ffplay last-resort)
export AGENT_NOTIFY_VOICE_PLAYER_ARGS=""     # optional args for the player (space-separated)
export AGENT_NOTIFY_VOICE_DEBUG=1           # optional debug to print request/player diagnostics
export AGENT_NOTIFY_VOICE_INCLUDE_CONTEXT=0   # 1: append AGENT_NOTIFY_CONTEXT to spoken text
```

### Semantic summary (local + remote LLM)

Cursor stop notifications include `transcript_path`; by default the notifier attempts a semantic run summary from two OpenAI-compatible endpoints:

- Primary: `http://100.121.154.23:8080/v1/chat/completions` (model `qwen2.5-1.5b-instruct-q8_0`; override with `AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL`)
- Fallback: `https://api.openai.com/v1/chat/completions` (model `gpt-5.4-mini`)

The stop payload can also carry `voice` (or `voice_id` / `notification.voice` / `notify.voice` / `metadata.voice` / `audio.voice` / `agent_voice` / `payload.voice`). When present, that value is passed as `AGENT_NOTIFY_VOICE_VOICE` into the TTS request.

Set these explicitly before install if you want different providers:

```bash
export AGENT_NOTIFY_SUMMARY_ENABLED=1
export AGENT_NOTIFY_SUMMARY_PRIMARY_URL=http://100.121.154.23:8080/v1/chat/completions
export AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL=qwen2.5-1.5b-instruct-q8_0
# Example OpenAI-compatible alternatives:
# - local ollama: http://localhost:11434/v1/chat/completions
# - any OpenAI-compatible local service on your LAN
export AGENT_NOTIFY_SUMMARY_FALLBACK_URL=https://api.openai.com/v1/chat/completions
export AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL=gpt-5.4-mini
export AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY=<openai-key>
export AGENT_NOTIFY_SUMMARY_TIMEOUT=30
```

The installer also writes `~/.config/agent-notify/.env` and Cursor hook config points at it through
`AGENT_NOTIFY_ENV_FILE`. Keep secrets in that file, then re-run the installer/update flow if needed.
Codex notifications now load `AGENT_NOTIFY_ENV_FILE` too, so the same voice settings apply to
Codex without touching command lines.

Order of operations: **stop action** from the hook payload or parsed `AGENT_NOTIFY_SUMMARY` line wins; else **LLM summary** (primary then fallback) when `AGENT_NOTIFY_SUMMARY_ENABLED=1`, `curl`, and `jq` are available; the LLM user message defaults to the **last assistant turn** extracted from the transcript JSONL (`AGENT_NOTIFY_SUMMARY_INPUT_MODE=last_assistant`). Set `AGENT_NOTIFY_SUMMARY_INPUT_MODE=tail320` to send the older wide tail blob instead.

The LLM request is built without stuffing megabytes into shell arguments: user text is written to a temp file (capped by `AGENT_NOTIFY_SUMMARY_MAX_USER_BYTES`, default 512 KiB), the JSON body is produced with `jq --rawfile`, and `curl` sends it with `--data-binary @thatfile` (this avoids `ARG_MAX` / empty `jq --arg` failures on huge turns). Summary `curl` calls use `--connect-timeout` so a **dead primary URL** fails in seconds instead of hanging for the full `AGENT_NOTIFY_SUMMARY_TIMEOUT` (which could prevent the fallback from running before the IDE kills the hook). If the primary URL is `https://api.openai.com/...`, the script sends `Authorization: Bearer ...` using the same key vars as the fallback when `AGENT_NOTIFY_SUMMARY_PRIMARY_API_KEY` is unset.

For **local WAV** from TTS, playback prepends **aplay** and **paplay** before other players so **`ffplay` exit 0 with no audible output** (common with X11/SDL on headless hosts) is less likely to block speech.

If there is still no summary text, the same last-assistant extraction fills `AGENT_NOTIFY_SUMMARY_TEXT` (`transcript-tail`).

Spoken lines label **provider** (cursor / codex / claude where known), **project**, and **task** - not the inference LLM slug (composer, gpt-*, etc.). That slug stays in debug logs only.

**Why the old code used a 320-line blob for LLM input:** early versions stuffed the whole tail into one string because it was easy. The generated `cursor-done-sound.sh` now defaults `AGENT_NOTIFY_SUMMARY_INPUT_MODE=last_assistant` and feeds the summarizer the **last assistant message** extracted from JSONL; `tail320` is still there if you need the legacy behavior.

**Why last-assistant extraction can still be empty:** the jq filter may not match Cursor’s JSONL shape for the last line, `transcript_path` may be missing from the stop payload, or the transcript file may be empty or unreadable. A **stop-before-flush** race is possible in theory but is **not** something this repo has measured or asserted as the usual cause; do not treat it as the default explanation.

**Fallback LLM:** defaults are baked into the script: OpenAI-compatible URL and model when env is unset; you still need a key (`AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY` or `AGENT_NOTIFY_VOICE_API_KEY`) for providers that require auth.

`AGENT_NOTIFY_CONTEXT` (session window/project metadata) is appended only when `AGENT_NOTIFY_VOICE_INCLUDE_CONTEXT=1`; keep it `0` (default) to avoid extra IDs.

The ALSA **Front Center** ding is **off by default** (`AGENT_NOTIFY_VOICE_FALLBACK_WAV_PLAY=0`). Enable only if you want a wav file when TTS fails: set `AGENT_NOTIFY_VOICE_FALLBACK_WAV_PLAY=1` and `AGENT_NOTIFY_VOICE_FALLBACK_WAV` to a real path.

If both LLM calls fail and transcript extraction is empty (wrong JSONL shape, missing `transcript_path`, or empty file), there is nothing to speak until you fix the hook env or agent contract line.

Note: some inference endpoints can return useful output in `message.reasoning` instead of `message.content`. In that case, keep a valid fallback key (for example OpenAI) or switch to a model that returns plain `content` to keep summaries generated from the LLM.

### Structured in-agent summary protocol (recommended)

If you can force your agents to emit a deterministic note, prefer this over LLM summarization.

Use this exact machine-parseable format as the **last line** of a response:

```bash
AGENT_NOTIFY_SUMMARY {"version":1,"agent":"<agent-id>","project":"<project>","status":"<status>","action":"<next action>","summary":"<concise 1-2 sentences>"}
```

- `status` must be one of: `done`, `blocked`, `needs_review`, `needs_decision`, `failed`, `stalled`
- `agent` should identify which agent/run produced the result
- `project` is optional but useful when many agents run in parallel
- If this line is present and parseable, we use it directly.
- If it is missing, we fall back to the semantic LLM summary from transcript.

Drop this in each agent's `AGENTS.md` (or similar prompt header):

```text
At the end of every response, append a final line in this exact format:
AGENT_NOTIFY_SUMMARY {"version":1,"agent":"$AGENT_ID","project":"$PROJECT","status":"done|blocked|needs_review|needs_decision|failed|stalled","action":"what user should do next","summary":"one concise sentence for triage"}

Variables: 
$AGENT_ID - if you are aware of more than one agent on this project, use a distinguishing name from your context about what agent id you may have, that might be a given name or a specific purpose e.g. "testing agent" or "contracts agent" or "feature-x agent", you will decide, keep it short as this will be spoken aloud
$PROJECT - shortname for what you are working on, perhaps the repo name slug or the folder name leaf of the working directory.


Purpose: a completed turn is an action for the user. A spoken or visual note based on your concise summary will be presented to the user wherever they are, to let them identify which agent you are, what you are working on and what they need to do.

Rules:
- status means what the agent needs from the user or what changed:
  - done: work completed, waiting for review/merge
  - blocked: cannot continue without an external dependency or decision
  - needs_review: work done but risky, incomplete, or likely wrong
  - needs_decision: multiple options or assumptions need user confirmation
  - failed: task failed and requires user intervention
  - stalled: repeating, waiting for external signal
- action must be concrete and short (10-16 words max)
- summary must be concise, user-facing, and include the blocker when applicable
- If you cannot determine status confidently, use "blocked"
- Keep all fields ASCII and JSON-safe (no raw newlines)
```

When agents follow this contract, the notification becomes a clear "next action" message instead of a generic summary.

See also: `./agent-summary-prompt.md` for a copy/paste-ready fragment.

### Multi-agent context (new with many agents)

In parallel-agent setups, notifications can include runtime context so you can hear "which" agent is done.

```bash
export AGENT_NOTIFY_AGENT_ID=my-agent        # optional static label for this notifier
```

You can also pass a custom context manually:

```bash
export AGENT_NOTIFY_CONTEXT="blocked, needs review"
```

If no context is provided, the notifier builds one from:

- `AGENT_NOTIFY_AGENT_ID` if set
- tmux window, session, and pane path (for project detection when running in tmux)
- current shell directory as a fallback project hint

Context is appended to spoken announcement text and tmux marquee messages.

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

### Hearing nothing?

- The **`AGENT_NOTIFY_SUMMARY {...}`** line some agents append to chat text is **not audio** - it is a machine-readable contract for tooling. It is never spoken by itself.
- **`bun run deploy:cursor`** and other **terminal commands here do not fire Cursor’s `stop` hook**, so **`cursor-done-sound.sh` does not run** until Cursor actually finishes an agent turn and invokes the hook. Expecting sound from a deploy script is the wrong test.
- To prove **TTS + ALSA on this machine** without Cursor: `bun run verify:voice` (Bun script: fetch TTS, write WAV, spawn `aplay` with `AGENT_NOTIFY_VOICE_PLAYER_ARGS` parsed from `~/.config/agent-notify/.env` - **no shell**, so poisoned bash completions cannot break the test).

### Deploy scripts from a git checkout (no interactive wizard)

After you pull changes to this repo on a machine where Cursor hooks already exist:

```bash
bun run deploy:cursor
```

That writes `cursor-done-sound.sh`, `cursor-stop-wrapper.sh`, and the session-context helper under `~/.local/bin`, and merges the managed `stop` entry into `~/.cursor/hooks.json` (other hooks are preserved).

### Commit gate

You can wire local pre-commit checks so every commit also runs tests + secret scan:

```bash
bun run setup:githooks
```

## `.env` and secret handling

The installer now writes `~/.config/agent-notify/.env` automatically when missing.

Store secrets and overrides there, not in `hooks.json`.

```bash
AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY=<openai-key>
AGENT_NOTIFY_VOICE_API_KEY=<voice-provider-key>
```

## License

MIT

## Credits

Inspired by `cfngc4594/agent-notify`.
