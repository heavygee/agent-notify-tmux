import type { SoundName, Platform } from "../types";
import { t } from "../i18n";

/** Ntfy configuration */
export interface NtfyConfig {
  url: string;
  topic: string;
}

/** Feature toggle options */
export interface FeatureOptions {
  sound: boolean;
  notification: boolean;
  voice: boolean;
  tmux: boolean;
  ntfy: boolean;
  ntfyConfig?: NtfyConfig;
}

/** Script config metadata */
interface ScriptConfig {
  readonly name: string;
  readonly defaultSound: SoundName;
  readonly commentKey: "commentDone" | "cursorCommentDone";
  readonly promptKey: "soundDone";
  readonly notifyTitleKey: "notifyTitleDone" | "cursorNotifyTitleDone";
  readonly notifyMsgKey: "notifyMsgDone" | "cursorNotifyMsgDone";
  readonly sayKey: "sayDone" | "cursorSayDone";
}

/** Claude Code script config template (only done/stop event) */
const CLAUDE_SCRIPT_CONFIG_TEMPLATES = [
  {
    name: "claude-done-sound.sh",
    defaultSound: "Glass",
    commentKey: "commentDone",
    promptKey: "soundDone",
    notifyTitleKey: "notifyTitleDone",
    notifyMsgKey: "notifyMsgDone",
    sayKey: "sayDone",
  },
] as const satisfies readonly ScriptConfig[];

/** Cursor script config template (only done/stop event) */
const CURSOR_SCRIPT_CONFIG_TEMPLATES = [
  {
    name: "cursor-done-sound.sh",
    defaultSound: "Glass",
    commentKey: "cursorCommentDone",
    promptKey: "soundDone",
    notifyTitleKey: "cursorNotifyTitleDone",
    notifyMsgKey: "cursorNotifyMsgDone",
    sayKey: "cursorSayDone",
  },
] as const satisfies readonly ScriptConfig[];

const DEFAULT_VOICE_COMMAND = "$HOME/coding/server-setup/.cursor/rules/system-voice.mdc";
/** OpenAI-local stack is the expected default; `script` was a legacy footgun when .env failed to load. */
const DEFAULT_VOICE_MODE = "local";
const DEFAULT_VOICE_STACK_URL = "http://localhost:18008/v1/audio/speech";
const DEFAULT_VOICE_OPENAI_URL = "https://api.openai.com/v1/audio/speech";
const DEFAULT_VOICE_MODEL = "tts-1";
const DEFAULT_VOICE_NAME = "xev";
const DEFAULT_VOICE_RESPONSE_FORMAT = "mp3";
const TMUX_MARQUEE_WIDTH = 28;
const TMUX_MARQUEE_STEPS = 24;
const DEFAULT_SESSION_CONTEXT_TOOL = "agent-notify-session-context.sh";

/** jq -R -s -r body (bash single-quoted): last assistant plain text from Cursor-style JSONL
 *  Works when lines are JSON objects and assistant turns match `.role=="assistant"` or nested `message.role`.
 *  Empty when: schema differs, file missing/empty, transcript_path unset, or last assistant turn is tools-only with no text. */
const CURSOR_JSONL_LAST_ASSISTANT_JQ_FILTER =
  'split("\\n") | map(select(length>0) | try fromjson catch empty) | map(select(type=="object")) | map(select((.role=="assistant") or ((.message|type)=="object" and (.message.role=="assistant")))) | .[-1] | if .==null then empty else ((.message.content // .content // empty) | if type=="string" then . elif type=="array" then ([.[] | if type=="object" then (.text? // .content? // empty) elif type=="string" then . else empty end] | map(select(type=="string")) | join(" ")) else empty end) end';

export const CURSOR_STOP_WRAPPER_NAME = "cursor-stop-wrapper.sh";
export const CURSOR_SESSION_CONTEXT_TOOL_NAME = DEFAULT_SESSION_CONTEXT_TOOL;

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

/** Add voice announcement logic with optional modes:
 * - script: run legacy local command (DEFAULT_VOICE_COMMAND)
 * - local: call OpenAI-compatible speech endpoint (default local speech stack)
 * - openai: call OpenAI-compatible speech endpoint with API key support
 */
