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
const DEFAULT_VOICE_MODE = "script";
const DEFAULT_VOICE_STACK_URL = "http://localhost:18008/v1/audio/speech";
const DEFAULT_VOICE_OPENAI_URL = "https://api.openai.com/v1/audio/speech";
const DEFAULT_VOICE_MODEL = "tts-1";
const DEFAULT_VOICE_NAME = "xev";
const DEFAULT_VOICE_RESPONSE_FORMAT = "mp3";
const TMUX_MARQUEE_WIDTH = 28;
const TMUX_MARQUEE_STEPS = 24;

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

/** Add voice announcement logic with optional modes:
 * - script: run legacy local command (DEFAULT_VOICE_COMMAND)
 * - local: call OpenAI-compatible speech endpoint (default local speech stack)
 * - openai: call OpenAI-compatible speech endpoint with API key support
 */
function addVoiceAnnouncement(lines: string[], sayText: string) {
  lines.push("# Voice announcement");
  lines.push(`AGENT_NOTIFY_VOICE_MODE="${'$'}{AGENT_NOTIFY_VOICE_MODE:-${DEFAULT_VOICE_MODE}}"`);
  lines.push(`AGENT_NOTIFY_VOICE_URL="${'$'}{AGENT_NOTIFY_VOICE_URL:-}"`);
  lines.push(`AGENT_NOTIFY_VOICE_MODEL="${'$'}{AGENT_NOTIFY_VOICE_MODEL:-${DEFAULT_VOICE_MODEL}}"`);
  lines.push(`AGENT_NOTIFY_VOICE_VOICE="${'$'}{AGENT_NOTIFY_VOICE_VOICE:-${DEFAULT_VOICE_NAME}}"`);
  lines.push(`AGENT_NOTIFY_VOICE_RESPONSE_FORMAT="${'$'}{AGENT_NOTIFY_VOICE_RESPONSE_FORMAT:-${DEFAULT_VOICE_RESPONSE_FORMAT}}"`);
  lines.push(`AGENT_NOTIFY_VOICE_TIMEOUT="${'$'}{AGENT_NOTIFY_VOICE_TIMEOUT:-6}"`);
  lines.push(`AGENT_NOTIFY_VOICE_TEXT=${shellSingleQuote(sayText)}`);
  lines.push("");
  lines.push('if [ "$AGENT_NOTIFY_VOICE_MODE" = "script" ]; then');
  lines.push(`  if [ -x "${DEFAULT_VOICE_COMMAND}" ]; then`);
  lines.push(`    "${DEFAULT_VOICE_COMMAND}" ${shellSingleQuote(sayText)}`);
  lines.push(`  elif command -v "${DEFAULT_VOICE_COMMAND}" >/dev/null 2>&1; then`);
  lines.push(`    sh "${DEFAULT_VOICE_COMMAND}" ${shellSingleQuote(sayText)}`);
  lines.push("  fi");
  lines.push("else");
  lines.push("  if [ -z \"$AGENT_NOTIFY_VOICE_URL\" ]; then");
  lines.push("    if [ \"$AGENT_NOTIFY_VOICE_MODE\" = \"openai\" ]; then");
  lines.push(`      AGENT_NOTIFY_VOICE_URL=${shellSingleQuote(DEFAULT_VOICE_OPENAI_URL)}`);
  lines.push("    else");
  lines.push(`      AGENT_NOTIFY_VOICE_URL=${shellSingleQuote(DEFAULT_VOICE_STACK_URL)}`);
  lines.push("    fi");
  lines.push("  fi");
  lines.push("  if command -v curl >/dev/null 2>&1; then");
  lines.push("    __agent_notify_voice_ext=\"${AGENT_NOTIFY_VOICE_RESPONSE_FORMAT}\"");
  lines.push("    __agent_notify_voice_tmp_body=$(mktemp /tmp/agent-notify-voice-body.XXXXXX.json)");
  lines.push("    __agent_notify_voice_tmp_file=$(mktemp /tmp/agent-notify-voice.XXXXXX.${__agent_notify_voice_ext})");
  lines.push('    cat > "$__agent_notify_voice_tmp_body" <<EOF');
  lines.push('{"model": "${AGENT_NOTIFY_VOICE_MODEL}",');
  lines.push(' "input": "${AGENT_NOTIFY_VOICE_TEXT}",');
  lines.push(' "voice": "${AGENT_NOTIFY_VOICE_VOICE}",');
  lines.push(' "response_format": "${AGENT_NOTIFY_VOICE_RESPONSE_FORMAT}"');
  lines.push("}");
  lines.push("EOF");
  lines.push("    __agent_notify_voice_code=0");
  lines.push("    if [ \"$AGENT_NOTIFY_VOICE_MODE\" = \"openai\" ] && [ -n \"${AGENT_NOTIFY_VOICE_API_KEY:-}\" ]; then");
  lines.push("      curl -m \"$AGENT_NOTIFY_VOICE_TIMEOUT\" -sS -X POST \"$AGENT_NOTIFY_VOICE_URL\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer $AGENT_NOTIFY_VOICE_API_KEY\" --data-binary \"@$__agent_notify_voice_tmp_body\" -o \"$__agent_notify_voice_tmp_file\" || __agent_notify_voice_code=$?");
  lines.push("    else");
  lines.push("      curl -m \"$AGENT_NOTIFY_VOICE_TIMEOUT\" -sS -X POST \"$AGENT_NOTIFY_VOICE_URL\" -H \"Content-Type: application/json\" --data-binary \"@$__agent_notify_voice_tmp_body\" -o \"$__agent_notify_voice_tmp_file\" || __agent_notify_voice_code=$?");
  lines.push("    fi");
  lines.push("    rm -f \"$__agent_notify_voice_tmp_body\"");
  lines.push("    if [ \"$__agent_notify_voice_code\" -eq 0 ] && [ -s \"$__agent_notify_voice_tmp_file\" ]; then");
  lines.push("      if command -v ffplay >/dev/null 2>&1; then");
  lines.push("        ffplay -nodisp -autoexit -loglevel quiet \"$__agent_notify_voice_tmp_file\" >/dev/null 2>&1");
  lines.push("      elif command -v mpv >/dev/null 2>&1; then");
  lines.push("        mpv --really-quiet --no-terminal \"$__agent_notify_voice_tmp_file\" >/dev/null 2>&1");
  lines.push("      elif command -v mpg123 >/dev/null 2>&1; then");
  lines.push("        mpg123 -q \"$__agent_notify_voice_tmp_file\" >/dev/null 2>&1");
  lines.push("      elif command -v paplay >/dev/null 2>&1; then");
  lines.push("        paplay \"$__agent_notify_voice_tmp_file\" >/dev/null 2>&1");
  lines.push("      elif command -v aplay >/dev/null 2>&1; then");
  lines.push("        aplay \"$__agent_notify_voice_tmp_file\" >/dev/null 2>&1");
  lines.push("      elif command -v afplay >/dev/null 2>&1; then");
  lines.push("        afplay \"$__agent_notify_voice_tmp_file\" >/dev/null 2>&1");
  lines.push("      fi");
  lines.push("    fi");
  lines.push("    rm -f \"$__agent_notify_voice_tmp_file\"");
  lines.push("  fi");
  lines.push("fi");
  lines.push("");
}

