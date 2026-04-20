## Cursor `hooks.json` truth (agent-notify)

Cursor expects `~/.cursor/hooks.json` in the top-level wrapped schema:

```json
{
  "version": 1,
  "hooks": {
    "stop": [
      {
        "command": "AGENT_NOTIFY_ENV_FILE=$HOME/.config/agent-notify/.env AGENT_NOTIFY_DEBUG=1 AGENT_NOTIFY_VOICE_DEBUG=1 AGENT_NOTIFY_VOICE_PLAYER=aplay AGENT_NOTIFY_VOICE_TIMEOUT=30 AGENT_NOTIFY_SUMMARY_ENABLED=1 AGENT_NOTIFY_SUMMARY_PRIMARY_URL=${AGENT_NOTIFY_SUMMARY_PRIMARY_URL:-http://100.121.154.23:8080/v1/chat/completions} AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL=${AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL:-qwen2.5-1.5b-instruct-q8_0} AGENT_NOTIFY_SUMMARY_FALLBACK_URL=${AGENT_NOTIFY_SUMMARY_FALLBACK_URL:-https://api.openai.com/v1/chat/completions} AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL=${AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL:-gpt-5.4-mini} AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY='${AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY:-${AGENT_NOTIFY_VOICE_API_KEY:-}}' ~/.local/bin/cursor-stop-wrapper.sh"
      }
    ]
  }
}
```

Notes:

- `version` must be numeric (`1`).
- `hooks` must be an object.
- `stop` must be an array of hook entries.
- Keep the command as a single JSON string and avoid unescaped internal quotes.

Validation:

```bash
jq . ~/.cursor/hooks.json
```

If you only need parser validation, this one line is the expected pass condition:

```bash
jq . ~/.cursor/hooks.json >/dev/null && echo "hooks.json OK"
```