function addVoiceAnnouncement(lines: string[], sayText: string, isCursor = false) {
  lines.push("# Voice announcement");
  if (isCursor) {
    lines.push('AGENT_NOTIFY_ENV_FILE="${AGENT_NOTIFY_ENV_FILE:-$HOME/.config/agent-notify/.env}"');
    lines.push('if [ -f "${AGENT_NOTIFY_ENV_FILE}" ]; then');
    lines.push("  set -a");
    lines.push('  . "${AGENT_NOTIFY_ENV_FILE}"');
    lines.push("  set +a");
    lines.push("fi");
  }
  lines.push(`AGENT_NOTIFY_VOICE_MODE="${'$'}{AGENT_NOTIFY_VOICE_MODE:-${DEFAULT_VOICE_MODE}}"`);
  lines.push(`AGENT_NOTIFY_VOICE_URL="${'$'}{AGENT_NOTIFY_VOICE_URL:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_MODEL="${'$'}{AGENT_NOTIFY_VOICE_MODEL:-${DEFAULT_VOICE_MODEL}}"`);
  lines.push(`AGENT_NOTIFY_VOICE_COMMAND="${'$'}{AGENT_NOTIFY_VOICE_COMMAND:-${DEFAULT_VOICE_COMMAND}}"`);
  lines.push(`AGENT_NOTIFY_VOICE_VOICE="${'$'}{AGENT_NOTIFY_VOICE_VOICE:-${DEFAULT_VOICE_NAME}}"`);
  lines.push(`AGENT_NOTIFY_VOICE_RESPONSE_FORMAT="${'$'}{AGENT_NOTIFY_VOICE_RESPONSE_FORMAT:-${DEFAULT_VOICE_RESPONSE_FORMAT}}"`);
  lines.push(`AGENT_NOTIFY_VOICE_EXAGGERATION="${'$'}{AGENT_NOTIFY_VOICE_EXAGGERATION:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_CFG_WEIGHT="${'$'}{AGENT_NOTIFY_VOICE_CFG_WEIGHT:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_TEMPERATURE="${'$'}{AGENT_NOTIFY_VOICE_TEMPERATURE:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_TOP_P="${'$'}{AGENT_NOTIFY_VOICE_TOP_P:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_MIN_P="${'$'}{AGENT_NOTIFY_VOICE_MIN_P:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_REPETITION_PENALTY="${'$'}{AGENT_NOTIFY_VOICE_REPETITION_PENALTY:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_STREAM_FORMAT="${'$'}{AGENT_NOTIFY_VOICE_STREAM_FORMAT:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_STREAMING_QUALITY="${'$'}{AGENT_NOTIFY_VOICE_STREAMING_QUALITY:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_STREAMING_STRATEGY="${'$'}{AGENT_NOTIFY_VOICE_STREAMING_STRATEGY:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_STREAMING_CHUNK_SIZE="${'$'}{AGENT_NOTIFY_VOICE_STREAMING_CHUNK_SIZE:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_STREAMING_BUFFER_SIZE="${'$'}{AGENT_NOTIFY_VOICE_STREAMING_BUFFER_SIZE:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_TIMEOUT="${'$'}{AGENT_NOTIFY_VOICE_TIMEOUT:-6}"`);
  lines.push(`AGENT_NOTIFY_VOICE_PLAYER="${'$'}{AGENT_NOTIFY_VOICE_PLAYER:-aplay,paplay,ffplay,mpv,mpg123}"`);
  lines.push(`AGENT_NOTIFY_VOICE_PLAYER_ARGS="${'$'}{AGENT_NOTIFY_VOICE_PLAYER_ARGS:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_FALLBACK_WAV="${'$'}{AGENT_NOTIFY_VOICE_FALLBACK_WAV:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_FALLBACK_WAV_PLAY="${'$'}{AGENT_NOTIFY_VOICE_FALLBACK_WAV_PLAY:-0}"`);
  lines.push(`AGENT_NOTIFY_VOICE_LOG_FILE="${'$'}{AGENT_NOTIFY_VOICE_LOG_FILE:-${'$'}{AGENT_NOTIFY_HOOK_DEBUG_FILE:-$HOME/.local/state/agent-notify/cursor-voice-debug.log}}"`);
  lines.push("AGENT_NOTIFY_VOICE_LOG_FILE=\"${AGENT_NOTIFY_VOICE_LOG_FILE:-}\"");
  lines.push("__agent_notify_voice_log_file=\"${AGENT_NOTIFY_VOICE_LOG_FILE:-}\"");
  lines.push("__agent_notify_voice_log() {");
  lines.push("  if [ -n \"${__agent_notify_voice_log_file:-}\" ]; then");
  lines.push("    printf \"%s\\n\" \"$1\" >> \"$__agent_notify_voice_log_file\"");
  lines.push("  fi");
  lines.push("}");
  lines.push('__agent_notify_voice_log "event=cursor.tts.dispatch.start"');
  lines.push('__agent_notify_voice_log "event_id=${AGENT_NOTIFY_EVENT_ID:-}"');
  lines.push('__agent_notify_voice_log "mode=${AGENT_NOTIFY_VOICE_MODE:-}"');
  lines.push('__agent_notify_voice_log "url=${AGENT_NOTIFY_VOICE_URL:-}"');
  lines.push('__agent_notify_voice_log "voice=${AGENT_NOTIFY_VOICE_VOICE:-}"');
  lines.push('__agent_notify_voice_log "player=${AGENT_NOTIFY_VOICE_PLAYER:-}"');
  lines.push('__agent_notify_voice_log "agent=${AGENT_NOTIFY_AGENT_ID:-}"');
  lines.push('__agent_notify_voice_log "project=${AGENT_NOTIFY_PROJECT:-}"');
  lines.push('__agent_notify_voice_log "model=${AGENT_NOTIFY_MODEL:-}"');
  lines.push(`AGENT_NOTIFY_VOICE_INCLUDE_CONTEXT="${'$'}{AGENT_NOTIFY_VOICE_INCLUDE_CONTEXT:-1}"`);
  lines.push(`AGENT_NOTIFY_VOICE_STRICT_VOICE="${'$'}{AGENT_NOTIFY_VOICE_STRICT_VOICE:-0}"`);
  // Spoken line prefers contract `action` over `summary`; task slot uses `status` only (never the long action string).
  lines.push('AGENT_NOTIFY_VOICE_DISPATCH_MODE="${AGENT_NOTIFY_VOICE_DISPATCH_MODE:-${AGENT_NOTIFY_VOICE_MODE:-local}}"');
  lines.push("__agent_notify_voice_tts_played=0");
  if (isCursor) {
  lines.push('AGENT_NOTIFY_PROVIDER="${AGENT_NOTIFY_PROVIDER:-cursor}"');
  lines.push('export AGENT_NOTIFY_PROVIDER');
  lines.push('__agent_notify_summary_debug() {');
  lines.push('  if [ -n "${AGENT_NOTIFY_HOOK_DEBUG_FILE:-}" ]; then');
  lines.push('    printf "%s\\n" "$1" >> "$AGENT_NOTIFY_HOOK_DEBUG_FILE"');
  lines.push('  else');
  lines.push('    __agent_notify_voice_log "$1"');
  lines.push('  fi');
  lines.push('}');
  lines.push('__agent_notify_last_asst=""');
  lines.push(
    'if [ -n "${AGENT_NOTIFY_TRANSCRIPT_PATH:-}" ] && [ -s "${AGENT_NOTIFY_TRANSCRIPT_PATH}" ] && command -v jq >/dev/null 2>&1; then',
  );
  lines.push('  AGENT_NOTIFY_SUMMARY_MAX_USER_BYTES="${AGENT_NOTIFY_SUMMARY_MAX_USER_BYTES:-524288}"');
  lines.push(
    '  __agent_notify_last_asst="$(tail -n 500 "${AGENT_NOTIFY_TRANSCRIPT_PATH}" 2>/dev/null | jq -R -s -r \'' +
      CURSOR_JSONL_LAST_ASSISTANT_JQ_FILTER +
      '\' 2>/dev/null | head -c "${AGENT_NOTIFY_SUMMARY_MAX_USER_BYTES:-524288}" | tr -s \'[:space:]\' \' \' | sed \'s/^[[:space:]]*//;s/[[:space:]]*$//\')"',
  );
  lines.push(
    '  __agent_notify_last_asst_len="${#__agent_notify_last_asst}"',
  );
  lines.push(
    '  __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_LAST_ASSISTANT_LEN=${__agent_notify_last_asst_len}"',
  );
  lines.push('fi');
  lines.push('if [ "${AGENT_NOTIFY_SUMMARY_ENABLED:-1}" != "0" ] && [ -z "${AGENT_NOTIFY_STOP_ACTION:-}" ] && [ -z "${AGENT_NOTIFY_SUMMARY_TEXT:-}" ] && [ -n "${AGENT_NOTIFY_TRANSCRIPT_PATH:-}" ] && [ -s "${AGENT_NOTIFY_TRANSCRIPT_PATH}" ] && command -v curl >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then');
  lines.push('  __agent_notify_tblob="$(tail -n 320 "${AGENT_NOTIFY_TRANSCRIPT_PATH}" 2>/dev/null | tr "\\n" " " | tr -s " ")"');
  lines.push('  AGENT_NOTIFY_SUMMARY_TIMEOUT="${AGENT_NOTIFY_SUMMARY_TIMEOUT:-30}"');
  lines.push('  AGENT_NOTIFY_SUMMARY_PRIMARY_URL="${AGENT_NOTIFY_SUMMARY_PRIMARY_URL:-http://100.121.154.23:8080/v1/chat/completions}"');
  lines.push('  AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL="${AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL:-qwen2.5-1.5b-instruct-q8_0}"');
  lines.push(
    '  AGENT_NOTIFY_SUMMARY_FALLBACK_URL="${AGENT_NOTIFY_SUMMARY_FALLBACK_URL:-https://api.openai.com/v1/chat/completions}"',
  );
  lines.push('  AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL="${AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL:-gpt-5.4-mini}"');
  lines.push('  AGENT_NOTIFY_SUMMARY_INPUT_MODE="${AGENT_NOTIFY_SUMMARY_INPUT_MODE:-last_assistant}"');
  lines.push('  if [ "$AGENT_NOTIFY_SUMMARY_INPUT_MODE" = "tail320" ] || [ -z "${__agent_notify_last_asst:-}" ]; then');
  lines.push('    __agent_notify_sum_llm_input="$__agent_notify_tblob"');
  lines.push('    __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_LLM_INPUT_MODE=tail320"');
  lines.push('  else');
  lines.push('    __agent_notify_sum_llm_input="$__agent_notify_last_asst"');
  lines.push('    __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_LLM_INPUT_MODE=last_assistant"');
  lines.push('  fi');
  lines.push('  AGENT_NOTIFY_SUMMARY_MAX_USER_BYTES="${AGENT_NOTIFY_SUMMARY_MAX_USER_BYTES:-524288}"');
  lines.push('  __agent_notify_sum_ufile="$(mktemp /tmp/agent-notify-sum-user.XXXXXX.txt)"');
  lines.push('  __agent_notify_sum_req="$(mktemp /tmp/agent-notify-summary-req.XXXXXX.json)"');
  lines.push('  {');
  lines.push('    printf "%s\\n" "${AGENT_NOTIFY_SUMMARY_CONTEXT_PREFIX:-Final assistant message follows. Summarize for spoken notification.}"');
  lines.push('    printf "%s" "$__agent_notify_sum_llm_input" | head -c "${AGENT_NOTIFY_SUMMARY_MAX_USER_BYTES:-524288}"');
  lines.push('  } > "$__agent_notify_sum_ufile" 2>/dev/null');
  lines.push(
    '  __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_USER_FILE_BYTES=$(wc -c < "$__agent_notify_sum_ufile" 2>/dev/null || echo 0)"',
  );
  lines.push(
    '  __agent_notify_sum_sys="You summarize ONLY the final assistant message below for a spoken stop notification. One short sentence: what was completed and what the user should do next. Do not invent tools, files, or steps not present in the text. If the text is a protocol line (for example AGENT_NOTIFY_SUMMARY JSON), say what it means in plain language."',
  );
  lines.push('  __agent_notify_sum_payload_ok=0');
  lines.push(
    '  if jq -n --arg m "${AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL}" --arg s "$__agent_notify_sum_sys" --rawfile u "$__agent_notify_sum_ufile" ' +
      "'{model:$m,messages:[{role:\"system\",content:$s},{role:\"user\",content:$u}],temperature:0.2}'" +
      ' > "$__agent_notify_sum_req" 2>/dev/null && [ -s "$__agent_notify_sum_req" ]; then',
  );
  lines.push('    __agent_notify_sum_payload_ok=1');
  lines.push('  else');
  lines.push('    __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_SKIP_REASON=jq_primary_payload_empty"');
  lines.push('  fi');
  lines.push('  __agent_notify_sum_tmp="$(mktemp /tmp/agent-notify-summary.XXXXXX.json)"');
  lines.push('  __agent_notify_sum_http=""');
  lines.push('  __agent_notify_sum_auth_primary="${AGENT_NOTIFY_SUMMARY_PRIMARY_API_KEY:-}"');
  lines.push(
    '  if [ -z "$__agent_notify_sum_auth_primary" ] && printf "%s" "${AGENT_NOTIFY_SUMMARY_PRIMARY_URL:-}" | grep -qE "api\\.openai\\.com"; then',
  );
  lines.push(
    '    __agent_notify_sum_auth_primary="${AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY:-${AGENT_NOTIFY_VOICE_API_KEY:-}}"',
  );
  lines.push('  fi');
  lines.push('  if [ "$__agent_notify_sum_payload_ok" -eq 1 ] && [ -n "${AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL:-}" ]; then');
  lines.push('    if [ -n "$__agent_notify_sum_auth_primary" ]; then');
  lines.push(
    '      __agent_notify_sum_http="$(curl --connect-timeout 5 -m "$AGENT_NOTIFY_SUMMARY_TIMEOUT" -sS -w "%{http_code}" -o "$__agent_notify_sum_tmp" -X POST "$AGENT_NOTIFY_SUMMARY_PRIMARY_URL" -H "Content-Type: application/json" -H "Authorization: Bearer ${__agent_notify_sum_auth_primary}" --data-binary "@$__agent_notify_sum_req" 2>/dev/null || true)"',
  );
  lines.push('    else');
  lines.push(
    '      __agent_notify_sum_http="$(curl --connect-timeout 5 -m "$AGENT_NOTIFY_SUMMARY_TIMEOUT" -sS -w "%{http_code}" -o "$__agent_notify_sum_tmp" -X POST "$AGENT_NOTIFY_SUMMARY_PRIMARY_URL" -H "Content-Type: application/json" --data-binary "@$__agent_notify_sum_req" 2>/dev/null || true)"',
  );
  lines.push('    fi');
  lines.push('  fi');
  lines.push('  __agent_notify_sum_txt=""');
  lines.push('  if printf "%s" "${__agent_notify_sum_http:-}" | grep -qE \'^[23][0-9][0-9]$\' 2>/dev/null && [ -s "$__agent_notify_sum_tmp" ]; then');
  lines.push('    __agent_notify_sum_txt="$(jq -r \'(.choices[0].message.content // .choices[0].message.reasoning // empty)\' < "$__agent_notify_sum_tmp" 2>/dev/null || true)"');
  lines.push('  fi');
  lines.push('  if [ -n "$__agent_notify_sum_txt" ]; then');
  lines.push('    AGENT_NOTIFY_SUMMARY_TEXT="$(printf "%s" "$__agent_notify_sum_txt" | tr "\\n" " " | sed "s/^[[:space:]]*//;s/[[:space:]]*$//")"');
  lines.push('    export AGENT_NOTIFY_SUMMARY_TEXT');
  lines.push('    __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_SOURCE=llm-primary"');
  lines.push('    __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_URL=${AGENT_NOTIFY_SUMMARY_PRIMARY_URL}"');
  lines.push('    __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_MODEL=${AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL}"');
  lines.push('    __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_HTTP_STATUS=${__agent_notify_sum_http}"');
  lines.push('  elif [ -n "${AGENT_NOTIFY_SUMMARY_FALLBACK_URL:-}" ] && [ -n "${AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL:-}" ]; then');
  lines.push('    __agent_notify_sum_payload_ok=0');
  lines.push(
    '    if jq -n --arg m "${AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL}" --arg s "$__agent_notify_sum_sys" --rawfile u "$__agent_notify_sum_ufile" ' +
      "'{model:$m,messages:[{role:\"system\",content:$s},{role:\"user\",content:$u}],temperature:0.2}'" +
      ' > "$__agent_notify_sum_req" 2>/dev/null && [ -s "$__agent_notify_sum_req" ]; then',
  );
  lines.push('      __agent_notify_sum_payload_ok=1');
  lines.push('    else');
  lines.push('      __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_SKIP_REASON=jq_fallback_payload_empty"');
  lines.push('    fi');
  lines.push('    if [ "$__agent_notify_sum_payload_ok" -eq 1 ]; then');
    lines.push('      if [ -n "${AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY:-${AGENT_NOTIFY_VOICE_API_KEY:-}}" ]; then');
  lines.push(
    '        __agent_notify_sum_http="$(curl --connect-timeout 5 -m "$AGENT_NOTIFY_SUMMARY_TIMEOUT" -sS -w "%{http_code}" -o "$__agent_notify_sum_tmp" -X POST "$AGENT_NOTIFY_SUMMARY_FALLBACK_URL" -H "Content-Type: application/json" -H "Authorization: Bearer ${AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY:-${AGENT_NOTIFY_VOICE_API_KEY:-}}" --data-binary "@$__agent_notify_sum_req" 2>/dev/null || true)"',
  );
  lines.push('      else');
  lines.push(
    '        __agent_notify_sum_http="$(curl --connect-timeout 5 -m "$AGENT_NOTIFY_SUMMARY_TIMEOUT" -sS -w "%{http_code}" -o "$__agent_notify_sum_tmp" -X POST "$AGENT_NOTIFY_SUMMARY_FALLBACK_URL" -H "Content-Type: application/json" --data-binary "@$__agent_notify_sum_req" 2>/dev/null || true)"',
  );
  lines.push('      fi');
  lines.push('      if printf "%s" "${__agent_notify_sum_http:-}" | grep -qE \'^[23][0-9][0-9]$\' 2>/dev/null && [ -s "$__agent_notify_sum_tmp" ]; then');
  lines.push('        __agent_notify_sum_txt="$(jq -r \'(.choices[0].message.content // .choices[0].message.reasoning // empty)\' < "$__agent_notify_sum_tmp" 2>/dev/null || true)"');
  lines.push('      fi');
  lines.push('      if [ -n "$__agent_notify_sum_txt" ]; then');
  lines.push('        AGENT_NOTIFY_SUMMARY_TEXT="$(printf "%s" "$__agent_notify_sum_txt" | tr "\\n" " " | sed "s/^[[:space:]]*//;s/[[:space:]]*$//")"');
  lines.push('        export AGENT_NOTIFY_SUMMARY_TEXT');
  lines.push('        __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_SOURCE=llm-fallback"');
  lines.push('        __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_URL=${AGENT_NOTIFY_SUMMARY_FALLBACK_URL}"');
  lines.push('        __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_MODEL=${AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL}"');
  lines.push('        __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_HTTP_STATUS=${__agent_notify_sum_http}"');
  lines.push('      else');
  lines.push('        __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_SKIP_REASON=llm_fallback_failed"');
  lines.push('        __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_HTTP_STATUS=${__agent_notify_sum_http:-none}"');
  lines.push('      fi');
  lines.push('    fi');
  lines.push('  else');
  lines.push('    __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_SKIP_REASON=llm_primary_failed_or_no_model"');
  lines.push('    __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_HTTP_STATUS=${__agent_notify_sum_http:-none}"');
  lines.push('  fi');
  lines.push('  rm -f "$__agent_notify_sum_ufile" "$__agent_notify_sum_req" "$__agent_notify_sum_tmp"');
  lines.push('fi');
  lines.push(
    'if [ -z "${AGENT_NOTIFY_STOP_ACTION:-}" ] && [ -z "${AGENT_NOTIFY_SUMMARY_TEXT:-}" ] && [ -n "${__agent_notify_last_asst:-}" ] && [ "${#__agent_notify_last_asst}" -ge 3 ]; then',
  );
  lines.push('  AGENT_NOTIFY_SUMMARY_TEXT="${__agent_notify_last_asst}"');
  lines.push('  export AGENT_NOTIFY_SUMMARY_TEXT');
  lines.push('  __agent_notify_summary_debug "AGENT_NOTIFY_SUMMARY_SOURCE=transcript-tail"');
  lines.push('fi');
  lines.push('__agent_notify_voice_body=""');
  lines.push('if [ -n "${AGENT_NOTIFY_STOP_ACTION:-}" ]; then');
  lines.push('  __agent_notify_voice_body="${AGENT_NOTIFY_STOP_ACTION}"');
  lines.push('elif [ -n "${AGENT_NOTIFY_SUMMARY_TEXT:-}" ]; then');
  lines.push('  __agent_notify_voice_body="${AGENT_NOTIFY_SUMMARY_TEXT}"');
  lines.push('fi');
  lines.push('__agent_notify_voice_task_state="${AGENT_NOTIFY_STATUS:-completed}"');
  lines.push('if [ "$__agent_notify_voice_task_state" = "noop" ] || [ -z "$__agent_notify_voice_task_state" ]; then');
  lines.push('  __agent_notify_voice_task_state="completed"');
  lines.push('fi');
  lines.push('__agent_notify_voice_task_state="${__agent_notify_voice_task_state//_/ }"');
  lines.push('AGENT_NOTIFY_VOICE_TEXT=""');
  lines.push('if [ "${AGENT_NOTIFY_VOICE_INCLUDE_CONTEXT:-1}" != "0" ]; then');
  lines.push('  if [ -n "${__agent_notify_voice_body:-}" ]; then');
  lines.push(
    '    __agent_notify_voice_summary_context="provider ${AGENT_NOTIFY_PROVIDER:-cursor}, task ${__agent_notify_voice_task_state}"',
  );
  lines.push(
    '    [ -n "${AGENT_NOTIFY_PROJECT:-}" ] && __agent_notify_voice_summary_context="${__agent_notify_voice_summary_context}, project ${AGENT_NOTIFY_PROJECT}"',
  );
  lines.push('    AGENT_NOTIFY_VOICE_TEXT="${__agent_notify_voice_summary_context}, action: ${__agent_notify_voice_body}"');
  lines.push('  fi');
  lines.push('else');
  lines.push('  if [ -n "${__agent_notify_voice_body:-}" ]; then');
  lines.push('    AGENT_NOTIFY_VOICE_TEXT="${__agent_notify_voice_body}"');
  lines.push('  fi');
  lines.push('fi');
  lines.push('if [ -n "${AGENT_NOTIFY_VOICE_TEXT:-}" ]; then');
  lines.push('  AGENT_NOTIFY_VOICE_TEXT="${AGENT_NOTIFY_VOICE_TEXT//$\'\\n\'/ }"');
  lines.push('  AGENT_NOTIFY_VOICE_TEXT="${AGENT_NOTIFY_VOICE_TEXT//$\'\\r\'/ }"');
  lines.push('  AGENT_NOTIFY_NOTIFY_MSG="${AGENT_NOTIFY_VOICE_TEXT}"');
  lines.push("fi");
  lines.push('AGENT_NOTIFY_NOTIFY_MSG="${AGENT_NOTIFY_NOTIFY_MSG//$\'\\n\'/ }"');
  lines.push('AGENT_NOTIFY_NOTIFY_MSG="${AGENT_NOTIFY_NOTIFY_MSG//$\'\\r\'/ }"');
  lines.push('AGENT_NOTIFY_NOTIFY_MSG="${AGENT_NOTIFY_NOTIFY_MSG//$\'\\t\'/ }"');
  lines.push('__agent_notify_voice_log "event=cursor.tts.request"');
  lines.push('__agent_notify_voice_log "AGENT_NOTIFY_VOICE_DISPATCH_MODE=${AGENT_NOTIFY_VOICE_DISPATCH_MODE}"');
  lines.push('__agent_notify_voice_log "AGENT_NOTIFY_VOICE_URL=${AGENT_NOTIFY_VOICE_URL}"');
  lines.push('__agent_notify_voice_log "AGENT_NOTIFY_VOICE_TEXT=${AGENT_NOTIFY_VOICE_TEXT}"');
  lines.push('__agent_notify_voice_log "event=cursor.tts.voice_text.after_summary AGENT_NOTIFY_VOICE_TEXT=${AGENT_NOTIFY_VOICE_TEXT}"');
  }
  lines.push("");
  lines.push('if [ -n "${AGENT_NOTIFY_VOICE_TEXT:-}" ]; then');
  lines.push('if [ "$AGENT_NOTIFY_VOICE_MODE" = "script" ]; then');
  lines.push('  __agent_notify_voice_script_ec=127');
  lines.push("  if [ -x \"${AGENT_NOTIFY_VOICE_COMMAND}\" ]; then");
  lines.push('    if "${AGENT_NOTIFY_VOICE_COMMAND}" "${AGENT_NOTIFY_VOICE_TEXT}"; then');
  lines.push("      __agent_notify_voice_script_ec=0");
  lines.push("    else");
  lines.push("      __agent_notify_voice_script_ec=$?");
  lines.push("    fi");
  lines.push("  elif command -v \"${AGENT_NOTIFY_VOICE_COMMAND}\" >/dev/null 2>&1; then");
  lines.push('    if sh "${AGENT_NOTIFY_VOICE_COMMAND}" "${AGENT_NOTIFY_VOICE_TEXT}"; then');
  lines.push("      __agent_notify_voice_script_ec=0");
  lines.push("    else");
  lines.push("      __agent_notify_voice_script_ec=$?");
  lines.push("    fi");
  lines.push("  fi");
  lines.push('  [ "${__agent_notify_voice_script_ec:-127}" -eq 0 ] && __agent_notify_voice_tts_played=1');
  lines.push(
    '  __agent_notify_voice_log "event=cursor.tts.script.exit ec=${__agent_notify_voice_script_ec:-127} tts_played=${__agent_notify_voice_tts_played:-0}"',
  );
  lines.push("else");
  lines.push("  if [ -z \"$AGENT_NOTIFY_VOICE_URL\" ]; then");
  lines.push("    if [ \"$AGENT_NOTIFY_VOICE_MODE\" = \"openai\" ]; then");
  lines.push(`      AGENT_NOTIFY_VOICE_URL=${shellSingleQuote(DEFAULT_VOICE_OPENAI_URL)}`);
  lines.push("    else");
  lines.push(`      AGENT_NOTIFY_VOICE_URL=${shellSingleQuote(DEFAULT_VOICE_STACK_URL)}`);
  lines.push("    fi");
  lines.push("  fi");
  lines.push("  if [ \"$AGENT_NOTIFY_VOICE_URL\" = \"http://localhost:18008/v1/audio/speech\" ] && ( [ -n \"${AGENT_NOTIFY_VOICE_STREAM_FORMAT:-}\" ] || [ -n \"${AGENT_NOTIFY_VOICE_STREAMING_QUALITY:-}\" ] || [ -n \"${AGENT_NOTIFY_VOICE_STREAMING_STRATEGY:-}\" ] || [ -n \"${AGENT_NOTIFY_VOICE_STREAMING_CHUNK_SIZE:-}\" ] || [ -n \"${AGENT_NOTIFY_VOICE_STREAMING_BUFFER_SIZE:-}\" ] ); then");
  lines.push('    AGENT_NOTIFY_VOICE_URL="http://localhost:18008/v1/audio/speech/stream"');
  lines.push("  fi");
  lines.push("  __agent_notify_voice_is_stream_endpoint=\"0\"");
  lines.push("  case \"$AGENT_NOTIFY_VOICE_URL\" in");
  lines.push("    http://localhost:18008/v1/audio/speech/stream) __agent_notify_voice_is_stream_endpoint=\"1\" ;;");
  lines.push("  esac");
  lines.push("  if [ \"$__agent_notify_voice_is_stream_endpoint\" != \"1\" ]; then");
  lines.push("    AGENT_NOTIFY_VOICE_STREAM_FORMAT=\"\"");
  lines.push("    AGENT_NOTIFY_VOICE_STREAMING_QUALITY=\"\"");
  lines.push("    AGENT_NOTIFY_VOICE_STREAMING_STRATEGY=\"\"");
  lines.push("    AGENT_NOTIFY_VOICE_STREAMING_CHUNK_SIZE=\"\"");
  lines.push("    AGENT_NOTIFY_VOICE_STREAMING_BUFFER_SIZE=\"\"");
  lines.push("  fi");
  lines.push("  if command -v curl >/dev/null 2>&1; then");
  lines.push("    __agent_notify_voice_ext=\"${AGENT_NOTIFY_VOICE_RESPONSE_FORMAT}\"");
  lines.push("    __agent_notify_voice_tmp_body=$(mktemp /tmp/agent-notify-voice-body.XXXXXX.json)");
  lines.push("    __agent_notify_voice_tmp_file=$(mktemp /tmp/agent-notify-voice.XXXXXX.${__agent_notify_voice_ext})");
  lines.push("    if command -v jq >/dev/null 2>&1; then");
  lines.push("      __agent_notify_voice_model_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_MODEL:-tts-1}\" | jq -Rs .)\"");
  lines.push("      __agent_notify_voice_input_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_TEXT:-}\" | jq -Rs .)\"");
  lines.push("      __agent_notify_voice_voice_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_VOICE:-}\" | jq -Rs .)\"");
  lines.push("      __agent_notify_voice_format_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_RESPONSE_FORMAT:-mp3}\" | jq -Rs .)\"");
  lines.push("      __agent_notify_voice_extra_fields=\"\"");
  lines.push("      __agent_notify_voice_exaggeration_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_EXAGGERATION:-}\" | jq -Rs 'try (tonumber) catch empty')\"");
  lines.push("      __agent_notify_voice_cfg_weight_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_CFG_WEIGHT:-}\" | jq -Rs 'try (tonumber) catch empty')\"");
  lines.push("      __agent_notify_voice_temperature_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_TEMPERATURE:-}\" | jq -Rs 'try (tonumber) catch empty')\"");
  lines.push("      __agent_notify_voice_top_p_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_TOP_P:-}\" | jq -Rs 'try (tonumber) catch empty')\"");
  lines.push("      __agent_notify_voice_min_p_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_MIN_P:-}\" | jq -Rs 'try (tonumber) catch empty')\"");
  lines.push("      __agent_notify_voice_repetition_penalty_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_REPETITION_PENALTY:-}\" | jq -Rs 'try (tonumber) catch empty')\"");
  lines.push("      __agent_notify_voice_streaming_chunk_size_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_STREAMING_CHUNK_SIZE:-}\" | jq -Rs 'try (tonumber) catch empty')\"");
  lines.push("      __agent_notify_voice_streaming_buffer_size_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_STREAMING_BUFFER_SIZE:-}\" | jq -Rs 'try (tonumber) catch empty')\"");
  lines.push('      if [ "$AGENT_NOTIFY_VOICE_MODE" = "openai" ]; then');
  lines.push('        [ -n "${__agent_notify_voice_exaggeration_json:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"exaggeration\": ${__agent_notify_voice_exaggeration_json}"');
  lines.push('        [ -n "${__agent_notify_voice_cfg_weight_json:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"cfg_weight\": ${__agent_notify_voice_cfg_weight_json}"');
  lines.push('        [ -n "${__agent_notify_voice_temperature_json:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"temperature\": ${__agent_notify_voice_temperature_json}"');
  lines.push('        [ -n "${__agent_notify_voice_top_p_json:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"top_p\": ${__agent_notify_voice_top_p_json}"');
  lines.push('        [ -n "${__agent_notify_voice_min_p_json:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"min_p\": ${__agent_notify_voice_min_p_json}"');
  lines.push('        [ -n "${__agent_notify_voice_repetition_penalty_json:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"repetition_penalty\": ${__agent_notify_voice_repetition_penalty_json}"');
  lines.push('        [ -n "${AGENT_NOTIFY_VOICE_STREAM_FORMAT:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"stream_format\": $(printf \'%s\' "${AGENT_NOTIFY_VOICE_STREAM_FORMAT:-}" | jq -Rs .)"');
  lines.push('        [ -n "${AGENT_NOTIFY_VOICE_STREAMING_QUALITY:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"streaming_quality\": $(printf \'%s\' "${AGENT_NOTIFY_VOICE_STREAMING_QUALITY:-}" | jq -Rs .)"');
  lines.push('        [ -n "${AGENT_NOTIFY_VOICE_STREAMING_STRATEGY:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"streaming_strategy\": $(printf \'%s\' "${AGENT_NOTIFY_VOICE_STREAMING_STRATEGY:-}" | jq -Rs .)"');
  lines.push('        [ -n "${__agent_notify_voice_streaming_chunk_size_json:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"streaming_chunk_size\": ${__agent_notify_voice_streaming_chunk_size_json}"');
  lines.push('        [ -n "${__agent_notify_voice_streaming_buffer_size_json:-}" ] && __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields},\"streaming_buffer_size\": ${__agent_notify_voice_streaming_buffer_size_json}"');
  lines.push("      fi");
  lines.push('      __agent_notify_voice_extra_fields="${__agent_notify_voice_extra_fields#,}"');
  lines.push('      if [ -n "${__agent_notify_voice_extra_fields:-}" ]; then');
  lines.push("        __agent_notify_voice_extra_fields=\",${__agent_notify_voice_extra_fields}\"");
  lines.push("      fi");
  lines.push("    else");
  lines.push("      __agent_notify_voice_model_json=\"\\\"${AGENT_NOTIFY_VOICE_MODEL:-tts-1}\\\"\"");
  lines.push("      __agent_notify_voice_input_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_TEXT:-}\" | sed -e 's/\\\\/\\\\\\\\/g; s/\\\"/\\\\\\\"/g; s/\\r/\\\\r/g; s/\\t/\\\\t/g; s/\\n/\\\\n/g')\"");
  lines.push("      __agent_notify_voice_voice_json=\"\\\"${AGENT_NOTIFY_VOICE_VOICE:-}\\\"\"");
  lines.push("      __agent_notify_voice_format_json=\"\\\"${AGENT_NOTIFY_VOICE_RESPONSE_FORMAT:-mp3}\\\"\"");
  lines.push("    fi");
  lines.push('    cat > "$__agent_notify_voice_tmp_body" <<EOF');
  lines.push('{"model": ${__agent_notify_voice_model_json},');
  lines.push(' "input": ${__agent_notify_voice_input_json},');
  lines.push(' "voice": ${__agent_notify_voice_voice_json},');
  lines.push(' "response_format": ${__agent_notify_voice_format_json}${__agent_notify_voice_extra_fields:+,${__agent_notify_voice_extra_fields}}');
  lines.push("}");
  lines.push("EOF");
  lines.push("    __agent_notify_voice_code=0");
  lines.push("    __agent_notify_voice_http_status=\"\"");
  lines.push("    __agent_notify_voice_http_ok=0");
  lines.push("    if [ \"$AGENT_NOTIFY_VOICE_MODE\" = \"openai\" ] && [ -n \"${AGENT_NOTIFY_VOICE_API_KEY:-}\" ]; then");
  lines.push("      __agent_notify_voice_http_status=$(curl -m \"$AGENT_NOTIFY_VOICE_TIMEOUT\" -sS -w \"%{http_code}\" -X POST \"$AGENT_NOTIFY_VOICE_URL\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer $AGENT_NOTIFY_VOICE_API_KEY\" --data-binary \"@$__agent_notify_voice_tmp_body\" -o \"$__agent_notify_voice_tmp_file\")");
  lines.push("      __agent_notify_voice_code=$?");
  lines.push("    else");
  lines.push("      __agent_notify_voice_http_status=$(curl -m \"$AGENT_NOTIFY_VOICE_TIMEOUT\" -sS -w \"%{http_code}\" -X POST \"$AGENT_NOTIFY_VOICE_URL\" -H \"Content-Type: application/json\" --data-binary \"@$__agent_notify_voice_tmp_body\" -o \"$__agent_notify_voice_tmp_file\")");
  lines.push("      __agent_notify_voice_code=$?");
  lines.push("    fi");
  lines.push("    if printf \"%s\" \"${__agent_notify_voice_http_status:-}\" | grep -qE '^2[0-9][0-9]$' 2>/dev/null; then");
  lines.push("      __agent_notify_voice_http_ok=1");
  lines.push("    else");
  lines.push("      __agent_notify_voice_http_ok=0");
  lines.push("    fi");
  lines.push("    if ( [ \"$__agent_notify_voice_http_status\" = \"400\" ] || [ \"$__agent_notify_voice_http_status\" = \"422\" ] ) && [ -n \"$AGENT_NOTIFY_VOICE_VOICE\" ]; then");
  lines.push('      if [ "$AGENT_NOTIFY_VOICE_STRICT_VOICE" = "1" ]; then');
  lines.push("        rm -f \"$__agent_notify_voice_tmp_file\"");
  lines.push("        __agent_notify_voice_code=1");
  lines.push("      else");
  lines.push('        __agent_notify_voice_tmp_retry_extra_fields="$__agent_notify_voice_extra_fields"');
  lines.push('        if [ "$AGENT_NOTIFY_VOICE_MODE" != "openai" ] && [ -n "$__agent_notify_voice_tmp_retry_extra_fields" ]; then');
  lines.push("          __agent_notify_voice_extra_fields=\"\"");
  lines.push('          cat > "$__agent_notify_voice_tmp_body" <<EOF');
  lines.push('{"model": ${__agent_notify_voice_model_json},');
  lines.push(' "input": ${__agent_notify_voice_input_json},');
  lines.push(' "voice": ${__agent_notify_voice_voice_json},');
  lines.push(' "response_format": ${__agent_notify_voice_format_json}');
  lines.push("}");
  lines.push("EOF");
  lines.push("          if [ \"$AGENT_NOTIFY_VOICE_MODE\" = \"openai\" ] && [ -n \"${AGENT_NOTIFY_VOICE_API_KEY:-}\" ]; then");
  lines.push("            __agent_notify_voice_http_status=$(curl -m \"$AGENT_NOTIFY_VOICE_TIMEOUT\" -sS -w \"%{http_code}\" -X POST \"$AGENT_NOTIFY_VOICE_URL\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer $AGENT_NOTIFY_VOICE_API_KEY\" --data-binary \"@$__agent_notify_voice_tmp_body\" -o \"$__agent_notify_voice_tmp_file\")");
  lines.push("            __agent_notify_voice_code=$?");
  lines.push("          else");
  lines.push("            __agent_notify_voice_http_status=$(curl -m \"$AGENT_NOTIFY_VOICE_TIMEOUT\" -sS -w \"%{http_code}\" -X POST \"$AGENT_NOTIFY_VOICE_URL\" -H \"Content-Type: application/json\" --data-binary \"@$__agent_notify_voice_tmp_body\" -o \"$__agent_notify_voice_tmp_file\")");
  lines.push("            __agent_notify_voice_code=$?");
  lines.push("          fi");
  lines.push("          if printf \"%s\" \"${__agent_notify_voice_http_status:-}\" | grep -qE '^2[0-9][0-9]$' 2>/dev/null; then");
  lines.push("            __agent_notify_voice_http_ok=1");
  lines.push("          else");
  lines.push("            __agent_notify_voice_http_ok=0");
  lines.push("          fi");
  lines.push("          __agent_notify_voice_extra_fields=\"$__agent_notify_voice_tmp_retry_extra_fields\"");
  lines.push("        fi");
  lines.push("        if [ \"${__agent_notify_voice_http_ok:-0}\" -ne 1 ]; then");
  lines.push('          cat > "$__agent_notify_voice_tmp_body" <<EOF');
  lines.push('{"model": ${__agent_notify_voice_model_json},');
  lines.push(' "input": ${__agent_notify_voice_input_json},');
  lines.push(' "voice": ${__agent_notify_voice_voice_json},');
  lines.push(' "response_format": ${__agent_notify_voice_format_json}${__agent_notify_voice_extra_fields:+,${__agent_notify_voice_extra_fields}}');
  lines.push("}");
  lines.push("EOF");
  lines.push("          if [ \"$AGENT_NOTIFY_VOICE_MODE\" = \"openai\" ] && [ -n \"${AGENT_NOTIFY_VOICE_API_KEY:-}\" ]; then");
  lines.push("            __agent_notify_voice_http_status=$(curl -m \"$AGENT_NOTIFY_VOICE_TIMEOUT\" -sS -w \"%{http_code}\" -X POST \"$AGENT_NOTIFY_VOICE_URL\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer $AGENT_NOTIFY_VOICE_API_KEY\" --data-binary \"@$__agent_notify_voice_tmp_body\" -o \"$__agent_notify_voice_tmp_file\")");
  lines.push("            __agent_notify_voice_code=$?");
  lines.push("          else");
  lines.push("            __agent_notify_voice_http_status=$(curl -m \"$AGENT_NOTIFY_VOICE_TIMEOUT\" -sS -w \"%{http_code}\" -X POST \"$AGENT_NOTIFY_VOICE_URL\" -H \"Content-Type: application/json\" --data-binary \"@$__agent_notify_voice_tmp_body\" -o \"$__agent_notify_voice_tmp_file\")");
  lines.push("            __agent_notify_voice_code=$?");
  lines.push("          fi");
  lines.push("          if printf \"%s\" \"${__agent_notify_voice_http_status:-}\" | grep -qE '^2[0-9][0-9]$' 2>/dev/null; then");
  lines.push("            __agent_notify_voice_http_ok=1");
  lines.push("          else");
  lines.push("            __agent_notify_voice_http_ok=0");
  lines.push("          fi");
  lines.push("        fi");
  lines.push("      fi");
  lines.push("    fi");
  lines.push('    if [ "$__agent_notify_voice_http_status" = "422" ] && [ "$AGENT_NOTIFY_VOICE_RESPONSE_FORMAT" = "wav" ]; then');
  lines.push('      AGENT_NOTIFY_VOICE_RESPONSE_FORMAT="mp3"');
  lines.push('      __agent_notify_voice_format_json="\\\"mp3\\\""');
  lines.push('      cat > "$__agent_notify_voice_tmp_body" <<EOF');
  lines.push('{"model": ${__agent_notify_voice_model_json},');
  lines.push(' "input": ${__agent_notify_voice_input_json},');
  lines.push(' "voice": ${__agent_notify_voice_voice_json},');
  lines.push(' "response_format": ${__agent_notify_voice_format_json}${__agent_notify_voice_extra_fields:+,${__agent_notify_voice_extra_fields}}');
  lines.push("}");
  lines.push("EOF");
  lines.push("      if [ \"$AGENT_NOTIFY_VOICE_MODE\" = \"openai\" ] && [ -n \"${AGENT_NOTIFY_VOICE_API_KEY:-}\" ]; then");
  lines.push("        __agent_notify_voice_http_status=$(curl -m \"$AGENT_NOTIFY_VOICE_TIMEOUT\" -sS -w \"%{http_code}\" -X POST \"$AGENT_NOTIFY_VOICE_URL\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer $AGENT_NOTIFY_VOICE_API_KEY\" --data-binary \"@$__agent_notify_voice_tmp_body\" -o \"$__agent_notify_voice_tmp_file\")");
  lines.push("        __agent_notify_voice_code=$?");
  lines.push("      else");
  lines.push("        __agent_notify_voice_http_status=$(curl -m \"$AGENT_NOTIFY_VOICE_TIMEOUT\" -sS -w \"%{http_code}\" -X POST \"$AGENT_NOTIFY_VOICE_URL\" -H \"Content-Type: application/json\" --data-binary \"@$__agent_notify_voice_tmp_body\" -o \"$__agent_notify_voice_tmp_file\")");
  lines.push("        __agent_notify_voice_code=$?");
  lines.push("      fi");
  lines.push("      if printf \"%s\" \"${__agent_notify_voice_http_status:-}\" | grep -qE '^2[0-9][0-9]$' 2>/dev/null; then");
  lines.push("        __agent_notify_voice_http_ok=1");
  lines.push("      else");
  lines.push("        __agent_notify_voice_http_ok=0");
  lines.push("      fi");
  lines.push("    fi");
  lines.push("    rm -f \"$__agent_notify_voice_tmp_body\"");
  lines.push('__agent_notify_voice_log "event=cursor.tts.curl.result code=${__agent_notify_voice_code:-} http_status=${__agent_notify_voice_http_status:-none} strict_voice=${AGENT_NOTIFY_VOICE_STRICT_VOICE:-0} response_format=${AGENT_NOTIFY_VOICE_RESPONSE_FORMAT:-}"');
  lines.push("    __agent_notify_voice_tmp_file_exists=0");
  lines.push("    __agent_notify_voice_tmp_file_size=0");
  lines.push("    if [ -f \"$__agent_notify_voice_tmp_file\" ]; then");
  lines.push("      __agent_notify_voice_tmp_file_exists=1");
  lines.push("      __agent_notify_voice_tmp_file_size=\"$(wc -c < \"$__agent_notify_voice_tmp_file\" 2>/dev/null || printf \\\"0\\\")\"");
  lines.push("    fi");
  lines.push('__agent_notify_voice_log "event=cursor.tts.player.condition code=${__agent_notify_voice_code:-} http_ok=${__agent_notify_voice_http_ok:-0} player_list=${AGENT_NOTIFY_VOICE_PLAYER:-} tmp_file=${__agent_notify_voice_tmp_file:-} tmp_file_exists=${__agent_notify_voice_tmp_file_exists:-0} tmp_file_size=${__agent_notify_voice_tmp_file_size:-0}"');
  lines.push("    if [ \"$__agent_notify_voice_code\" -eq 0 ] && [ \"${__agent_notify_voice_http_ok:-0}\" -eq 1 ] && [ -s \"$__agent_notify_voice_tmp_file\" ]; then");
  lines.push('    __agent_notify_voice_player_list="${AGENT_NOTIFY_VOICE_PLAYER:-aplay}"');
  lines.push('    __agent_notify_voice_player_list="${__agent_notify_voice_player_list//,/ }"');
  lines.push('    __agent_notify_voice_player_list="aplay paplay ${__agent_notify_voice_player_list}"');
  lines.push(
    '    __agent_notify_voice_log "event=cursor.tts.player.order reason=alsa_before_ffmpeg"',
  );
  lines.push("    __agent_notify_voice_player_code=1");
  lines.push("    __agent_notify_voice_player_used=");
  lines.push("    for __agent_notify_voice_player in $__agent_notify_voice_player_list; do");
  lines.push("      __agent_notify_voice_player_stderr=\"$(mktemp /tmp/agent-notify-voice-player.XXXXXX.log)\"");
  lines.push("      case \"$__agent_notify_voice_player\" in");
  lines.push("        ffplay)");
  lines.push("          if command -v ffplay >/dev/null 2>&1; then");
  lines.push('            ffplay -nodisp -autoexit -loglevel quiet "$__agent_notify_voice_tmp_file" >/dev/null 2>"$__agent_notify_voice_player_stderr"');
  lines.push("            __agent_notify_voice_player_code=$?");
  lines.push("          else");
  lines.push("            __agent_notify_voice_player_code=1");
  lines.push("          fi");
  lines.push("          ;;");
  lines.push("        mpv)");
  lines.push("          if command -v mpv >/dev/null 2>&1; then");
  lines.push('            mpv --really-quiet --no-terminal "$__agent_notify_voice_tmp_file" >/dev/null 2>"$__agent_notify_voice_player_stderr"');
  lines.push("            __agent_notify_voice_player_code=$?");
  lines.push("          else");
  lines.push("            __agent_notify_voice_player_code=1");
  lines.push("          fi");
  lines.push("          ;;");
  lines.push("        mpg123)");
  lines.push("          if command -v mpg123 >/dev/null 2>&1; then");
  lines.push('            mpg123 -q "$__agent_notify_voice_tmp_file" >/dev/null 2>"$__agent_notify_voice_player_stderr"');
  lines.push("            __agent_notify_voice_player_code=$?");
  lines.push("          else");
  lines.push("            __agent_notify_voice_player_code=1");
  lines.push("          fi");
  lines.push("          ;;");
  lines.push("        paplay)");
  lines.push("          if command -v paplay >/dev/null 2>&1; then");
  lines.push('            paplay "$__agent_notify_voice_tmp_file" >/dev/null 2>"$__agent_notify_voice_player_stderr"');
  lines.push("            __agent_notify_voice_player_code=$?");
  lines.push("          else");
  lines.push("            __agent_notify_voice_player_code=1");
  lines.push("          fi");
  lines.push("          ;;");
  lines.push("        aplay)");
  lines.push("          if command -v aplay >/dev/null 2>&1; then");
  lines.push("            if [ -n \"${AGENT_NOTIFY_VOICE_PLAYER_ARGS:-}\" ]; then");
  lines.push("              eval \"aplay ${AGENT_NOTIFY_VOICE_PLAYER_ARGS} \\\"$__agent_notify_voice_tmp_file\\\" >/dev/null 2>\\\"$__agent_notify_voice_player_stderr\\\"\"");
  lines.push("              __agent_notify_voice_player_code=$?");
  lines.push("            else");
  lines.push('              aplay "$__agent_notify_voice_tmp_file" >/dev/null 2>"$__agent_notify_voice_player_stderr"');
  lines.push("              __agent_notify_voice_player_code=$?");
  lines.push("              if [ \"$__agent_notify_voice_player_code\" -ne 0 ]; then");
  lines.push('                for __agent_notify_aplay_dev in plughw:0,0 hw:0,0 plughw:1,0 hw:1,0 plughw:2,0 hw:2,0 default:CARD=0 default:CARD=1 default; do');
  lines.push('                  __agent_notify_voice_log "event=cursor.tts.player.fallback player=aplay device=${__agent_notify_aplay_dev} attempt=1"');
  lines.push('                  aplay -D "${__agent_notify_aplay_dev}" "$__agent_notify_voice_tmp_file" >/dev/null 2>"$__agent_notify_voice_player_stderr"');
  lines.push("                  __agent_notify_voice_player_code=$?");
  lines.push("                  if [ \"$__agent_notify_voice_player_code\" -eq 0 ]; then");
  lines.push('                    AGENT_NOTIFY_VOICE_PLAYER="aplay ${__agent_notify_aplay_dev}"');
  lines.push("                    break");
  lines.push("                  fi");
  lines.push("                done");
  lines.push("              fi");
  lines.push("            fi");
  lines.push("          else");
  lines.push("            __agent_notify_voice_player_code=1");
  lines.push("          fi");
  lines.push("          ;;");
  lines.push("        afplay)");
  lines.push("          if command -v afplay >/dev/null 2>&1; then");
  lines.push('            afplay "$__agent_notify_voice_tmp_file" >/dev/null 2>"$__agent_notify_voice_player_stderr"');
  lines.push("            __agent_notify_voice_player_code=$?");
  lines.push("          else");
  lines.push("            __agent_notify_voice_player_code=1");
  lines.push("          fi");
  lines.push("          ;;");
  lines.push("        *)");
  lines.push("          __agent_notify_voice_player_code=1");
  lines.push("          ;;");
  lines.push("      esac");
  lines.push(
    '      if [ "$__agent_notify_voice_player_code" -eq 0 ] && [ "$__agent_notify_voice_player" = "ffplay" ] && [ -s "$__agent_notify_voice_player_stderr" ] && grep -qE "xcb_connection|X11|no display|Cannot open display" "$__agent_notify_voice_player_stderr" 2>/dev/null; then',
  );
  lines.push(
    '        __agent_notify_voice_log "event=cursor.tts.player.ffplay_false_success reason=headless_x11"',
  );
  lines.push("        __agent_notify_voice_player_code=1");
  lines.push("      fi");
  lines.push("      if [ -n \"${__agent_notify_voice_log_file:-}\" ] && [ -s \"$__agent_notify_voice_player_stderr\" ]; then");
  lines.push('        __agent_notify_voice_log "event=cursor.tts.player.stderr player=$__agent_notify_voice_player code=$__agent_notify_voice_player_code"');
  lines.push('        __agent_notify_voice_log "$(sed "s/^/stderr=/" "$__agent_notify_voice_player_stderr" | tr "\\n" ";")"');
  lines.push("      fi");
  lines.push("      rm -f \"$__agent_notify_voice_player_stderr\"");
  lines.push("      __agent_notify_voice_log \"event=cursor.tts.player.attempt player=$__agent_notify_voice_player exit=$__agent_notify_voice_player_code\"");
  lines.push("      if [ \"$__agent_notify_voice_player_code\" -eq 0 ]; then");
  lines.push('        __agent_notify_voice_player_used="$__agent_notify_voice_player"');
  lines.push("        break");
  lines.push("      fi");
  lines.push("    done");
  lines.push("    if [ \"$__agent_notify_voice_player_code\" -ne 0 ]; then");
  lines.push('      for __agent_notify_voice_fallback_player in ffplay mpv mpg123; do');
  lines.push("        case \"$__agent_notify_voice_fallback_player\" in");
  lines.push("          ffplay)");
  lines.push("            if command -v ffplay >/dev/null 2>&1; then");
  lines.push("              __agent_notify_voice_player_stderr=\"$(mktemp /tmp/agent-notify-voice-player.XXXXXX.log)\"");
  lines.push('              __agent_notify_voice_log "event=cursor.tts.player.fallback player=ffplay attempt=1"');
  lines.push("              ffplay -nodisp -autoexit -loglevel quiet \"$__agent_notify_voice_tmp_file\" >/dev/null 2>\"$__agent_notify_voice_player_stderr\"");
  lines.push("              __agent_notify_voice_player_code=$?");
  lines.push(
    "              if [ \"$__agent_notify_voice_player_code\" -eq 0 ] && [ -s \"$__agent_notify_voice_player_stderr\" ] && grep -qE \"xcb_connection|X11|no display|Cannot open display\" \"$__agent_notify_voice_player_stderr\" 2>/dev/null; then",
  );
  lines.push(
    '                __agent_notify_voice_log "event=cursor.tts.player.fallback.ffplay_false_success reason=headless_x11"',
  );
  lines.push("                __agent_notify_voice_player_code=1");
  lines.push("              fi");
  lines.push("              if [ \"$__agent_notify_voice_player_code\" -eq 0 ]; then");
  lines.push('                __agent_notify_voice_player_used="ffplay"');
  lines.push("                AGENT_NOTIFY_VOICE_PLAYER=\"$__agent_notify_voice_player_used\"");
  lines.push("                rm -f \"$__agent_notify_voice_player_stderr\"");
  lines.push("                break");
  lines.push("              fi");
  lines.push("              rm -f \"$__agent_notify_voice_player_stderr\"");
  lines.push("            fi");
  lines.push("            ;;");
  lines.push("          mpv)");
  lines.push("            if command -v mpv >/dev/null 2>&1; then");
  lines.push("              __agent_notify_voice_player_stderr=\"$(mktemp /tmp/agent-notify-voice-player.XXXXXX.log)\"");
  lines.push('              __agent_notify_voice_log "event=cursor.tts.player.fallback player=mpv attempt=1"');
  lines.push("              mpv --really-quiet --no-terminal \"$__agent_notify_voice_tmp_file\" >/dev/null 2>\"$__agent_notify_voice_player_stderr\"");
  lines.push("              __agent_notify_voice_player_code=$?");
  lines.push("              if [ \"$__agent_notify_voice_player_code\" -eq 0 ]; then");
  lines.push('                __agent_notify_voice_player_used="mpv"');
  lines.push("                AGENT_NOTIFY_VOICE_PLAYER=\"$__agent_notify_voice_player_used\"");
  lines.push("                rm -f \"$__agent_notify_voice_player_stderr\"");
  lines.push("                break");
  lines.push("              fi");
  lines.push("              rm -f \"$__agent_notify_voice_player_stderr\"");
  lines.push("            fi");
  lines.push("            ;;");
  lines.push("          mpg123)");
  lines.push("            if command -v mpg123 >/dev/null 2>&1; then");
  lines.push("              __agent_notify_voice_player_stderr=\"$(mktemp /tmp/agent-notify-voice-player.XXXXXX.log)\"");
  lines.push('              __agent_notify_voice_log "event=cursor.tts.player.fallback player=mpg123 attempt=1"');
  lines.push("              mpg123 -q \"$__agent_notify_voice_tmp_file\" >/dev/null 2>\"$__agent_notify_voice_player_stderr\"");
  lines.push("              __agent_notify_voice_player_code=$?");
  lines.push("              if [ \"$__agent_notify_voice_player_code\" -eq 0 ]; then");
  lines.push('                __agent_notify_voice_player_used="mpg123"');
  lines.push("                AGENT_NOTIFY_VOICE_PLAYER=\"$__agent_notify_voice_player_used\"");
  lines.push("                rm -f \"$__agent_notify_voice_player_stderr\"");
  lines.push("                break");
  lines.push("              fi");
  lines.push("              rm -f \"$__agent_notify_voice_player_stderr\"");
  lines.push("            fi");
  lines.push("            ;;");
  lines.push("        esac");
  lines.push("      done");
  lines.push("    fi");
  lines.push("    AGENT_NOTIFY_VOICE_PLAYER=\"$__agent_notify_voice_player_used\"");
  lines.push("    [ -z \"$AGENT_NOTIFY_VOICE_PLAYER\" ] && AGENT_NOTIFY_VOICE_PLAYER=none");
  lines.push('    __agent_notify_voice_log "event=cursor.tts.dispatch.result player=$AGENT_NOTIFY_VOICE_PLAYER player_code=$__agent_notify_voice_player_code"');
  lines.push("    __agent_notify_voice_tts_played=1");
  lines.push("    :");
  lines.push("    else");
  lines.push('__agent_notify_voice_log "event=cursor.tts.player.condition.fail reason=not_ready code=${__agent_notify_voice_code:-} http_ok=${__agent_notify_voice_http_ok:-0} tmp_file=${__agent_notify_voice_tmp_file:-} exists=${__agent_notify_voice_tmp_file_exists:-0} size=${__agent_notify_voice_tmp_file_size:-0}"');
  lines.push("      rm -f \"$__agent_notify_voice_tmp_file\"");
  lines.push("    fi");
  lines.push("    rm -f \"$__agent_notify_voice_tmp_file\"");
  lines.push("  fi");
  lines.push("fi");
  lines.push('else');
  lines.push('  __agent_notify_voice_log "event=cursor.tts.skip reason=empty_voice_text"');
  lines.push('fi');
  lines.push("");
  lines.push("# Optional ding (off by default): set AGENT_NOTIFY_VOICE_FALLBACK_WAV_PLAY=1 and AGENT_NOTIFY_VOICE_FALLBACK_WAV to a wav path.");
  lines.push(
    'if [ "${AGENT_NOTIFY_VOICE_FALLBACK_WAV_PLAY:-0}" = "1" ] && [ -n "${AGENT_NOTIFY_VOICE_TEXT:-}" ] && [ "${__agent_notify_voice_tts_played:-0}" -ne 1 ] && [ -n "${AGENT_NOTIFY_VOICE_FALLBACK_WAV:-}" ] && [ -f "${AGENT_NOTIFY_VOICE_FALLBACK_WAV}" ]; then',
  );
  lines.push('  __agent_notify_voice_log "event=cursor.tts.fallback.wav.start reason=\"tts_playback_failed\" code=${__agent_notify_voice_code:-} http_ok=${__agent_notify_voice_http_ok:-0} http_status=${__agent_notify_voice_http_status:-none} tmp_file=${__agent_notify_voice_tmp_file:-} exists=${__agent_notify_voice_tmp_file_exists:-0} size=${__agent_notify_voice_tmp_file_size:-0}"');
  lines.push('  __agent_notify_voice_fallback_list="${AGENT_NOTIFY_VOICE_FALLBACK_PLAYER_LIST:-aplay paplay ffplay mpv mpg123}"');
  lines.push("  __agent_notify_voice_fallback_code=1");
  lines.push("  __agent_notify_voice_fallback_player_used=");
  lines.push("  for __agent_notify_voice_fallback_player in $__agent_notify_voice_fallback_list; do");
  lines.push("    __agent_notify_voice_fallback_stderr=\"$(mktemp /tmp/agent-notify-voice-player.XXXXXX.log)\"");
  lines.push("    case \"$__agent_notify_voice_fallback_player\" in");
  lines.push("      ffplay)");
  lines.push("        if command -v ffplay >/dev/null 2>&1; then");
  lines.push('          __agent_notify_voice_log \"event=cursor.tts.fallback.wav.attempt player=ffplay file=${AGENT_NOTIFY_VOICE_FALLBACK_WAV}\"');
  lines.push("          ffplay -nodisp -autoexit -loglevel quiet \"${AGENT_NOTIFY_VOICE_FALLBACK_WAV}\" >/dev/null 2>\"$__agent_notify_voice_fallback_stderr\"");
  lines.push("          __agent_notify_voice_fallback_code=$?");
  lines.push("        else");
  lines.push("          __agent_notify_voice_fallback_code=1");
  lines.push("        fi");
  lines.push("        ;;");
  lines.push("      aplay)");
  lines.push("        if command -v aplay >/dev/null 2>&1; then");
  lines.push('          __agent_notify_voice_log \"event=cursor.tts.fallback.wav.attempt player=aplay file=${AGENT_NOTIFY_VOICE_FALLBACK_WAV}\"');
  lines.push("          aplay \"${AGENT_NOTIFY_VOICE_FALLBACK_WAV}\" >/dev/null 2>\"$__agent_notify_voice_fallback_stderr\"");
  lines.push("          __agent_notify_voice_fallback_code=$?");
  lines.push("        else");
  lines.push("          __agent_notify_voice_fallback_code=1");
  lines.push("        fi");
  lines.push("        ;;");
  lines.push("      paplay)");
  lines.push("        if command -v paplay >/dev/null 2>&1; then");
  lines.push('          __agent_notify_voice_log \"event=cursor.tts.fallback.wav.attempt player=paplay file=${AGENT_NOTIFY_VOICE_FALLBACK_WAV}\"');
  lines.push("          paplay \"${AGENT_NOTIFY_VOICE_FALLBACK_WAV}\" >/dev/null 2>\"$__agent_notify_voice_fallback_stderr\"");
  lines.push("          __agent_notify_voice_fallback_code=$?");
  lines.push("        else");
  lines.push("          __agent_notify_voice_fallback_code=1");
  lines.push("        fi");
  lines.push("        ;;");
  lines.push("      mpv)");
  lines.push("        if command -v mpv >/dev/null 2>&1; then");
  lines.push('          __agent_notify_voice_log \"event=cursor.tts.fallback.wav.attempt player=mpv file=${AGENT_NOTIFY_VOICE_FALLBACK_WAV}\"');
  lines.push("          mpv --really-quiet --no-terminal \"${AGENT_NOTIFY_VOICE_FALLBACK_WAV}\" >/dev/null 2>\"$__agent_notify_voice_fallback_stderr\"");
  lines.push("          __agent_notify_voice_fallback_code=$?");
  lines.push("        else");
  lines.push("          __agent_notify_voice_fallback_code=1");
  lines.push("        fi");
  lines.push("        ;;");
  lines.push("      mpg123)");
  lines.push("        if command -v mpg123 >/dev/null 2>&1; then");
  lines.push('          __agent_notify_voice_log \"event=cursor.tts.fallback.wav.attempt player=mpg123 file=${AGENT_NOTIFY_VOICE_FALLBACK_WAV}\"');
  lines.push("          mpg123 -q \"${AGENT_NOTIFY_VOICE_FALLBACK_WAV}\" >/dev/null 2>\"$__agent_notify_voice_fallback_stderr\"");
  lines.push("          __agent_notify_voice_fallback_code=$?");
  lines.push("        else");
  lines.push("          __agent_notify_voice_fallback_code=1");
  lines.push("        fi");
  lines.push("        ;;");
  lines.push("      *)");
  lines.push("        __agent_notify_voice_fallback_code=1");
  lines.push("        ;;");
  lines.push("    esac");
  lines.push('    __agent_notify_voice_log "event=cursor.tts.fallback.wav.player.exit player=$__agent_notify_voice_fallback_player code=$__agent_notify_voice_fallback_code"');
  lines.push('    if [ -s "$__agent_notify_voice_fallback_stderr" ] && [ -n "${__agent_notify_voice_log_file:-}" ]; then');
  lines.push('      __agent_notify_voice_log "$(sed "s/^/fallback-stderr=/" "$__agent_notify_voice_fallback_stderr" | tr "\\n" ";")"');
  lines.push("    fi");
  lines.push("    rm -f \"$__agent_notify_voice_fallback_stderr\"");
  lines.push("    if [ \"$__agent_notify_voice_fallback_code\" -eq 0 ]; then");
  lines.push("      __agent_notify_voice_fallback_player_used=\"$__agent_notify_voice_fallback_player\"");
  lines.push("      break");
  lines.push("    fi");
  lines.push("  done");
  lines.push('  __agent_notify_voice_log "event=cursor.tts.fallback.wav.result player=${__agent_notify_voice_fallback_player_used:-none} code=${__agent_notify_voice_fallback_code:-1}"');
  lines.push("fi");
  lines.push("");
}

