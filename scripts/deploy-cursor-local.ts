#!/usr/bin/env bun
/**
 * Deploy Cursor voice + summary scripts from this repo to ~/.local/bin and
 * merge ~/.cursor/hooks.json with the managed stop hook (non-interactive).
 */
import { join } from "node:path";
import { homedir } from "node:os";
import {
  generateCursorScripts,
  generateCursorStopHookWrapperScript,
  generateCursorSessionContextToolScript,
  CURSOR_STOP_WRAPPER_NAME,
  CURSOR_SESSION_CONTEXT_TOOL_NAME,
  type FeatureOptions,
} from "../src/config/scripts.ts";
import { mergeCursorHooksConfig } from "../src/config/hooks.ts";
import {
  readCursorHooksSafe,
  writeCursorHooks,
  mergeCursorHooksConfig as mergeCursorHooksIntoFull,
  getCursorHooksPayload,
} from "../src/utils/settings.ts";
import { writeExecutable, ensureDir } from "../src/utils/fs.ts";
import { AGENT_NOTIFY_CONFIG_DIR, AGENT_NOTIFY_ENV_FILE } from "../src/config/constants.ts";

const AGENT_NOTIFY_ENV_TEMPLATE = `# Agent notify runtime environment
# Put sensitive values here, not in hook files.
# Values with spaces MUST be double-quoted (bash: AGENT_NOTIFY_VOICE_PLAYER_ARGS="-D plughw:1,0").

AGENT_NOTIFY_VOICE_MODE=local
AGENT_NOTIFY_VOICE_URL=http://localhost:18008/v1/audio/speech
AGENT_NOTIFY_VOICE_TIMEOUT=30

AGENT_NOTIFY_SUMMARY_ENABLED=1
AGENT_NOTIFY_SUMMARY_PRIMARY_URL=http://100.121.154.23:8080/v1/chat/completions
AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL=qwen2.5-1.5b-instruct-q8_0
AGENT_NOTIFY_SUMMARY_FALLBACK_URL=https://api.openai.com/v1/chat/completions
AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL=gpt-5.4-mini
#AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY=
#AGENT_NOTIFY_VOICE_API_KEY=
`;

const binDir = join(homedir(), ".local/bin");
const sounds: ("Glass")[] = ["Glass"];
const featureOptions: FeatureOptions = {
  sound: true,
  notification: true,
  voice: true,
  tmux: true,
  ntfy: false,
};

await ensureDir(binDir);
await ensureDir(join(homedir(), ".local/state/agent-notify"));
await ensureDir(AGENT_NOTIFY_CONFIG_DIR);
if (!(await Bun.file(AGENT_NOTIFY_ENV_FILE).exists())) {
  await Bun.write(AGENT_NOTIFY_ENV_FILE, AGENT_NOTIFY_ENV_TEMPLATE);
  console.log(`Created ${AGENT_NOTIFY_ENV_FILE} (template - add keys if needed)`);
}

const scripts = generateCursorScripts(sounds, featureOptions);
for (const [name, content] of Object.entries(scripts)) {
  await writeExecutable(join(binDir, name), content);
}
await writeExecutable(join(binDir, CURSOR_SESSION_CONTEXT_TOOL_NAME), generateCursorSessionContextToolScript());
await writeExecutable(join(binDir, CURSOR_STOP_WRAPPER_NAME), generateCursorStopHookWrapperScript());

const cursorHooksResult = await readCursorHooksSafe();
if (!cursorHooksResult.ok) {
  console.error(cursorHooksResult.message);
  process.exit(1);
}
const existingHooks = getCursorHooksPayload(cursorHooksResult.data);
const newHooks = mergeCursorHooksConfig(
  existingHooks as Parameters<typeof mergeCursorHooksConfig>[0],
  binDir,
);
const merged = mergeCursorHooksIntoFull(cursorHooksResult.data, newHooks as Record<string, unknown>);
await writeCursorHooks(merged);

console.log(`Wrote scripts under ${binDir}`);
console.log(`Updated Cursor hooks (stop -> ${CURSOR_STOP_WRAPPER_NAME})`);
