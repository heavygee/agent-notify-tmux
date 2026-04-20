# Voice hook regressions - how we left "shitty town"

This doc is the **aha** story plus a **release checklist** so we do not repeat silent failures.

## The aha (what actually broke)

Symptoms looked unrelated: no sound, logs stopping after `wrapper.start`, or TTS "succeeding" with no audio. The real causes were **small bash footguns**, not Cursor or the TTS server.

### 1. Wrong parameter expansion in generated shell (the big one)

Template code emitted **`$VAR:-}`** instead of **`${VAR:-}`** (missing `{` before the variable name). Bash then parses **`$VAR`** as a normal expansion and leaves **`:-}`** as literal junk, or under **`set -u`** treats **`$AGENT_NOTIFY_MODEL`** as an **unset variable** and **exits the wrapper** before `cursor-done-sound.sh` runs.

**Smoking gun in logs:** `cursor-stop-debug.log` shows **`wrapper.start`** then **`wrapper.complete`** with **no** `wrapper.payload`, **no** `wrapper.forward`, and **no** matching block in `cursor-voice-debug.log` for that `generation_id`.

**Prevention:** In `src/config/scripts.ts`, every `${'$'}{NAME:-...}` wrapper segment must expand to valid bash `${NAME:-...}`. Add tests that grep for `[ -z "${AGENT_NOTIFY_MODEL:-}" ]` (correct) and never `[ -z "$AGENT_NOTIFY_MODEL:-}" ]` (wrong).

### 2. `.env` values with spaces must be quoted

Lines like `AGENT_NOTIFY_VOICE_PLAYER_ARGS=-D plughw:1,0` or `FALLBACK_PLAYER_LIST=aplay paplay ffplay` are **not** one assignment. Bash sets the variable to the first word and tries to run the rest as **commands** when sourcing the file.

**Smoking gun:** Errors like `plughw:1,0: command not found` or `paplay: command not found` while loading `~/.config/agent-notify/.env`.

**Prevention:** Document in README; template in `scripts/deploy-cursor-local.ts` warns about quoting.

### 3. `jq` + `set -e` in the stop wrapper

If transcript contract extraction runs `jq` on a line that does not match the expected JSON shape, **`jq` exits non-zero** and the **whole wrapper exits** unless the pipeline is guarded with `2>/dev/null || true`.

**Prevention:** All optional `jq` parses in the wrapper use non-fatal exits.

### 4. ffplay "success" with no audible output

On headless or broken X, **ffplay** can exit **0** while stderr contains **`xcb_connection_has_error`**. You hear nothing.

**Prevention:** Prefer **`aplay` / `paplay` before** ffmpeg-family players for all formats; treat ffplay exit 0 + xcb stderr as **failure** and try the next player.

### 5. Invalid `${#var:-default}` (length + default)

Bash does **not** support combining string length **`${#var}`** with default **`:-`** in one expansion. That yields **`bad substitution`**.

**Prevention:** Use a separate variable, e.g. `len="${#var}"`, then log `len`. Tests reject `#__agent_notify_last_asst:-` in generated `cursor-done-sound.sh`.

### 6. Stale `AGENT_NOTIFY_SUMMARY` from an earlier turn (not the latest assistant)

**Problem:** Scanning the whole transcript for `AGENT_NOTIFY_SUMMARY` and taking the **last matching line** still picks an **old** contract if **later** assistant turns did **not** repeat the substring. The user hears or sees metadata from a completed step, not the final assistant output.

**Fix:** Extract **last assistant plain text** with the same `jq` program as `cursor-done-sound.sh` (`tail -n $AGENT_NOTIFY_LAST_ASSISTANT_TAIL_LINES` then `jq -R -s -r '...'`). Parse `AGENT_NOTIFY_SUMMARY {...}` **only** from that text. Log `summary_source=transcript_last_assistant_contract`. If there is no JSON in the latest assistant text, the wrapper leaves contract fields empty and **`cursor-done-sound.sh`** uses LLM / markers on recent content.

**Prevention:** Tests assert `transcript_last_assistant_contract` and `AGENT_NOTIFY_LAST_ASSISTANT_TAIL_LINES` appear in the generated wrapper; there is no full-file `rg "AGENT_NOTIFY_SUMMARY"` path anymore.

## Logs that prove health (post-fix)

For a real agent stop you want to see:

**`~/.local/state/agent-notify/cursor-stop-debug.log`**

- `event=cursor.stop.wrapper.forward`
- `notify_script=.../cursor-done-sound.sh`
- Later: `event=cursor.stop.wrapper.complete` with `notify_exit=0`

**`~/.local/state/agent-notify/cursor-voice-debug.log`**

- `event=cursor.tts.curl.result` with `http_status=200` (or your gateway success)
- `event=cursor.tts.player.order reason=alsa_before_ffmpeg` (or your configured order)
- `stderr=Playing WAVE ...` from **aplay** (or your device)
- `event=cursor.tts.dispatch.result player=aplay player_code=0`

## Release checklist (before you say "done")

1. `bun test` - includes assertions on wrapper and cursor script strings.
2. `bun scripts/deploy-cursor-local.ts` - refresh `~/.local/bin` and hooks.
3. `bun run verify:voice` (or project voice verify) with a **clean environment** if your login shell poisons `bun` (e.g. `env -i HOME=$HOME PATH=... bun run verify:voice`).
4. One manual stop: grep both logs for the latest `generation_id` and confirm TTS + `aplay` lines above.

## Related README sections

- `README.md` - troubleshooting for voice, `.env` quoting, stale wrapper, ffplay/xcb.