function addTmuxMarquee(lines: string[], messageExpr: string) {
  lines.push("# Show completion marquee on tmux status-right");
  lines.push(
    'if [ "${AGENT_NOTIFY_TMUX_MARQUEE:-1}" = "1" ] && command -v tmux >/dev/null 2>&1 && tmux ls >/dev/null 2>&1; then'
  );
  lines.push("  __agent_notify_tmux_old_status_right=\"$(tmux show-option -gv status-right 2>/dev/null || true)\"");
  lines.push("  __agent_notify_tmux_old_status_right=\"$(printf \"%s\" \"$__agent_notify_tmux_old_status_right\" | sed -E 's/^#\\[fg=yellow,bg=black\\][^$]*#\\[default\\] //')\"");
  lines.push("  __agent_notify_tmux_pid_file=\"${TMPDIR:-/tmp}/agent-notify-tmux-marquee.pid\"");
  lines.push("  __agent_notify_tmux_old_status_file=\"${TMPDIR:-/tmp}/agent-notify-tmux-marquee-old-status.txt\"");
  lines.push("  printf \"%s\" \"$__agent_notify_tmux_old_status_right\" > \"$__agent_notify_tmux_old_status_file\" 2>/dev/null || true");
  lines.push("  if [ -f \"$__agent_notify_tmux_pid_file\" ]; then");
  lines.push("    __agent_notify_tmux_old_pid=\"$(cat \"$__agent_notify_tmux_pid_file\" 2>/dev/null || true)\"");
  lines.push("    if [ -n \"${__agent_notify_tmux_old_pid:-}\" ]; then");
  lines.push("      kill \"$__agent_notify_tmux_old_pid\" >/dev/null 2>&1 || true");
  lines.push("    fi");
  lines.push("    rm -f \"$__agent_notify_tmux_pid_file\"");
  lines.push("  fi");
  lines.push("  __agent_notify_tmux_restored_status=\"$__agent_notify_tmux_old_status_right\"");
  lines.push("  if [ -f \"$__agent_notify_tmux_old_status_file\" ]; then");
  lines.push("    __agent_notify_tmux_restored_status=\"$(cat \"$__agent_notify_tmux_old_status_file\" 2>/dev/null || true)\"");
  lines.push("    if [ -n \"${__agent_notify_tmux_restored_status:-}\" ]; then");
  lines.push("      __agent_notify_tmux_old_status_right=\"$__agent_notify_tmux_restored_status\"");
  lines.push("    fi");
  lines.push("  fi");
  lines.push("  tmux set-option -g status-right \"$__agent_notify_tmux_old_status_right\"");
  lines.push(`  __agent_notify_tmux_text=${messageExpr}`);
  lines.push(`  __agent_notify_tmux_frame_width=${TMUX_MARQUEE_WIDTH}`);
  lines.push("  (");
  lines.push("    i=0");
  lines.push(`    while [ "$i" -lt ${TMUX_MARQUEE_STEPS} ]; do`);
  lines.push('      __agent_notify_tmux_frame="${__agent_notify_tmux_text:0:$__agent_notify_tmux_frame_width}"');
  lines.push("      if [ -n \"$__agent_notify_tmux_frame\" ]; then");
  lines.push('        tmux set-option -g status-right "#[fg=yellow,bg=black]${__agent_notify_tmux_frame}#[default] ${__agent_notify_tmux_old_status_right}"');
  lines.push("      fi");
  lines.push("      __agent_notify_tmux_text=\"${__agent_notify_tmux_text:1}${__agent_notify_tmux_text:0:1}\"");
  lines.push("      i=$((i + 1))");
  lines.push("      sleep 0.2");
  lines.push("    done");
  lines.push('    __agent_notify_tmux_old_status_restored="$(cat "$__agent_notify_tmux_old_status_file" 2>/dev/null || true)"');
  lines.push('    tmux set-option -g status-right "${__agent_notify_tmux_old_status_restored:-$__agent_notify_tmux_old_status_right}"');
  lines.push('    rm -f "$__agent_notify_tmux_old_status_file" "$__agent_notify_tmux_pid_file"');
  lines.push("  ) >/dev/null 2>&1 &");
  lines.push("  echo \"$!\" > \"$__agent_notify_tmux_pid_file\"");
  lines.push("fi");
}