function addTmuxMarquee(lines: string[], messageExpr: string) {
  lines.push("# Show completion marquee on tmux status-right");
  lines.push('if [ -n "${TMUX:-}" ] && command -v tmux >/dev/null 2>&1; then');
  lines.push("  __agent_notify_tmux_old_status_right=\"$(tmux show-option -gv status-right 2>/dev/null || true)\"");
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
  lines.push('    tmux set-option -g status-right "${__agent_notify_tmux_old_status_right}"');
  lines.push("  ) >/dev/null 2>&1 &");
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

/** Generate script content with optional system notification + voice + tmux marquee + ntfy */
export function createScript(
  sound: SoundName,
  comment: string,
  notifyTitle: string,
  notifyMsg: string,
  sayText: string,
  options: FeatureOptions
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

  if (options.notification) {
    lines.push("# Show desktop notification");
    lines.push("if command -v notify-send >/dev/null 2>&1; then");
    lines.push(`  notify-send ${shellSingleQuote(notifyTitle)} ${shellSingleQuote(notifyMsg)}`);
    lines.push("fi");
    lines.push("");
  }

  if (options.voice) {
    addVoiceAnnouncement(lines, sayText);
  }

  if (options.tmux) {
    addTmuxMarquee(lines, shellSingleQuote(`${notifyTitle}: ${notifyMsg}`));
    lines.push("");
  }

  if (options.ntfy && options.ntfyConfig) {
    const { url, topic } = options.ntfyConfig;
    const ntfyUrl = url.endsWith("/") ? `${url}${topic}` : `${url}/${topic}`;
    addNtfyPush(lines, shellSingleQuote(notifyMsg), shellSingleQuote(notifyTitle), ntfyUrl);
    lines.push("");
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
      options
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
    "",
    '# Only notify on agent-turn-complete',
    'if [ "$TYPE" != "agent-turn-complete" ]; then',
    "  exit 0",
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
    lines.push(`  notify-send ${shellSingleQuote(notifyTitle)} ${shellSingleQuote(notifyMsg)}`);
    lines.push("fi");
    lines.push("");
  }

  if (options.voice) {
    addVoiceAnnouncement(lines, sayText);
  }

  if (options.tmux) {
    addTmuxMarquee(lines, shellSingleQuote(`${notifyTitle}: ${notifyMsg}`));
    lines.push("");
  }

  if (options.ntfy && options.ntfyConfig) {
    const { url, topic } = options.ntfyConfig;
    const ntfyUrl = url.endsWith("/") ? `${url}${topic}` : `${url}/${topic}`;
    addNtfyPush(lines, shellSingleQuote(notifyMsg), shellSingleQuote(notifyTitle), ntfyUrl);
    lines.push("");
  }

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
