#!/bin/sh
# Manual test: TTS -> WAV -> aplay. Does NOT trigger Cursor stop hooks.
# Must run with a clean environment (no exported bash functions from a poisoned parent shell):
#   cd /path/to/agent-notify && env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/local/bin" sh ./scripts/verify-voice-chain.sh
set -eu
ENV_FILE="${AGENT_NOTIFY_ENV_FILE:-$HOME/.config/agent-notify/.env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi
URL="${AGENT_NOTIFY_VOICE_URL:-http://127.0.0.1:18008/v1/audio/speech}"
VOICE="${AGENT_NOTIFY_VOICE_VOICE:-xev}"
FMT="${AGENT_NOTIFY_VOICE_RESPONSE_FORMAT:-wav}"
OUT="/tmp/agent-notify-verify-manual.wav"
echo "curl -> $OUT -> aplay (args: ${AGENT_NOTIFY_VOICE_PLAYER_ARGS:-none})"
curl -m "${AGENT_NOTIFY_VOICE_TIMEOUT:-30}" -sS -o "$OUT" -X POST "$URL" \
  -H "Content-Type: application/json" \
  --data "$(printf '{"model":"kokoro","input":"Voice chain test.","voice":"%s","response_format":"%s"}' "$VOICE" "$FMT")"
ls -la "$OUT"
file "$OUT"
if [ -n "${AGENT_NOTIFY_VOICE_PLAYER_ARGS:-}" ]; then
  eval "aplay ${AGENT_NOTIFY_VOICE_PLAYER_ARGS} \"$OUT\""
else
  aplay "$OUT"
fi