function addNtfyPush(
  lines: string[],
  messageExpr: string,
  titleExpr: string,
  ntfyUrl: string,
  priority?: string
) {
  const priorityHeader = priority ? `-H "Priority: ${priority}" ` : "";
  lines.push("# Send ntfy push notification");
  lines.push("if command -v curl >/dev/null 2>&1; then");
  lines.push('  if [ -n "${NTFY_TOKEN:-}" ]; then');
  lines.push(`    curl -s -d ${messageExpr} -H "Title: ${titleExpr}" ${priorityHeader}-H "Authorization: Bearer ${'$'}NTFY_TOKEN" ${ntfyUrl} > /dev/null 2>&1 &`);
  lines.push("  elif [ -n \"${NTFY_USER:-}\" ] && [ -n \"${NTFY_PASSWORD:-}\" ]; then");
  lines.push(`    curl -s -d ${messageExpr} -H "Title: ${titleExpr}" ${priorityHeader}-u "${'$'}NTFY_USER:${'$'}NTFY_PASSWORD" ${ntfyUrl} > /dev/null 2>&1 &`);
  lines.push("  else");
  lines.push(`    curl -s -d ${messageExpr} -H "Title: ${titleExpr}" ${priorityHeader}${ntfyUrl} > /dev/null 2>&1 &`);
  lines.push("  fi");
  lines.push("fi");
}

/** Get Claude script configs with translations */
export function getClaudeScriptConfigs() {
  return CLAUDE_SCRIPT_CONFIG_TEMPLATES.map((c) => ({
    name: c.name,
    defaultSound: c.defaultSound,
    comment: t(c.commentKey),
    promptMessage: t(c.promptKey),
    notifyTitle: t(c.notifyTitleKey),
    notifyMsg: t(c.notifyMsgKey),
    sayText: t(c.sayKey),
  }));
}

/** Get Cursor script configs with translations */
export function getCursorScriptConfigs() {
  return CURSOR_SCRIPT_CONFIG_TEMPLATES.map((c) => ({
    name: c.name,
    defaultSound: c.defaultSound,
    comment: t(c.commentKey),
    promptMessage: t(c.promptKey),
    notifyTitle: t(c.notifyTitleKey),
    notifyMsg: t(c.notifyMsgKey),
    sayText: t(c.sayKey),
  }));
}

/** @deprecated Use getClaudeScriptConfigs instead */
export const getScriptConfigs = getClaudeScriptConfigs;

/** Claude script name type */
export type ClaudeScriptName = (typeof CLAUDE_SCRIPT_CONFIG_TEMPLATES)[number]["name"];

