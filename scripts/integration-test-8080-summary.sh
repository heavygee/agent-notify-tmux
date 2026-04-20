#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TRANSCRIPT="$(mktemp /tmp/agent-notify-int-transcript.XXXXXX.jsonl)"
STOP_LOG="/tmp/agent-notify-int-stop.log"
VOICE_LOG="/tmp/agent-notify-int-voice.log"
STDOUT="/tmp/agent-notify-int-script.stdout"
STDERR="/tmp/agent-notify-int-script.stderr"

cat > "$TRANSCRIPT" <<'JSONL'
{"role":"assistant","message":{"content":"Completed successfully."}}
JSONL

rm -f "$STOP_LOG" "$VOICE_LOG" "$STDOUT" "$STDERR"

(
  cd "$ROOT_DIR"
  AGENT_NOTIFY_SUMMARY_ENABLED=1 \
  AGENT_NOTIFY_TRANSCRIPT_PATH="$TRANSCRIPT" \
  AGENT_NOTIFY_DEBUG=1 \
  AGENT_NOTIFY_VOICE_DEBUG=1 \
  AGENT_NOTIFY_HOOK_DEBUG_FILE="$STOP_LOG" \
  AGENT_NOTIFY_VOICE_LOG_FILE="$VOICE_LOG" \
  AGENT_NOTIFY_SUMMARY_PRIMARY_URL="http://100.121.154.23:8080/v1/chat/completions" \
  AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL="qwen2.5-1.5b-instruct-q8_0" \
  AGENT_NOTIFY_SUMMARY_FALLBACK_URL="https://api.openai.com/v1/chat/completions" \
  AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL="gpt-5.4-mini" \
  AGENT_NOTIFY_AGENT_ID="integration-suite" \
  AGENT_NOTIFY_PROJECT="agent-notify-smoke-xxeA" \
  AGENT_NOTIFY_HOOK_EVENT_NAME="cursor-stop-integration" \
  AGENT_NOTIFY_HOOK_EVENT_SOURCE="integration-test" \
  AGENT_NOTIFY_VOICE_MODE="script" \
  AGENT_NOTIFY_VOICE_COMMAND="/bin/true" \
  AGENT_NOTIFY_VOICE_STRICT_VOICE=0 \
  AGENT_NOTIFY_ENV_FILE="/dev/null" \
  /home/heavygee/.local/bin/cursor-done-sound.sh >"$STDOUT" 2>"$STDERR"
)

status=$?

if [ $status -ne 0 ]; then
  echo "FAIL: cursor-done-sound exited with $status"
  echo "--- STDOUT ---"
  cat "$STDOUT" || true
  echo "--- STDERR ---"
  cat "$STDERR" || true
  exit 1
fi

echo "PASS: cursor-done-sound exited cleanly"

if grep -q "AGENT_NOTIFY_SUMMARY_SOURCE=llm-primary" "$STOP_LOG" && \
   grep -q "AGENT_NOTIFY_SUMMARY_URL=http://100.121.154.23:8080/v1/chat/completions" "$STOP_LOG" && \
   grep -q "AGENT_NOTIFY_SUMMARY_MODEL=qwen2.5-1.5b-instruct-q8_0" "$STOP_LOG"; then
  echo "PASS: primary summarizer call targeted /local-llm-appliance endpoint"
else
  echo "FAIL: primary summarizer endpoint/model not observed in stop log"
  echo "--- STOP LOG ---"
  cat "$STOP_LOG" || true
  exit 1
fi

echo "STOP LOG SLICES:"
grep -n "AGENT_NOTIFY_SUMMARY_SOURCE\\|AGENT_NOTIFY_SUMMARY_URL\\|AGENT_NOTIFY_SUMMARY_MODEL\\|AGENT_NOTIFY_SUMMARY_HTTP_STATUS\\|AGENT_NOTIFY_SUMMARY_SKIP_REASON" "$STOP_LOG" || true
echo "VOICE LOG SLICES:"
grep -n "AGENT_NOTIFY_VOICE_HTTP_STATUS\\|AGENT_NOTIFY_VOICE_TEXT" "$VOICE_LOG" || true

