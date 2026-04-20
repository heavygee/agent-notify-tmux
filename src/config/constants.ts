import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();

// Claude Code
export const CLAUDE_DIR = join(HOME, ".claude");
export const SETTINGS_FILE = join(CLAUDE_DIR, "settings.json");

// Cursor
export const CURSOR_DIR = join(HOME, ".cursor");
export const CURSOR_HOOKS_FILE = join(CURSOR_DIR, "hooks.json");

/** agent-notify runtime config */
export const AGENT_NOTIFY_CONFIG_DIR = join(HOME, ".config", "agent-notify");
export const AGENT_NOTIFY_ENV_FILE = join(AGENT_NOTIFY_CONFIG_DIR, ".env");

// OpenAI Codex
export const CODEX_DIR = join(HOME, ".codex");
export const CODEX_CONFIG_FILE = join(CODEX_DIR, "config.toml");