/** Cursor script name type */
export type CursorScriptName = (typeof CURSOR_SCRIPT_CONFIG_TEMPLATES)[number]["name"];

/** Script name type (union) */
export type ScriptName = ClaudeScriptName | CursorScriptName;

/** Claude script name constants */
export const CLAUDE_SCRIPT_NAMES = {
  done: CLAUDE_SCRIPT_CONFIG_TEMPLATES[0].name,
} as const;

/** Cursor script name constants */
export const CURSOR_SCRIPT_NAMES = {
  done: CURSOR_SCRIPT_CONFIG_TEMPLATES[0].name,
} as const;

/** @deprecated Use CLAUDE_SCRIPT_NAMES instead */
export const SCRIPT_NAMES = CLAUDE_SCRIPT_NAMES;

/** Claude script name list */
export const CLAUDE_SCRIPT_NAME_LIST: readonly ClaudeScriptName[] =
  Object.values(CLAUDE_SCRIPT_NAMES);

/** Cursor script name list */
export const CURSOR_SCRIPT_NAME_LIST: readonly CursorScriptName[] =
  Object.values(CURSOR_SCRIPT_NAMES);

/** @deprecated Use CLAUDE_SCRIPT_NAME_LIST instead */
export const SCRIPT_NAME_LIST = CLAUDE_SCRIPT_NAME_LIST;

export function generateCursorSessionContextToolScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  cat <<'USAGE'
Usage:
  agent-notify-session-context <SESSION_ID>
  agent-notify-session-context <SESSION_ID> [TRANSCRIPT_PATH]

Description:
  Resolve a session UUID to provider and workspace/project hints.
  This uses provider metadata found on disk only.
USAGE
  exit 0
fi

SID="$1"
TRANSCRIPT_HINT="${'$'}{2:-}"

CURSOR_ROOT="${'$'}HOME/.cursor"
CODEX_ROOT="${'$'}HOME/.codex"
KIMI_ROOT="${'$'}HOME/.kimi"
KIMI_CONFIG="${'$'}KIMI_ROOT/kimi.json"
KIMI_SESSIONS_DIR="${'$'}KIMI_ROOT/sessions"
CLAUDE_ROOT="${'$'}HOME/.claude"

emit_result() {
  local provider="$1"
  local workspace="$2"
  local project="(unknown)"

  if [ -n "$workspace" ]; then
    project="$(basename "$workspace")"
  fi

  printf 'provider=%s\n' "$provider"
  [ -n "$workspace" ] && printf 'workspace=%s\n' "$workspace"
  printf 'project=%s\n' "$project"
}

workspace_from_transcript() {
  local transcript_file="$1"
  local workspace=""
  if command -v jq >/dev/null 2>&1; then
    workspace="$(tail -n 360 "$transcript_file" 2>/dev/null | jq -Rr 'fromjson? | (.metadata.workspace_root // .workspace_root // .working_directory // .cwd // .working_dir // .metadata.working_directory // .metadata.cwd // empty)' | head -n 1 || true)"
  fi
  [ -n "$workspace" ] && [ "$workspace" != "null" ] && printf '%s' "$workspace" && return 0
  rg -o "/[A-Za-z0-9._/-]+" "$transcript_file" 2>/dev/null | awk "/^${'$'}HOME\\//" | head -n 1 || true
}

cursor_project_to_workspace() {
  local path_hint="$1"
  local token=""
  local workspace_slug=""
  [ -z "$path_hint" ] && return 1
  token="$(printf "%s" "$path_hint" | sed "s#^${'$'}HOME/.cursor/projects/##")"
  [ "$token" = "$path_hint" ] && return 1
  workspace_slug="$(printf "%s" "$token" | cut -d '/' -f 1)"
  workspace_slug="$(printf "%s" "$workspace_slug" | sed "s#^home-heavygee-coding-##")"
  [ -z "$workspace_slug" ] && return 1
  printf '%s' "${'$'}HOME/coding/${'$'}workspace_slug"
}

resolve_cursor() {
  local sid="$1"
  local transcript_file=""
  local workspace=""
  local transcript_hint="$2"

  transcript_file="$(rg --files "${'$'}HOME/.cursor/projects" -g "*agent-transcripts/${'$'}sid/${'$'}sid.jsonl" 2>/dev/null | head -n 1 || true)"
  if [ -z "$transcript_file" ] && [ -n "$transcript_hint" ] && [ -f "$transcript_hint" ]; then
    transcript_file="$transcript_hint"
  fi
  [ -n "$transcript_file" ] || return 1

  workspace="$(workspace_from_transcript "$transcript_file" || true)"
  [ -n "$workspace" ] || workspace="$(cursor_project_to_workspace "$transcript_file" || true)"
  [ -n "$workspace" ] || return 1

  emit_result cursor "$workspace"
}

resolve_kimi() {
  local sid="$1"
  local workspace=""
  local hit_file=""
  if [ -f "$KIMI_CONFIG" ]; then
    workspace="$(jq -r --arg sid "$sid" '.work_dirs[] | select(.last_session_id == $sid) | .path // empty' "$KIMI_CONFIG" 2>/dev/null | head -n 1 || true)"
  fi
  if [ -z "$workspace" ] && [ -d "$KIMI_SESSIONS_DIR" ]; then
    hit_file="$(rg -l --fixed-strings -g '*.json' "\"session_id\": \"$sid\"" "$KIMI_SESSIONS_DIR" 2>/dev/null | head -n 1 || true)"
    [ -n "$hit_file" ] && workspace="$(jq -r --arg sid "$sid" 'select((.session_id? // empty) == $sid) | .cwd // empty' "$hit_file" 2>/dev/null | head -n 1 || true)"
  fi

  [ -n "$workspace" ] && [ "$workspace" != "null" ] || return 1
  emit_result kimi "$workspace"
}

resolve_codex() {
  local sid="$1"
  local candidate_file=""
  local workspace=""
  [ -d "$CODEX_ROOT" ] || return 1
  candidate_file="$(rg --files "${'$'}CODEX_ROOT/sessions" -g "*${'$'}sid*.jsonl" 2>/dev/null | head -n 1 || true)"
  [ -n "$candidate_file" ] || return 1

  workspace="$(jq -r --arg sid "$sid" 'select((.type == "session_meta" or .type == "session") and (.payload.id? == $sid or .payload.session_id? == $sid)) | .payload.cwd // .cwd // empty' "$candidate_file" 2>/dev/null | head -n 1 || true)"
  [ -n "$workspace" ] && [ "$workspace" != "null" ] || return 1
  emit_result codex "$workspace"
}

resolve_claude() {
  local sid="$1"
  local transcript=""
  local workspace=""
  [ -d "$CLAUDE_ROOT" ] || return 1
  transcript="$(rg -l "$sid" "$CLAUDE_ROOT" -g '*.json' -g '*.jsonl' -g '*.md' -g '*.toml' 2>/dev/null | head -n 1 || true)"
  [ -n "$transcript" ] || return 1

  workspace="$(workspace_from_transcript "$transcript" || true)"
  [ -n "$workspace" ] || return 1
  emit_result claude "$workspace"
}

if resolve_cursor "$SID" "$TRANSCRIPT_HINT"; then
  exit 0
fi
if resolve_codex "$SID"; then
  exit 0
fi
if resolve_kimi "$SID"; then
  exit 0
fi
if resolve_claude "$SID"; then
  exit 0
fi

exit 1`
}
export function generateCursorStopHookWrapperScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

AGENT_NOTIFY_ENV_FILE="${'$'}{AGENT_NOTIFY_ENV_FILE:-$HOME/.config/agent-notify/.env}"
if [ -f "${'$'}AGENT_NOTIFY_ENV_FILE" ]; then
  set -a
  . "${'$'}AGENT_NOTIFY_ENV_FILE"
  set +a
fi

AGENT_NOTIFY_DEBUG="${'$'}{AGENT_NOTIFY_DEBUG:-0}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_NOTIFY_NOTIFY_SCRIPT="${'$'}{AGENT_NOTIFY_NOTIFY_SCRIPT:-${'$'}SCRIPT_DIR/cursor-done-sound.sh}"
if [ "${'$'}{AGENT_NOTIFY_NOTIFY_SCRIPT##*/}" != "cursor-done-sound.sh" ] || [ ! -x "${'$'}AGENT_NOTIFY_NOTIFY_SCRIPT" ]; then
  AGENT_NOTIFY_NOTIFY_SCRIPT="${'$'}SCRIPT_DIR/cursor-done-sound.sh"
fi

AGENT_NOTIFY_PAYLOAD="${'$'}{AGENT_NOTIFY_PAYLOAD:-$(cat 2>/dev/null || true)}"
if [ -z "${'$'}AGENT_NOTIFY_PAYLOAD" ] && [ "${'$'}{#}" -gt 0 ]; then
  AGENT_NOTIFY_PAYLOAD="${'$'}1"
fi
AGENT_NOTIFY_PAYLOAD_DIGEST="${'$'}{AGENT_NOTIFY_PAYLOAD_DIGEST:-$(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | cksum 2>/dev/null | cut -d ' ' -f 1 || true)}"
AGENT_NOTIFY_HOOK_EVENT_NAME="${'$'}{AGENT_NOTIFY_HOOK_EVENT_NAME:-cursor-stop-wrapper}"
AGENT_NOTIFY_HOOK_EVENT_SOURCE="${'$'}{AGENT_NOTIFY_HOOK_EVENT_SOURCE:-cursor-stop-hook}"
AGENT_NOTIFY_HOOK_DEBUG_FILE="${'$'}{AGENT_NOTIFY_HOOK_DEBUG_FILE:-}"
AGENT_NOTIFY_HOOK_DEBUG_DIR="${'$'}{AGENT_NOTIFY_HOOK_DEBUG_DIR:-}"
AGENT_NOTIFY_PROVIDER="${'$'}{AGENT_NOTIFY_PROVIDER:-cursor}"
AGENT_NOTIFY_CONTEXT="${'$'}{AGENT_NOTIFY_CONTEXT:-}"
AGENT_NOTIFY_PROJECT="${'$'}{AGENT_NOTIFY_PROJECT:-}"
AGENT_NOTIFY_STOP_CHAIN_BROKEN=""
AGENT_NOTIFY_COMPLETE_RECORDED=0
AGENT_NOTIFY_EVENT_ID="${'$'}{AGENT_NOTIFY_EVENT_ID:-}"
export AGENT_NOTIFY_HOOK_EVENT_NAME
export AGENT_NOTIFY_HOOK_EVENT_SOURCE
export AGENT_NOTIFY_STOP_CHAIN_BROKEN
export AGENT_NOTIFY_EVENT_ID
__agent_notify_emit_wrapper_complete() {
  if [ "${'$'}{AGENT_NOTIFY_COMPLETE_RECORDED:-0}" -eq 1 ]; then
    return 0
  fi
  AGENT_NOTIFY_COMPLETE_RECORDED=1

  if [ -n "${'$'}{AGENT_NOTIFY_HOOK_DEBUG_FILE}" ]; then
    echo "event=cursor.stop.wrapper.complete" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "event_id=${'$'}{AGENT_NOTIFY_EVENT_ID:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "source=${'$'}{AGENT_NOTIFY_HOOK_EVENT_SOURCE:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "hook_event_name=${'$'}{AGENT_NOTIFY_HOOK_EVENT_NAME:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "notify_exit=${'$'}{AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT:-0}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "agent_id=${'$'}{AGENT_NOTIFY_AGENT_ID:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "project=${'$'}{AGENT_NOTIFY_PROJECT:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "provider=${'$'}{AGENT_NOTIFY_PROVIDER:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "conversation_id=${'$'}{AGENT_NOTIFY_CONVERSATION_ID:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "generation_id=${'$'}{AGENT_NOTIFY_GENERATION_ID:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "session_id=${'$'}{AGENT_NOTIFY_SESSION_ID:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "payload_digest=${'$'}{AGENT_NOTIFY_PAYLOAD_DIGEST:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "stop_chain_broken_reason=${'$'}{AGENT_NOTIFY_STOP_CHAIN_BROKEN:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  fi
}
trap '__agent_notify_emit_wrapper_complete' EXIT
if [ "${'$'}AGENT_NOTIFY_DEBUG" != "0" ]; then
  AGENT_NOTIFY_HOOK_DEBUG_DIR="${'$'}{AGENT_NOTIFY_HOOK_DEBUG_DIR:-${'$'}HOME/.local/state}/agent-notify"
  AGENT_NOTIFY_HOOK_DEBUG_FILE="${'$'}{AGENT_NOTIFY_HOOK_DEBUG_FILE:-${'$'}AGENT_NOTIFY_HOOK_DEBUG_DIR/cursor-stop-debug.log}"
  mkdir -p "${'$'}AGENT_NOTIFY_HOOK_DEBUG_DIR" 2>/dev/null || true
  echo "=== ${'$'}(date -Iseconds) ===" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "event=cursor.stop.wrapper.start" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "source=${'$'}AGENT_NOTIFY_HOOK_EVENT_SOURCE" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "hook_event_name=${'$'}AGENT_NOTIFY_HOOK_EVENT_NAME" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "event_id=${'$'}{AGENT_NOTIFY_EVENT_ID:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "payload_digest=${'$'}AGENT_NOTIFY_PAYLOAD_DIGEST" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "script=$0" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "cwd=$(pwd)" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "payload=${'$'}AGENT_NOTIFY_PAYLOAD" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
fi

conversation_id=""
generation_id=""
status=""
voice=""
agent_id=""
agent_name_hint=""
session_id=""
project_hint=""
loop_count=""
__agent_notify_model_hint=""
__agent_notify_action_hint=""
transcript_path=""
__agent_notify_resolve_by=""

if [ -n "${'$'}AGENT_NOTIFY_PAYLOAD" ] && command -v jq >/dev/null 2>&1; then
  conversation_id="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r ".conversation_id // empty")"
  generation_id="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r ".generation_id // empty")"
  status="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r ".status // empty")"
  voice="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r "(.voice // .voice_id // .notify.voice // .notification.voice // .metadata.voice // .audio.voice // .agent_voice // .payload.voice // empty) // empty")"
  agent_id="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r "(.agent // .agent_id // .agent_name // .name // .metadata.agent // .metadata.agent_id // .metadata.agent_name // empty) // empty")"
  agent_name_hint="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r "(.agent_name // .name // .metadata.agent_name // .metadata.name // .metadata.agent // empty) // empty")"
  session_id="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r "(.session_id // .metadata.session_id // .session // .metadata.session // empty) // empty")"
  project_hint="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r "(.project // .project_name // .repository // .repo // .project_path // .workspace_root // .worktree // .metadata.project // .metadata.project_id // .metadata.repository // .metadata.repository_name // .metadata.workspace_root // .metadata.working_directory // .cwd // .working_directory // .working_dir // empty) // empty")"
  __agent_notify_model_hint="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r "(.model // .model_name // .metadata.model // .metadata.model_name // .provider // .metadata.provider // empty) // empty")"
  __agent_notify_action_hint="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r "(.action // .last_action // .result.action // .metadata.last_action // .metadata.action // empty) // empty")"
  loop_count="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r ".loop_count // empty")"
  transcript_path="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r ".transcript_path // empty")"
fi
if [ -n "${'$'}agent_name_hint" ] && [ -z "${'$'}agent_id" ]; then
  agent_id="${'$'}agent_name_hint"
fi
if [ -z "${'$'}AGENT_NOTIFY_EVENT_ID" ]; then
  AGENT_NOTIFY_EVENT_ID="${'$'}{conversation_id:-${'$'}{session_id:-${'$'}{generation_id:-${'$'}{agent_id:-cursor-stop-$(date +%s%N)}}}}"
  [ -n "${'$'}conversation_id" ] && [ -n "${'$'}generation_id" ] && AGENT_NOTIFY_EVENT_ID="${'$'}{AGENT_NOTIFY_EVENT_ID}-gen-${'$'}generation_id"
fi
[ -n "${'$'}AGENT_NOTIFY_PAYLOAD_DIGEST" ] && AGENT_NOTIFY_EVENT_ID="${'$'}AGENT_NOTIFY_EVENT_ID-${'$'}AGENT_NOTIFY_PAYLOAD_DIGEST"
[ -z "${'$'}{AGENT_NOTIFY_MODEL:-}" ] && AGENT_NOTIFY_MODEL="${'$'}{__agent_notify_model_hint:-cursor}"
[ -z "${'$'}{AGENT_NOTIFY_STOP_ACTION:-}" ] && AGENT_NOTIFY_STOP_ACTION="${'$'}{__agent_notify_action_hint:-}"
if [ -n "${'$'}AGENT_NOTIFY_PAYLOAD" ] && command -v jq >/dev/null 2>&1; then
  AGENT_NOTIFY_SUMMARY_TEXT="${'$'}(printf "%s" "${'$'}AGENT_NOTIFY_PAYLOAD" | jq -r '[.summary // .summary_text // .summaryText // .payload.summary // .payload.summary_text // .payload.summaryText // .result.summary // .result.summary_text // .result.summaryText // .output // .message // .assistant.summary // .assistant.message // .assistant.output // empty] | map(select(type=="string" and . != "")) | .[0] // empty')"
  [ -n "${'$'}AGENT_NOTIFY_SUMMARY_TEXT" ] && export AGENT_NOTIFY_SUMMARY_TEXT
fi
__agent_notify_summary_payload_source=
if [ -n "${'$'}{AGENT_NOTIFY_TRANSCRIPT_PATH:-${'$'}{transcript_path:-}}" ] && [ -s "${'$'}{AGENT_NOTIFY_TRANSCRIPT_PATH:-${'$'}{transcript_path:-}}" ] && command -v jq >/dev/null 2>&1 && command -v rg >/dev/null 2>&1; then
    __agent_notify_summary_payload_line="${'$'}(rg "AGENT_NOTIFY_SUMMARY" "${'$'}{AGENT_NOTIFY_TRANSCRIPT_PATH:-${'$'}{transcript_path:-}}" 2>/dev/null | tail -n 1 || true)"
    if [ -n "${'$'}__agent_notify_summary_payload_line" ]; then
      __agent_notify_summary_payload_source="transcript_full_scan"
    else
      __agent_notify_summary_payload_line="${'$'}(tail -n 220 "${'$'}{AGENT_NOTIFY_TRANSCRIPT_PATH:-${'$'}{transcript_path:-}}" 2>/dev/null | rg \"AGENT_NOTIFY_SUMMARY\" | tail -n 1 || true)"
      [ -n "${'$'}__agent_notify_summary_payload_line" ] && __agent_notify_summary_payload_source="transcript_tail_220"
    fi
  if [ -n "${'$'}__agent_notify_summary_payload_line" ]; then
    __agent_notify_summary_payload_text="${'$'}(printf "%s" "${'$'}__agent_notify_summary_payload_line" | jq -r '[.message.content[]? | select(.type=="text" and (.text|type=="string")) | .text // ""] | join(" ")' 2>/dev/null || true)"
    __agent_notify_summary_payload_json="${'$'}(printf "%s" "${'$'}__agent_notify_summary_payload_text" | tr '\\n' ' ' | sed -nE 's/.*AGENT_NOTIFY_SUMMARY[[:space:]]*(\\{.*\\})/\\1/p')"
    if [ -n "${'$'}__agent_notify_summary_payload_json" ]; then
      __agent_notify_contract_summary="${'$'}(printf "%s" "${'$'}__agent_notify_summary_payload_json" | jq -r '.summary // empty' 2>/dev/null || true)"
      __agent_notify_contract_action="${'$'}(printf "%s" "${'$'}__agent_notify_summary_payload_json" | jq -r '.action // empty' 2>/dev/null || true)"
      [ -n "${'$'}__agent_notify_contract_summary" ] && AGENT_NOTIFY_SUMMARY_TEXT="${'$'}__agent_notify_contract_summary" && export AGENT_NOTIFY_SUMMARY_TEXT
      [ -n "${'$'}__agent_notify_contract_action" ] && AGENT_NOTIFY_STOP_ACTION="${'$'}__agent_notify_contract_action"
      AGENT_NOTIFY_AGENT_ID="${'$'}{AGENT_NOTIFY_AGENT_ID:-${'$'}(printf "%s" "${'$'}__agent_notify_summary_payload_json" | jq -r '.agent // empty' 2>/dev/null || true)}"
      AGENT_NOTIFY_PROJECT="${'$'}{AGENT_NOTIFY_PROJECT:-${'$'}(printf "%s" "${'$'}__agent_notify_summary_payload_json" | jq -r '.project // empty' 2>/dev/null || true)}"
      AGENT_NOTIFY_MODEL="${'$'}{AGENT_NOTIFY_MODEL:-${'$'}(printf "%s" "${'$'}__agent_notify_summary_payload_json" | jq -r '.model // empty' 2>/dev/null || true)}"
      AGENT_NOTIFY_STATUS="${'$'}{AGENT_NOTIFY_STATUS:-${'$'}(printf "%s" "${'$'}__agent_notify_summary_payload_json" | jq -r '.status // empty' 2>/dev/null || true)}"
    fi
  fi
fi
export AGENT_NOTIFY_EVENT_ID
export AGENT_NOTIFY_CONVERSATION_ID="${'$'}conversation_id"
export AGENT_NOTIFY_GENERATION_ID="${'$'}generation_id"
export AGENT_NOTIFY_SESSION_ID="${'$'}session_id"
export AGENT_NOTIFY_PAYLOAD_DIGEST
[ -n "${'$'}{AGENT_NOTIFY_MODEL:-}" ] && export AGENT_NOTIFY_MODEL
[ -n "${'$'}{AGENT_NOTIFY_STOP_ACTION:-}" ] && export AGENT_NOTIFY_STOP_ACTION
if [ -n "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE" ] && [ "${'$'}AGENT_NOTIFY_DEBUG" != "0" ]; then
  echo "event=cursor.stop.wrapper.payload" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "event_id=${'$'}AGENT_NOTIFY_EVENT_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "source=${'$'}AGENT_NOTIFY_HOOK_EVENT_SOURCE" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "hook_event_name=${'$'}AGENT_NOTIFY_HOOK_EVENT_NAME" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "payload_digest=${'$'}AGENT_NOTIFY_PAYLOAD_DIGEST" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "conversation_id=${'$'}conversation_id" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "generation_id=${'$'}generation_id" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "status=${'$'}status" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "voice=${'$'}voice" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "model=${'$'}AGENT_NOTIFY_MODEL" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "model_hint=${'$'}__agent_notify_model_hint" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "action_hint=${'$'}__agent_notify_action_hint" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "notify_status=${'$'}AGENT_NOTIFY_STATUS" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "summary_text=${'$'}AGENT_NOTIFY_SUMMARY_TEXT" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "summary_source=${'$'}__agent_notify_summary_payload_source" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "forward_action=${'$'}AGENT_NOTIFY_STOP_ACTION" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "session_id=${'$'}session_id" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "agent_id_raw=${'$'}agent_id" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "agent_name_hint=${'$'}agent_name_hint" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "project_hint=${'$'}project_hint" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "loop_count=${'$'}loop_count" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "transcript_input_path=${'$'}transcript_path" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "event=cursor.stop.wrapper.correlation" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "event_id=${'$'}AGENT_NOTIFY_EVENT_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "source=${'$'}AGENT_NOTIFY_HOOK_EVENT_SOURCE" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "hook_event_name=${'$'}AGENT_NOTIFY_HOOK_EVENT_NAME" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "conversation_id=${'$'}AGENT_NOTIFY_CONVERSATION_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "generation_id=${'$'}AGENT_NOTIFY_GENERATION_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "session_id=${'$'}AGENT_NOTIFY_SESSION_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "model=${'$'}AGENT_NOTIFY_MODEL" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "stop_action=${'$'}AGENT_NOTIFY_STOP_ACTION" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "agent_id=${'$'}agent_id" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "transcript_path=${'$'}transcript_path" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
fi
AGENT_NOTIFY_TRANSCRIPT_PATH="${'$'}transcript_path"
export AGENT_NOTIFY_TRANSCRIPT_PATH
[ -z "${'$'}transcript_path" ] && transcript_path="${'$'}AGENT_NOTIFY_TRANSCRIPT_PATH"

__agent_notify_wait_for_transcript() {
  local file="${'$'}1"
  local max_attempts="${'$'}{2:-4}"
  local attempt=0
  local lines=""
  local path="${'$'}file"
  while [ "${'$'}{attempt}" -lt "${'$'}{max_attempts}" ]; do
    lines="${'$'}(wc -l < "${'$'}path" 2>/dev/null || true)"
    [ -n "${'$'}lines" ] && [ "${'$'}lines" -ge 3 ] && {
      printf "%s" "${'$'}lines"
      return 0
    }
    sleep 0.2
    attempt=$((attempt + 1))
  done
  printf "%s" "${'$'}{lines}"
}

__agent_notify_resolve_transcript_by_content() {
  local needle="${'$'}1"
  local best_file=""
  local best_mtime=0
  local candidate=""
  local mtime=""
  [ -z "${'$'}needle" ] && return 0
  while IFS= read -r candidate; do
    rg -q -F -- "${'$'}needle" "${'$'}candidate" 2>/dev/null || continue
    mtime="${'$'}(stat -c '%Y' "${'$'}candidate" 2>/dev/null || echo 0)"
    if [ -z "${'$'}best_file" ] || [ "${'$'}mtime" -gt "${'$'}best_mtime" ]; then
      best_file="${'$'}candidate"
      best_mtime="${'$'}mtime"
    fi
  done < <(rg --files "${'$'}HOME/.cursor/projects" -g "*.jsonl" 2>/dev/null)
  [ -n "${'$'}best_file" ] && printf "%s" "${'$'}best_file"
  return 0
}

__agent_notify_original_transcript_path="${'$'}AGENT_NOTIFY_TRANSCRIPT_PATH"
if [ -n "${'$'}transcript_path" ] && [ -s "${'$'}transcript_path" ]; then
  __agent_notify_transcript_lines="$(__agent_notify_wait_for_transcript "${'$'}transcript_path" 12)"
  if [ -n "${'$'}__agent_notify_transcript_lines" ] && [ "${'$'}__agent_notify_transcript_lines" -lt 3 ] && [ -d "${'$'}HOME/.cursor/projects" ]; then
    if [ -n "${'$'}conversation_id" ]; then
      __agent_notify_cursor_transcript="$(__agent_notify_resolve_transcript_by_content "${'$'}conversation_id" || true)"
      if [ -n "${'$'}{__agent_notify_cursor_transcript:-}" ]; then
        transcript_path="${'$'}__agent_notify_cursor_transcript"
        __agent_notify_resolve_by="conversation_id"
      fi
    fi
    if [ -z "${'$'}transcript_path" ] && [ -n "${'$'}agent_id" ]; then
      __agent_notify_cursor_transcript="$(__agent_notify_resolve_transcript_by_content "${'$'}agent_id" || true)"
      if [ -n "${'$'}{__agent_notify_cursor_transcript:-}" ]; then
        transcript_path="${'$'}__agent_notify_cursor_transcript"
        __agent_notify_resolve_by="agent_id"
      fi
    fi
    if [ -z "${'$'}transcript_path" ] && [ -n "${'$'}session_id" ]; then
      __agent_notify_cursor_transcript="$(__agent_notify_resolve_transcript_by_content "${'$'}session_id" || true)"
      if [ -n "${'$'}{__agent_notify_cursor_transcript:-}" ]; then
        transcript_path="${'$'}__agent_notify_cursor_transcript"
        __agent_notify_resolve_by="session_id"
      fi
    fi
    if [ -z "${'$'}transcript_path" ] && [ -n "${'$'}project_hint" ]; then
      __agent_notify_cursor_transcript="$(__agent_notify_resolve_transcript_by_content "${'$'}project_hint" || true)"
      if [ -n "${'$'}{__agent_notify_cursor_transcript:-}" ]; then
        transcript_path="${'$'}__agent_notify_cursor_transcript"
        __agent_notify_resolve_by="project_hint"
      fi
    fi
    if [ -z "${'$'}transcript_path" ] && [ -n "${'$'}agent_id" ]; then
      __agent_notify_cursor_transcript="$(__agent_notify_resolve_transcript_by_content "${'$'}{agent_id}-" || true)"
      if [ -n "${'$'}{__agent_notify_cursor_transcript:-}" ]; then
        transcript_path="${'$'}__agent_notify_cursor_transcript"
        __agent_notify_resolve_by="agent_id_prefix"
      fi
    fi
    AGENT_NOTIFY_TRANSCRIPT_PATH="${'$'}transcript_path"
    export AGENT_NOTIFY_TRANSCRIPT_PATH
  fi
fi
if [ "${'$'}AGENT_NOTIFY_DEBUG" != "0" ] && [ -n "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE" ]; then
  echo "event=cursor.stop.wrapper.transcript.resolve" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "event_id=${'$'}AGENT_NOTIFY_EVENT_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "source=${'$'}AGENT_NOTIFY_HOOK_EVENT_SOURCE" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "hook_event_name=${'$'}AGENT_NOTIFY_HOOK_EVENT_NAME" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "payload_digest=${'$'}{AGENT_NOTIFY_PAYLOAD_DIGEST:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "payload=${'$'}AGENT_NOTIFY_PAYLOAD" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "conversation_id=${'$'}conversation_id" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "generation_id=${'$'}generation_id" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "status=${'$'}status" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "voice=${'$'}voice" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "session_id=${'$'}session_id" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "loop_count=${'$'}loop_count" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "transcript_path=${'$'}AGENT_NOTIFY_TRANSCRIPT_PATH" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "transcript_original_path=${'$'}{__agent_notify_original_transcript_path:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "transcript_resolved_lines=${'$'}{__agent_notify_transcript_lines:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "transcript_resolved_to=${'$'}{transcript_path:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "transcript_resolve_by=${'$'}{__agent_notify_resolve_by:-fallback}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
fi

[ -z "${'$'}agent_id" ] && agent_id="${'$'}conversation_id"
[ -z "${'$'}agent_id" ] && [ -n "${'$'}session_id" ] && agent_id="${'$'}session_id"

[ -n "${'$'}project_hint" ] && AGENT_NOTIFY_PROJECT="${'$'}project_hint"
[ -n "${'$'}AGENT_NOTIFY_PROJECT" ] && AGENT_NOTIFY_PROJECT="${'$'}{AGENT_NOTIFY_PROJECT##*/}"
[ -n "${'$'}AGENT_NOTIFY_PROJECT" ] && AGENT_NOTIFY_PROJECT="${'$'}{AGENT_NOTIFY_PROJECT%%.*}"
if [ -z "${'$'}project_hint" ] && [ -n "${'$'}AGENT_NOTIFY_TRANSCRIPT_PATH" ]; then
  __agent_notify_cursor_project_dir="${'$'}{AGENT_NOTIFY_TRANSCRIPT_PATH#*${'$'}HOME/.cursor/projects/}"
  __agent_notify_cursor_project_dir="${'$'}{__agent_notify_cursor_project_dir%%/agent-transcripts/*}"
  if [ -n "${'$'}__agent_notify_cursor_project_dir" ] && [ "${'$'}__agent_notify_cursor_project_dir" != "${'$'}AGENT_NOTIFY_TRANSCRIPT_PATH" ]; then
    __agent_notify_cursor_project="${'$'}{__agent_notify_cursor_project_dir##*/}"
    __agent_notify_cursor_project="${'$'}{__agent_notify_cursor_project#home-heavygee-coding-}"
    [ -n "${'$'}__agent_notify_cursor_project" ] && AGENT_NOTIFY_PROJECT="${'$'}__agent_notify_cursor_project"
  fi
fi
if [ -n "${'$'}agent_id" ] && [ -n "${'$'}transcript_path" ] && command -v jq >/dev/null 2>&1; then
  project_from_transcript="${'$'}(tail -n 240 "${'$'}transcript_path" 2>/dev/null | jq -Rr 'fromjson? | (.project // .project_name // .repository // .workspace_root // .working_directory // .cwd // .metadata.project // .metadata.repository // empty) // empty' | head -n 1 || true)"
  agent_from_transcript="${'$'}(tail -n 240 "${'$'}transcript_path" 2>/dev/null | jq -Rr 'fromjson? | (.agent_name // .agent // .name // .metadata.agent // .metadata.name // .metadata.agent_name // empty) // empty' | head -n 1 || true)"
  [ -n "${'$'}project_from_transcript" ] && AGENT_NOTIFY_PROJECT="${'$'}project_from_transcript"
  [ -n "${'$'}agent_from_transcript" ] && agent_id="${'$'}agent_from_transcript"
fi

if [ -n "${'$'}AGENT_NOTIFY_PROJECT" ] && printf "%s" "${'$'}AGENT_NOTIFY_PROJECT" | grep -Eq '^[0-9]+$'; then
  AGENT_NOTIFY_PROJECT=""
  if [ -n "${'$'}AGENT_NOTIFY_TRANSCRIPT_PATH" ]; then
    __agent_notify_resolved_project_from_path="${'$'}{AGENT_NOTIFY_TRANSCRIPT_PATH#*${'$'}HOME/.cursor/projects/}"
    __agent_notify_resolved_project_from_path="${'$'}{__agent_notify_resolved_project_from_path%%/agent-transcripts/*}"
    if [ -n "${'$'}__agent_notify_resolved_project_from_path" ] && [ "${'$'}__agent_notify_resolved_project_from_path" != "${'$'}AGENT_NOTIFY_TRANSCRIPT_PATH" ]; then
      __agent_notify_resolved_project_from_path="${'$'}{__agent_notify_resolved_project_from_path##*/}"
      __agent_notify_resolved_project_from_path="${'$'}{__agent_notify_resolved_project_from_path#home-heavygee-coding-}"
      [ -n "${'$'}__agent_notify_resolved_project_from_path" ] && AGENT_NOTIFY_PROJECT="${'$'}__agent_notify_resolved_project_from_path"
    fi
  fi
fi
if [ -n "${'$'}AGENT_NOTIFY_PROJECT" ] && printf "%s" "${'$'}AGENT_NOTIFY_PROJECT" | grep -Eq '^%[0-9]+$'; then
  __agent_notify_tmux_panes=""
  if command -v tmux >/dev/null 2>&1; then
    __agent_notify_tmux_panes="$(tmux list-panes -a -F '#{pane_id}' 2>/dev/null || true)"
  fi
  if [ -z "${'$'}__agent_notify_tmux_panes" ] || ! printf "%s\n" "${'$'}__agent_notify_tmux_panes" | grep -Fqx "${'$'}AGENT_NOTIFY_PROJECT" >/dev/null 2>&1; then
    AGENT_NOTIFY_PROJECT=""
  fi
fi
if [ -n "${'$'}AGENT_NOTIFY_AGENT_ID" ] && printf "%s" "${'$'}AGENT_NOTIFY_AGENT_ID" | grep -Eq '^%[0-9]+$'; then
  __agent_notify_tmux_panes=""
  if command -v tmux >/dev/null 2>&1; then
    __agent_notify_tmux_panes="$(tmux list-panes -a -F '#{pane_id}' 2>/dev/null || true)"
  fi
  if [ -z "${'$'}__agent_notify_tmux_panes" ] || ! printf "%s\n" "${'$'}__agent_notify_tmux_panes" | grep -Fqx "${'$'}AGENT_NOTIFY_AGENT_ID" >/dev/null 2>&1; then
    AGENT_NOTIFY_AGENT_ID="agent"
  fi
fi
if [ -z "${'$'}AGENT_NOTIFY_PROJECT" ] || [ -n "${'$'}agent_id" ] && printf "%s" "${'$'}agent_id" | grep -Eq '^[0-9]+$'; then
  if [ -z "${'$'}agent_id" ] && [ -n "${'$'}conversation_id" ]; then
    agent_id="${'$'}conversation_id"
  fi
  if [ -z "${'$'}agent_id" ] && [ -n "${'$'}session_id" ]; then
    agent_id="${'$'}session_id"
  fi
  if [ -n "${'$'}agent_id" ] && command -v "${'$'}SCRIPT_DIR/${'$'}{DEFAULT_SESSION_CONTEXT_TOOL}" >/dev/null 2>&1; then
    RESOLVER_ID="${'$'}agent_id"
    RESOLVER_TOOL="${'$'}SCRIPT_DIR/${'$'}{DEFAULT_SESSION_CONTEXT_TOOL}"
    RESOLVER_EXIT=0
    resolved_context="$("${'$'}RESOLVER_TOOL" "${'$'}RESOLVER_ID" "${'$'}AGENT_NOTIFY_TRANSCRIPT_PATH" 2>/dev/null || RESOLVER_EXIT=$?)"
    if [ -n "${'$'}resolved_context" ]; then
      AGENT_NOTIFY_AGENT_ID="${'$'}agent_id"
      AGENT_NOTIFY_PROJECT="${'$'}(printf "%s" "${'$'}resolved_context" | awk -F= "/^project=/{print \$2}" | tail -n 1 || true)"
      AGENT_NOTIFY_PROVIDER="${'$'}(printf "%s" "${'$'}resolved_context" | awk -F= "/^provider=/{print \$2}" | tail -n 1 || true)"
      [ -n "${'$'}AGENT_NOTIFY_PROJECT" ] && export AGENT_NOTIFY_PROJECT
      [ -n "${'$'}AGENT_NOTIFY_PROVIDER" ] && export AGENT_NOTIFY_PROVIDER
    fi
    if [ -n "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE" ]; then
      echo "event=cursor.stop.wrapper.session-context.resolve" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
      echo "event_id=${'$'}AGENT_NOTIFY_EVENT_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
      echo "source=${'$'}AGENT_NOTIFY_HOOK_EVENT_SOURCE" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
      echo "hook_event_name=${'$'}AGENT_NOTIFY_HOOK_EVENT_NAME" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
      echo "resolver_id=${'$'}RESOLVER_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
      echo "resolver_tool=${'$'}RESOLVER_TOOL" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
      echo "resolver_exit=${'$'}RESOLVER_EXIT" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
      echo "resolver_provider=${'$'}AGENT_NOTIFY_PROVIDER" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
      echo "resolver_project=${'$'}AGENT_NOTIFY_PROJECT" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
      echo "" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    fi
  fi
fi

AGENT_NOTIFY_AGENT_ID="${'$'}{AGENT_NOTIFY_AGENT_ID:-${'$'}agent_id}"
[ -z "${'$'}AGENT_NOTIFY_AGENT_ID" ] || export AGENT_NOTIFY_AGENT_ID
  [ -n "${'$'}AGENT_NOTIFY_AGENT_ID" ] && printf "%s" "${'$'}AGENT_NOTIFY_AGENT_ID" | grep -Eq '^[0-9a-fA-F-]{36}$' && {
  if [ -n "${'$'}AGENT_NOTIFY_PROJECT" ]; then
    [ -n "${'$'}AGENT_NOTIFY_PROVIDER" ] && AGENT_NOTIFY_AGENT_ID="${'$'}AGENT_NOTIFY_PROVIDER-${'$'}AGENT_NOTIFY_PROJECT" || AGENT_NOTIFY_AGENT_ID="${'$'}AGENT_NOTIFY_PROJECT"
  elif [ -n "${'$'}AGENT_NOTIFY_PROVIDER" ]; then
    AGENT_NOTIFY_AGENT_ID="${'$'}AGENT_NOTIFY_PROVIDER-agent"
  fi
  [ -n "${'$'}AGENT_NOTIFY_AGENT_ID" ] && export AGENT_NOTIFY_AGENT_ID
}
if [ -n "${'$'}{AGENT_NOTIFY_MODEL:-}" ] && [ -n "${'$'}{AGENT_NOTIFY_AGENT_ID:-}" ] && [ "${'$'}AGENT_NOTIFY_AGENT_ID" = "${'$'}AGENT_NOTIFY_MODEL" ]; then
  AGENT_NOTIFY_AGENT_ID="${'$'}{AGENT_NOTIFY_PROJECT:-agent}"
  export AGENT_NOTIFY_AGENT_ID
fi
[ -n "${'$'}AGENT_NOTIFY_PROJECT" ] && export AGENT_NOTIFY_PROJECT
[ -n "${'$'}AGENT_NOTIFY_PROVIDER" ] && export AGENT_NOTIFY_PROVIDER
[ -n "${'$'}status" ] && AGENT_NOTIFY_STATUS="${'$'}{AGENT_NOTIFY_STATUS:-${'$'}status}"
[ -n "${'$'}AGENT_NOTIFY_STATUS" ] && export AGENT_NOTIFY_STATUS
[ -n "${'$'}voice" ] && AGENT_NOTIFY_VOICE_VOICE="${'$'}voice"
[ -n "${'$'}{AGENT_NOTIFY_VOICE_LOG_FILE:-}" ] || AGENT_NOTIFY_VOICE_LOG_FILE="${'$'}{HOME}/.local/state/agent-notify/cursor-voice-debug.log"
[ -n "${'$'}{AGENT_NOTIFY_HOOK_DEBUG_FILE:-}" ] && [ -z "${'$'}{AGENT_NOTIFY_VOICE_LOG_FILE:-}" ] && AGENT_NOTIFY_VOICE_LOG_FILE="${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
export AGENT_NOTIFY_VOICE_LOG_FILE

if [ -z "${'$'}AGENT_NOTIFY_CONTEXT" ]; then
  __agent_notify_context=""
  [ -n "${'$'}AGENT_NOTIFY_AGENT_ID" ] && __agent_notify_context="agent=${'$'}AGENT_NOTIFY_AGENT_ID"
  [ -n "${'$'}AGENT_NOTIFY_PROVIDER" ] && __agent_notify_context="${'$'}{__agent_notify_context:+${'$'}{__agent_notify_context} | }provider=${'$'}AGENT_NOTIFY_PROVIDER"
  [ -n "${'$'}AGENT_NOTIFY_PROJECT" ] && __agent_notify_context="${'$'}{__agent_notify_context:+${'$'}{__agent_notify_context} | }project=${'$'}AGENT_NOTIFY_PROJECT"
  [ -n "${'$'}AGENT_NOTIFY_MODEL" ] && __agent_notify_context="${'$'}{__agent_notify_context:+${'$'}{__agent_notify_context} | }model=${'$'}AGENT_NOTIFY_MODEL"
  [ -n "${'$'}AGENT_NOTIFY_STOP_ACTION" ] && __agent_notify_context="${'$'}{__agent_notify_context:+${'$'}{__agent_notify_context} | }action=${'$'}AGENT_NOTIFY_STOP_ACTION"
  AGENT_NOTIFY_CONTEXT="${'$'}__agent_notify_context"
fi

if [ -n "${'$'}AGENT_NOTIFY_DEBUG" ] && [ "${'$'}AGENT_NOTIFY_DEBUG" != "0" ] && [ -n "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE" ]; then
  echo "event=cursor.stop.wrapper.context" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "event_id=${'$'}AGENT_NOTIFY_EVENT_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "source=${'$'}AGENT_NOTIFY_HOOK_EVENT_SOURCE" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "hook_event_name=${'$'}AGENT_NOTIFY_HOOK_EVENT_NAME" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "agent_id=${'$'}{AGENT_NOTIFY_AGENT_ID:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "agent_name=${'$'}{AGENT_NOTIFY_AGENT_ID:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "project=${'$'}{AGENT_NOTIFY_PROJECT:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "provider=${'$'}{AGENT_NOTIFY_PROVIDER:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "model=${'$'}{AGENT_NOTIFY_MODEL:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "stop_action=${'$'}{AGENT_NOTIFY_STOP_ACTION:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "context=${'$'}{AGENT_NOTIFY_CONTEXT:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "voice_log=${'$'}{AGENT_NOTIFY_VOICE_LOG_FILE:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
fi

if [ ! -x "${'$'}AGENT_NOTIFY_NOTIFY_SCRIPT" ]; then
  echo "AGENT_NOTIFY_NOTIFY_SCRIPT not executable: ${'$'}AGENT_NOTIFY_NOTIFY_SCRIPT" >&2
  AGENT_NOTIFY_STOP_CHAIN_BROKEN="notify_script_not_executable"
  if [ -n "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE" ]; then
    echo "event=cursor.stop.wrapper.error" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "event_id=${'$'}AGENT_NOTIFY_EVENT_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "source=${'$'}AGENT_NOTIFY_HOOK_EVENT_SOURCE" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "hook_event_name=${'$'}AGENT_NOTIFY_HOOK_EVENT_NAME" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "exit=1" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "detail=notify_script_not_executable" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "stop_chain_broken_reason=${'$'}AGENT_NOTIFY_STOP_CHAIN_BROKEN" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
    echo "" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  fi
  exit 1
fi

if [ -n "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE" ]; then
  echo "event=cursor.stop.wrapper.forward" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "event_id=${'$'}AGENT_NOTIFY_EVENT_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "source=${'$'}AGENT_NOTIFY_HOOK_EVENT_SOURCE" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "hook_event_name=${'$'}AGENT_NOTIFY_HOOK_EVENT_NAME" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "agent_id=${'$'}AGENT_NOTIFY_AGENT_ID" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "project=${'$'}AGENT_NOTIFY_PROJECT" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "provider=${'$'}{AGENT_NOTIFY_PROVIDER:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "model=${'$'}{AGENT_NOTIFY_MODEL:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "stop_action=${'$'}{AGENT_NOTIFY_STOP_ACTION:-}" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "notify_script=${'$'}AGENT_NOTIFY_NOTIFY_SCRIPT" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "transcript_path=${'$'}AGENT_NOTIFY_TRANSCRIPT_PATH" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
  echo "" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE"
fi

AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT=0
if [ -n "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE" ]; then
  if "${'$'}AGENT_NOTIFY_NOTIFY_SCRIPT" >> "${'$'}AGENT_NOTIFY_HOOK_DEBUG_FILE" 2>&1; then
    AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT=0
  else
    AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT="$?"
    AGENT_NOTIFY_STOP_CHAIN_BROKEN="notify_script_failed_exit_${'$'}AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT"
  fi
else
  if "${'$'}AGENT_NOTIFY_NOTIFY_SCRIPT" >/dev/null 2>&1; then
    AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT=0
  else
    AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT="$?"
    AGENT_NOTIFY_STOP_CHAIN_BROKEN="notify_script_failed_exit_${'$'}AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT"
  fi
fi

  if [ "${'$'}{AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT:-0}" -eq 0 ] && [ -z "${'$'}{AGENT_NOTIFY_STOP_CHAIN_BROKEN:-}" ]; then
    echo "{\"event\":\"cursor.stop.wrapper.result\",\"event_id\":\"${'$'}{AGENT_NOTIFY_EVENT_ID}\",\"source\":\"${'$'}{AGENT_NOTIFY_HOOK_EVENT_SOURCE}\",\"hook_event_name\":\"${'$'}{AGENT_NOTIFY_HOOK_EVENT_NAME}\",\"agent_id\":\"${'$'}{AGENT_NOTIFY_AGENT_ID:-}\",\"project\":\"${'$'}{AGENT_NOTIFY_PROJECT:-}\",\"provider\":\"${'$'}{AGENT_NOTIFY_PROVIDER:-}\",\"model\":\"${'$'}{AGENT_NOTIFY_MODEL:-}\",\"stop_action\":\"${'$'}{AGENT_NOTIFY_STOP_ACTION:-}\",\"conversation_id\":\"${'$'}{conversation_id:-}\",\"generation_id\":\"${'$'}{generation_id:-}\",\"session_id\":\"${'$'}{session_id:-}\",\"transcript_path\":\"${'$'}{AGENT_NOTIFY_TRANSCRIPT_PATH:-}\",\"status\":\"${'$'}{status:-}\",\"notify_exit\":${'$'}{AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT:-0},\"ok\":true}"
  else
    echo "{\"event\":\"cursor.stop.wrapper.result\",\"event_id\":\"${'$'}{AGENT_NOTIFY_EVENT_ID}\",\"source\":\"${'$'}{AGENT_NOTIFY_HOOK_EVENT_SOURCE}\",\"hook_event_name\":\"${'$'}{AGENT_NOTIFY_HOOK_EVENT_NAME}\",\"agent_id\":\"${'$'}{AGENT_NOTIFY_AGENT_ID:-}\",\"project\":\"${'$'}{AGENT_NOTIFY_PROJECT:-}\",\"provider\":\"${'$'}{AGENT_NOTIFY_PROVIDER:-}\",\"model\":\"${'$'}{AGENT_NOTIFY_MODEL:-}\",\"stop_action\":\"${'$'}{AGENT_NOTIFY_STOP_ACTION:-}\",\"conversation_id\":\"${'$'}{conversation_id:-}\",\"generation_id\":\"${'$'}{generation_id:-}\",\"session_id\":\"${'$'}{session_id:-}\",\"transcript_path\":\"${'$'}{AGENT_NOTIFY_TRANSCRIPT_PATH:-}\",\"status\":\"${'$'}{status:-}\",\"notify_exit\":${'$'}{AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT:-0},\"ok\":false,\"stop_chain_broken\":\"${'$'}{AGENT_NOTIFY_STOP_CHAIN_BROKEN:-}\"}"
  fi

exit "${'$'}{AGENT_NOTIFY_NOTIFY_SCRIPT_EXIT:-0}"` 
}

/** Generate script content with optional system notification + voice + tmux marquee + ntfy */
export function createScript(
  sound: SoundName,
  comment: string,
  notifyTitle: string,
  notifyMsg: string,
  sayText: string,
  options: FeatureOptions,
  isCursor = false
): string {
  const lines: string[] = [
    "#!/usr/bin/env bash",
    `# ${comment}`,
    "",
  ];

  if (options.sound) {
    lines.push("# Play system sound");
    lines.push("printf '\\a'");
    lines.push("");
  }

  lines.push(
    `[ -z "${'$'}{AGENT_NOTIFY_NOTIFY_TITLE:-}" ] && AGENT_NOTIFY_NOTIFY_TITLE=${shellSingleQuote(notifyTitle)}`
  );
  lines.push(
    `[ -z "${'$'}{AGENT_NOTIFY_NOTIFY_MSG:-}" ] && AGENT_NOTIFY_NOTIFY_MSG=${shellSingleQuote(notifyMsg)}`
  );

  if (options.notification) {
    lines.push("# Show desktop notification");
    lines.push("if command -v notify-send >/dev/null 2>&1; then");
    lines.push('  notify-send "${AGENT_NOTIFY_NOTIFY_TITLE}" "${AGENT_NOTIFY_NOTIFY_MSG}"');
    lines.push("fi");
    lines.push("");
  }

  if (options.voice) {
    addVoiceAnnouncement(lines, sayText, isCursor);
  }

  if (options.tmux) {
    const cursorTmuxMessageExpr = isCursor
      ? "${AGENT_NOTIFY_NOTIFY_MSG:-${AGENT_NOTIFY_VOICE_TEXT}}"
      : "${AGENT_NOTIFY_NOTIFY_MSG}";
    addTmuxMarquee(lines, cursorTmuxMessageExpr);
    lines.push("");
  }

  if (options.ntfy && options.ntfyConfig) {
    const { url, topic } = options.ntfyConfig;
    const ntfyUrl = url.endsWith("/") ? `${url}${topic}` : `${url}/${topic}`;
    addNtfyPush(lines, shellSingleQuote(notifyMsg), shellSingleQuote(notifyTitle), ntfyUrl);
    lines.push("");
  }

  if (isCursor) {
    lines.push("# Emit machine-readable completion summary");
    lines.push('  __agent_notify_done_summary="${AGENT_NOTIFY_SUMMARY_TEXT:-}"');
    lines.push('  __agent_notify_done_action="${__agent_notify_voice_action_text:-${AGENT_NOTIFY_STOP_ACTION:-}}"');
    lines.push("  if command -v jq >/dev/null 2>&1; then");
    lines.push("    __agent_notify_final_event_id_json=\"$(printf '%s' \"${AGENT_NOTIFY_EVENT_ID:-}\" | jq -Rs .)\"");
    lines.push("    __agent_notify_final_agent_json=\"$(printf '%s' \"${AGENT_NOTIFY_AGENT_ID:-}\" | jq -Rs .)\"");
    lines.push("    __agent_notify_final_project_json=\"$(printf '%s' \"${AGENT_NOTIFY_PROJECT:-}\" | jq -Rs .)\"");
    lines.push("    __agent_notify_final_model_json=\"$(printf '%s' \"${AGENT_NOTIFY_MODEL:-cursor}\" | jq -Rs .)\"");
    lines.push("    __agent_notify_final_status_json=\"$(printf '%s' \"${AGENT_NOTIFY_STATUS:-done}\" | jq -Rs .)\"");
    lines.push("    __agent_notify_final_summary_json=\"$(printf '%s' \"${__agent_notify_done_summary}\" | jq -Rs .)\"");
    lines.push("    __agent_notify_final_action_json=\"$(printf '%s' \"${__agent_notify_done_action}\" | jq -Rs .)\"");
    lines.push("    __agent_notify_final_voice_text_json=\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_TEXT:-}\" | jq -Rs .)\"");
    lines.push("    __agent_notify_final_provider_json=\"$(printf '%s' \"${AGENT_NOTIFY_PROVIDER:-}\" | jq -Rs .)\"");
    lines.push("    __agent_notify_final_notify_msg_json=\"$(printf '%s' \"${AGENT_NOTIFY_NOTIFY_MSG:-}\" | jq -Rs .)\"");
    lines.push("  else");
    lines.push("    __agent_notify_escape_json='s/\\\\/\\\\\\\\/g; s/\"/\\\\\"/g; s/\\r/\\\\r/g; s/\\t/\\\\t/g; s/\\n/\\\\n/g'");
    lines.push("    __agent_notify_final_event_id_json=\"\\\"$(printf '%s' \"${AGENT_NOTIFY_EVENT_ID:-}\" | sed -e \"$__agent_notify_escape_json\")\\\"\"");
    lines.push("    __agent_notify_final_agent_json=\"\\\"$(printf '%s' \"${AGENT_NOTIFY_AGENT_ID:-}\" | sed -e \"$__agent_notify_escape_json\")\\\"\"");
    lines.push("    __agent_notify_final_project_json=\"\\\"$(printf '%s' \"${AGENT_NOTIFY_PROJECT:-}\" | sed -e \"$__agent_notify_escape_json\")\\\"\"");
    lines.push("    __agent_notify_final_model_json=\"\\\"$(printf '%s' \"${AGENT_NOTIFY_MODEL:-cursor}\" | sed -e \"$__agent_notify_escape_json\")\\\"\"");
    lines.push("    __agent_notify_final_status_json=\"\\\"$(printf '%s' \"${AGENT_NOTIFY_STATUS:-done}\" | sed -e \"$__agent_notify_escape_json\")\\\"\"");
    lines.push("    __agent_notify_final_summary_json=\"\\\"$(printf '%s' \"${__agent_notify_done_summary}\" | sed -e \"$__agent_notify_escape_json\")\\\"\"");
    lines.push("    __agent_notify_final_action_json=\"\\\"$(printf '%s' \"${__agent_notify_done_action}\" | sed -e \"$__agent_notify_escape_json\")\\\"\"");
    lines.push("    __agent_notify_final_voice_text_json=\"\\\"$(printf '%s' \"${AGENT_NOTIFY_VOICE_TEXT:-}\" | sed -e \"$__agent_notify_escape_json\")\\\"\"");
    lines.push("    __agent_notify_final_provider_json=\"\\\"$(printf '%s' \"${AGENT_NOTIFY_PROVIDER:-}\" | sed -e \"$__agent_notify_escape_json\")\\\"\"");
    lines.push("    __agent_notify_final_notify_msg_json=\"\\\"$(printf '%s' \"${AGENT_NOTIFY_NOTIFY_MSG:-}\" | sed -e \"$__agent_notify_escape_json\")\\\"\"");
    lines.push("  fi");
    lines.push('  cat <<EOF');
    lines.push('{"event":"cursor.done-script.result",');
    lines.push(' "event_id":${__agent_notify_final_event_id_json},');
    lines.push(' "agent":${__agent_notify_final_agent_json},');
    lines.push(' "project":${__agent_notify_final_project_json},');
    lines.push(' "provider":${__agent_notify_final_provider_json},');
    lines.push(' "model":${__agent_notify_final_model_json},');
    lines.push(' "status":${__agent_notify_final_status_json},');
    lines.push(' "summary":${__agent_notify_final_summary_json},');
    lines.push(' "action":${__agent_notify_final_action_json},');
    lines.push(' "voice_text":${__agent_notify_final_voice_text_json},');
    lines.push(' "notify_msg":${__agent_notify_final_notify_msg_json}');
    lines.push('}');
  lines.push("EOF");
  }

  return lines.join("\n");
}

/** Generate Claude scripts from sound config */
export function generateClaudeScripts(
  sounds: readonly SoundName[],
  options: FeatureOptions
): Record<ClaudeScriptName, string> {
  const configs = getClaudeScriptConfigs();
  return configs.reduce((acc, config, i) => {
    acc[config.name as ClaudeScriptName] = createScript(
      sounds[i] ?? config.defaultSound,
      config.comment,
      config.notifyTitle,
      config.notifyMsg,
      config.sayText,
      options
    );
    return acc;
  }, {} as Record<ClaudeScriptName, string>);
}

/** Generate Cursor scripts from sound config */
export function generateCursorScripts(
  sounds: readonly SoundName[],
  options: FeatureOptions
): Record<CursorScriptName, string> {
  const configs = getCursorScriptConfigs();
  return configs.reduce((acc, config, i) => {
    acc[config.name as CursorScriptName] = createScript(
      sounds[i] ?? config.defaultSound,
      config.comment,
      config.notifyTitle,
      config.notifyMsg,
      config.sayText,
      options,
      true
    );
    return acc;
  }, {} as Record<CursorScriptName, string>);
}

/** @deprecated Use generateClaudeScripts instead */
export const generateScripts = generateClaudeScripts;

// ============================================
// Codex script generation
// ============================================

export const CODEX_SCRIPT_NAME = "codex-notify.sh";

/** Generate Codex notification script that handles JSON input */
export function generateCodexScript(
  sound: SoundName,
  options: FeatureOptions
): string {
  const notifyTitle = t("codexNotifyTitle");
  const notifyMsg = t("codexNotifyMsgDone");
  const sayText = t("codexSayDone");
  const comment = t("codexCommentDone");

  const lines: string[] = [
    "#!/usr/bin/env bash",
    `# ${comment}`,
    "",
    "# Codex passes JSON as first argument",
    'JSON="$1"',
    "",
    "# Check if jq is available, otherwise use simple grep",
    "if command -v jq &> /dev/null; then",
    '  TYPE=$(echo "$JSON" | jq -r \'.type // empty\')',
    "else",
    "  # Fallback: extract type using grep/sed",
    '  TYPE=$(echo "$JSON" | grep -o \'"type"[[:space:]]*:[[:space:]]*"[^"]*"\' | sed \'s/.*"\\([^\"]*\\)"$/\\1/\')',
    "fi",
    "AGENT_NOTIFY_ENV_FILE=\"${AGENT_NOTIFY_ENV_FILE:-$HOME/.config/agent-notify/.env}\"",
    "if [ -f \"${AGENT_NOTIFY_ENV_FILE}\" ]; then",
    "  set -a",
    "  . \"${AGENT_NOTIFY_ENV_FILE}\"",
    "  set +a",
    "fi",
    "",
    '# Only notify on agent-turn-complete',
    'if [ "$TYPE" != "agent-turn-complete" ]; then',
    "  exit 0",
    "fi",
    '[ -z "${AGENT_NOTIFY_VOICE_MODE:-}" ] && AGENT_NOTIFY_VOICE_MODE="local"',
    '[ -z "${AGENT_NOTIFY_VOICE_URL:-}" ] && AGENT_NOTIFY_VOICE_URL="http://localhost:18008/v1/audio/speech"',
    `AGENT_NOTIFY_NOTIFY_TITLE=${shellSingleQuote(notifyTitle)}`,
    `AGENT_NOTIFY_NOTIFY_MSG=${shellSingleQuote(notifyMsg)}`,
    'AGENT_NOTIFY_VOICE_MODEL="codex"',
    'AGENT_NOTIFY_VOICE_AGENT="codex"',
    'AGENT_NOTIFY_VOICE_PROJECT="codex"',
    'AGENT_NOTIFY_VOICE_ACTION=""',
    'AGENT_NOTIFY_VOICE_ACTION_SOURCE=""',
    'AGENT_NOTIFY_VOICE_SUMMARY=""',
    'AGENT_NOTIFY_VOICE_SUMMARY_SOURCE=""',
    "if command -v jq &> /dev/null; then",
    '  AGENT_NOTIFY_VOICE_SUMMARY_SOURCE="jq"',
    '  AGENT_NOTIFY_VOICE_MODEL=$(echo "$JSON" | jq -r \'[.model // .metadata.model // .provider // .metadata.provider // .model_name // .metadata.model_name // "codex"] | map(select(type=="string" and . != "")) | .[0] // "codex"\')',
    '  AGENT_NOTIFY_VOICE_AGENT=$(echo "$JSON" | jq -r \'[.agent // .metadata.agent // .agent_id // .metadata.agent_id // empty, "codex"] | map(select(type=="string" and . != "")) | .[0] // "codex"\')',
    '  AGENT_NOTIFY_VOICE_PROJECT=$(echo "$JSON" | jq -r \'[.project // .project_name // .metadata.project // .workspace // .cwd // empty, "codex"] | map(select(type=="string" and . != "")) | .[0] // "codex"\')',
    '  AGENT_NOTIFY_VOICE_ACTION=$(echo "$JSON" | jq -r \'[.action // .result.action // .metadata.action // empty] | map(select(type=="string" and . != "")) | .[0] // ""\')',
    '  [ -n "${AGENT_NOTIFY_VOICE_ACTION}" ] && AGENT_NOTIFY_VOICE_ACTION_SOURCE="jq-action"',
    '  AGENT_NOTIFY_VOICE_SUMMARY=$(echo "$JSON" | jq -r \'[.summary // .result.summary // .output // .message // .result.message // .assistant.summary // .assistant.message // .assistant.output // .result.text // .result.content // empty] | map(select(type=="string" and . != "")) | .[0] // ""\')',
    "else",
    '  AGENT_NOTIFY_VOICE_SUMMARY_SOURCE="grep"',
    '  AGENT_NOTIFY_VOICE_MODEL=$(echo "$JSON" | sed -n \'s/.*\\\"model\\\"[[:space:]]*:[[:space:]]*\\\"\\([^\\\"]*\\)\\\".*/\\1/p\' | head -n1)',
    '  [ -z "$AGENT_NOTIFY_VOICE_MODEL" ] && AGENT_NOTIFY_VOICE_MODEL=$(echo "$JSON" | sed -n \'s/.*\\\"provider\\\"[[:space:]]*:[[:space:]]*\\\"\\([^\\\"]*\\)\\\".*/\\1/p\' | head -n1)',
    '  [ -z "$AGENT_NOTIFY_VOICE_MODEL" ] && AGENT_NOTIFY_VOICE_MODEL="codex"',
    '  AGENT_NOTIFY_VOICE_AGENT=$(echo "$JSON" | sed -n \'s/.*\\\"agent\\\"[[:space:]]*:[[:space:]]*\\\"\\([^\\\"]*\\)\\\".*/\\1/p\' | head -n1)',
    '  AGENT_NOTIFY_VOICE_PROJECT=$(echo "$JSON" | sed -n \'s/.*\\\"project\\\"[[:space:]]*:[[:space:]]*\\\"\\([^\\\"]*\\)\\\".*/\\1/p\' | head -n1)',
    '  AGENT_NOTIFY_VOICE_ACTION=$(echo "$JSON" | sed -n \'s/.*\\\"action\\\"[[:space:]]*:[[:space:]]*\\\"\\([^\\\"]*\\)\\\".*/\\1/p\' | head -n1)',
    '  [ -z "$AGENT_NOTIFY_VOICE_ACTION" ] && AGENT_NOTIFY_VOICE_ACTION=$(echo "$JSON" | sed -n \'s/.*\\\"result\\\"[[:space:]]*:[[:space:]]*{[^}]*\\\"action\\\"[[:space:]]*:[[:space:]]*\\\"\\([^\\\"]*\\)\\\".*/\\1/p\' | head -n1)',
    '  [ -n "$AGENT_NOTIFY_VOICE_ACTION" ] && AGENT_NOTIFY_VOICE_ACTION_SOURCE="grep-action"',
    '  AGENT_NOTIFY_VOICE_SUMMARY=$(echo "$JSON" | sed -n \'s/.*\\\"summary\\\"[[:space:]]*:[[:space:]]*\\\"\\([^\\\"]*\\)\\\".*/\\1/p\' | head -n1)',
    "fi",
    'AGENT_NOTIFY_VOICE_PROJECT="${AGENT_NOTIFY_VOICE_PROJECT##*/}"',
    'if [ -n "${AGENT_NOTIFY_VOICE_SUMMARY}" ]; then',
    '  AGENT_NOTIFY_NOTIFY_MSG="${AGENT_NOTIFY_VOICE_MODEL}/${AGENT_NOTIFY_VOICE_AGENT}: they report ${AGENT_NOTIFY_VOICE_SUMMARY}"',
    '  AGENT_NOTIFY_VOICE_TEXT="${AGENT_NOTIFY_VOICE_MODEL}/${AGENT_NOTIFY_VOICE_AGENT} task ${AGENT_NOTIFY_VOICE_ACTION:-completed}, they report: ${AGENT_NOTIFY_VOICE_SUMMARY}"',
    'else',
    '  AGENT_NOTIFY_NOTIFY_MSG="${AGENT_NOTIFY_VOICE_MODEL}/${AGENT_NOTIFY_VOICE_AGENT} task completed"',
    '  AGENT_NOTIFY_VOICE_TEXT="${AGENT_NOTIFY_VOICE_MODEL}/${AGENT_NOTIFY_VOICE_AGENT} task completed"',
    "fi",
    'if [ -n "${AGENT_NOTIFY_VOICE_ACTION}" ]; then',
    '  AGENT_NOTIFY_NOTIFY_MSG="${AGENT_NOTIFY_NOTIFY_MSG} | next: ${AGENT_NOTIFY_VOICE_ACTION}"',
    '  AGENT_NOTIFY_VOICE_TEXT="${AGENT_NOTIFY_VOICE_TEXT} next: ${AGENT_NOTIFY_VOICE_ACTION}"',
    "fi",
    'if [ "${AGENT_NOTIFY_DEBUG:-0}" != "0" ] && [ -n "${AGENT_NOTIFY_HOOK_DEBUG_FILE:-}" ]; then',
    '  echo "event=codex.notify.result" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "type=${TYPE}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "provider_model=${AGENT_NOTIFY_VOICE_MODEL}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "agent=${AGENT_NOTIFY_VOICE_AGENT}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "project=${AGENT_NOTIFY_VOICE_PROJECT}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "summary_source=${AGENT_NOTIFY_VOICE_SUMMARY_SOURCE}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "summary=${AGENT_NOTIFY_VOICE_SUMMARY}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "action_source=${AGENT_NOTIFY_VOICE_ACTION_SOURCE}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "action=${AGENT_NOTIFY_VOICE_ACTION}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "notify_msg=${AGENT_NOTIFY_NOTIFY_MSG}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "voice_text=${AGENT_NOTIFY_VOICE_TEXT}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "payload=${JSON}" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    '  echo "" >> "${AGENT_NOTIFY_HOOK_DEBUG_FILE}"',
    "fi",
    "",
  ];

  if (options.sound) {
    lines.push("# Play system sound");
    lines.push("printf '\\a'");
    lines.push("");
  }

  if (options.notification) {
    lines.push("# Show desktop notification");
    lines.push("if command -v notify-send >/dev/null 2>&1; then");
    lines.push('  notify-send "${AGENT_NOTIFY_NOTIFY_TITLE}" "${AGENT_NOTIFY_NOTIFY_MSG}"');
    lines.push("fi");
    lines.push("");
  }

  if (options.voice) {
    addVoiceAnnouncement(lines, sayText);
  }

  if (options.tmux) {
    addTmuxMarquee(lines, "${AGENT_NOTIFY_NOTIFY_MSG}");
    lines.push("");
  }

  if (options.ntfy && options.ntfyConfig) {
    const { url, topic } = options.ntfyConfig;
    const ntfyUrl = url.endsWith("/") ? `${url}${topic}` : `${url}/${topic}`;
    addNtfyPush(lines, shellSingleQuote(notifyMsg), shellSingleQuote(notifyTitle), ntfyUrl);
    lines.push("");
  }

  lines.push('  if command -v jq >/dev/null 2>&1; then');
  lines.push('    __codex_result_event_id="$(printf "%s" "${AGENT_NOTIFY_EVENT_ID:-}" | jq -Rs .)"');
  lines.push('    __codex_result_agent="$(printf "%s" "${AGENT_NOTIFY_VOICE_AGENT:-}" | jq -Rs .)"');
  lines.push('    __codex_result_project="$(printf "%s" "${AGENT_NOTIFY_VOICE_PROJECT:-}" | jq -Rs .)"');
  lines.push('    __codex_result_model="$(printf "%s" "${AGENT_NOTIFY_VOICE_MODEL:-}" | jq -Rs .)"');
  lines.push('    __codex_result_action="$(printf "%s" "${AGENT_NOTIFY_VOICE_ACTION:-}" | jq -Rs .)"');
  lines.push('    __codex_result_summary="$(printf "%s" "${AGENT_NOTIFY_VOICE_SUMMARY:-}" | jq -Rs .)"');
  lines.push('    __codex_result_msg="$(printf "%s" "${AGENT_NOTIFY_NOTIFY_MSG:-}" | jq -Rs .)"');
  lines.push('    __codex_result_voice_text="$(printf "%s" "${AGENT_NOTIFY_VOICE_TEXT:-}" | jq -Rs .)"');
  lines.push("    cat <<EOF");
  lines.push('{"event":"codex.notify.result",');
  lines.push(' "event_id":${__codex_result_event_id},');
  lines.push(' "type":"${TYPE}",');
  lines.push(' "agent":${__codex_result_agent},');
  lines.push(' "project":${__codex_result_project},');
  lines.push(' "model":${__codex_result_model},');
  lines.push(' "action":${__codex_result_action},');
  lines.push(' "summary":${__codex_result_summary},');
  lines.push(' "notify_msg":${__codex_result_msg},');
  lines.push(' "voice_text":${__codex_result_voice_text}');
  lines.push('}');
  lines.push("EOF");
  lines.push("  else");
  lines.push('    __codex_escape_json="s/\\\\/\\\\\\\\/g; s/\"/\\\\\"/g; s/\\r/\\\\r/g; s/\\t/\\\\t/g; s/\\n/\\\\n/g"');
  lines.push('    __codex_result_event_id="$(printf "%s" "${AGENT_NOTIFY_EVENT_ID:-}" | sed -e "${__codex_escape_json}")"');
  lines.push('    __codex_result_agent="$(printf "%s" "${AGENT_NOTIFY_VOICE_AGENT:-}" | sed -e "${__codex_escape_json}")"');
  lines.push('    __codex_result_project="$(printf "%s" "${AGENT_NOTIFY_VOICE_PROJECT:-}" | sed -e "${__codex_escape_json}")"');
  lines.push('    __codex_result_model="$(printf "%s" "${AGENT_NOTIFY_VOICE_MODEL:-}" | sed -e "${__codex_escape_json}")"');
  lines.push('    __codex_result_action="$(printf "%s" "${AGENT_NOTIFY_VOICE_ACTION:-}" | sed -e "${__codex_escape_json}")"');
  lines.push('    __codex_result_summary="$(printf "%s" "${AGENT_NOTIFY_VOICE_SUMMARY:-}" | sed -e "${__codex_escape_json}")"');
  lines.push('    __codex_result_msg="$(printf "%s" "${AGENT_NOTIFY_NOTIFY_MSG:-}" | sed -e "${__codex_escape_json}")"');
  lines.push('    __codex_result_voice_text="$(printf "%s" "${AGENT_NOTIFY_VOICE_TEXT:-}" | sed -e "${__codex_escape_json}")"');
  lines.push("    cat <<EOF");
  lines.push('{"event":"codex.notify.result",');
  lines.push(' "event_id":"${__codex_result_event_id}",');
  lines.push(' "type":"${TYPE}",');
  lines.push(' "agent":"${__codex_result_agent}",');
  lines.push(' "project":"${__codex_result_project}",');
  lines.push(' "model":"${__codex_result_model}",');
  lines.push(' "action":"${__codex_result_action}",');
  lines.push(' "summary":"${__codex_result_summary}",');
  lines.push(' "notify_msg":"${__codex_result_msg}",');
  lines.push(' "voice_text":"${__codex_result_voice_text}"');
  lines.push('}');
  lines.push("EOF");
  lines.push("  fi");

  return lines.join("\n");
}

// ============================================
// CLI notify script generation
// ============================================

export const CLI_SCRIPT_NAME = "notify";

/** Generate CLI notify script that handles exit code from previous command */
export function generateCliScript(
  sound: SoundName,
  options: FeatureOptions
): string {
  const comment = t("cliCommentDone");
  const successTitle = t("cliNotifyTitleSuccess");
  const successMsg = t("cliNotifyMsgSuccess");
  const failedTitle = t("cliNotifyTitleFailed");
  const failedMsg = t("cliNotifyMsgFailed");
  const saySuccess = t("cliSaySuccess");
  const sayFailed = t("cliSayFailed");

  // Pre-compute ntfy URL if needed
  const ntfyUrl = options.ntfy && options.ntfyConfig
    ? (options.ntfyConfig.url.endsWith("/")
        ? `${options.ntfyConfig.url}${options.ntfyConfig.topic}`
        : `${options.ntfyConfig.url}/${options.ntfyConfig.topic}`)
    : null;

  const lines: string[] = [
    "#!/usr/bin/env bash",
    `# ${comment}`,
    "",
    "# Usage: command; notify $?",
    "# Or define a shell function: notify() { /path/to/notify \"$?\"; }",
    "",
    "# Get exit status from argument (default to 0 if not provided)",
    'EXIT_STATUS="${1:-0}"',
    "",
    'if [ "$EXIT_STATUS" -eq 0 ]; then',
    "  # Success notification",
  ];

  if (options.sound) {
    lines.push("  printf '\\a'");
  }

  if (options.notification) {
    lines.push("  if command -v notify-send >/dev/null 2>&1; then");
    lines.push(`    notify-send ${shellSingleQuote(successTitle)} ${shellSingleQuote(successMsg)}`);
    lines.push("  fi");
  }

  if (options.voice) {
    addVoiceAnnouncement(lines, saySuccess);
  }

  if (ntfyUrl) {
    addNtfyPush(lines, shellSingleQuote(successMsg), shellSingleQuote(successTitle), ntfyUrl);
  }

  if (options.tmux) {
    addTmuxMarquee(lines, shellSingleQuote(`${successTitle}: ${successMsg}`));
  }

  lines.push("else");
  lines.push("  # Failure notification");

  if (options.sound) {
    lines.push("  printf '\\a'");
  }

  if (options.notification) {
    lines.push("  if command -v notify-send >/dev/null 2>&1; then");
    lines.push(`    notify-send ${shellSingleQuote(failedTitle)} "${failedMsg} (exit code: ${'$'}EXIT_STATUS)"`);
    lines.push("  fi");
  }

  if (options.voice) {
    addVoiceAnnouncement(lines, sayFailed);
  }

  if (ntfyUrl) {
    addNtfyPush(
      lines,
      `"${failedMsg} (exit code: ${'$'}EXIT_STATUS)"`,
      shellSingleQuote(failedTitle),
      ntfyUrl,
      "high"
    );
  }

  if (options.tmux) {
    addTmuxMarquee(
      lines,
      `"${failedMsg} (exit code: ${'$'}EXIT_STATUS)"`
    );
  }

  lines.push("fi");
  lines.push("");

  return lines.join("\n");
}
