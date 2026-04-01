import { isValidSettings, type Settings, type HooksConfig } from "../types";
import { SETTINGS_FILE, CLAUDE_DIR, CURSOR_HOOKS_FILE, CURSOR_DIR } from "../config/constants";
import { readJsonSafe, writeJson, ensureDir } from "./fs";

/** Empty settings constant */
const EMPTY_SETTINGS: Settings = {};

/** Merge settings preserving key order */
export function mergeSettings(
  existing: Settings,
  hooks: HooksConfig
): Settings {
  const result: Settings = {};
  const hasHooks = "hooks" in existing;

  for (const key of Object.keys(existing)) {
    result[key] = key === "hooks" ? hooks : existing[key];
  }

  if (!hasHooks) result.hooks = hooks;

  return result;
}

/** Settings read result type */
export type SettingsReadResult =
  | { ok: true; data: Settings; isNew: boolean }
  | { ok: false; error: "parse_error"; message: string; path: string };

/** Read and validate settings.json */
export async function readSettingsSafe(): Promise<SettingsReadResult> {
  const result = await readJsonSafe<unknown>(SETTINGS_FILE);

  if (!result.ok && result.error === "not_found") {
    return { ok: true, data: EMPTY_SETTINGS, isNew: true };
  }

  if (!result.ok && result.error === "parse_error") {
    return {
      ok: false,
      error: "parse_error",
      message: result.message,
      path: SETTINGS_FILE,
    };
  }

  if (!isValidSettings(result.data)) {
    return {
      ok: false,
      error: "parse_error",
      message: "Settings must be an object",
      path: SETTINGS_FILE,
    };
  }

  return { ok: true, data: result.data, isNew: false };
}

/** Write settings.json (ensures directory exists) */
export async function writeSettings(settings: Settings): Promise<void> {
  await ensureDir(CLAUDE_DIR);
  await writeJson(SETTINGS_FILE, settings);
}

// ============================================
// Cursor hooks.json
// ============================================

/** Cursor hooks config type */
export type CursorHooksConfig = {
  version?: number;
  hooks?: Record<string, unknown>;
  [key: string]: unknown;
};

/** Narrow helper for plain objects used by hook payloads */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Cursor supports both:
 *  - direct config: { "stop": [...] }
 *  - wrapped config: { "version": 1, "hooks": { "stop": [...] } }
 * This function returns the hook payload in either case.
 */
function unwrapCursorHooksConfig(config: CursorHooksConfig): Record<string, unknown> {
  const wrapped = config.hooks;
  if (isRecord(wrapped)) {
    return wrapped;
  }
  return config;
}

/** Check if value is valid Cursor hooks config */
function isValidCursorHooksConfig(value: unknown): value is CursorHooksConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Empty Cursor hooks config */
const EMPTY_CURSOR_HOOKS: CursorHooksConfig = { version: 1, hooks: {} };

/** Cursor hooks read result type */
export type CursorHooksReadResult =
  | { ok: true; data: CursorHooksConfig; isNew: boolean }
  | { ok: false; error: "parse_error"; message: string; path: string };

/** Read and validate Cursor hooks.json */
export async function readCursorHooksSafe(): Promise<CursorHooksReadResult> {
  const result = await readJsonSafe<unknown>(CURSOR_HOOKS_FILE);

  if (!result.ok && result.error === "not_found") {
    return { ok: true, data: EMPTY_CURSOR_HOOKS, isNew: true };
  }

  if (!result.ok && result.error === "parse_error") {
    return {
      ok: false,
      error: "parse_error",
      message: result.message,
      path: CURSOR_HOOKS_FILE,
    };
  }

  if (!isValidCursorHooksConfig(result.data)) {
    return {
      ok: false,
      error: "parse_error",
      message: "Cursor hooks config must be an object",
      path: CURSOR_HOOKS_FILE,
    };
  }

  return { ok: true, data: result.data, isNew: false };
}

/** Write Cursor hooks.json (ensures directory exists) */
export async function writeCursorHooks(config: CursorHooksConfig): Promise<void> {
  await ensureDir(CURSOR_DIR);
  await writeJson(CURSOR_HOOKS_FILE, config);
}

/** Merge Cursor hooks config preserving key order */
export function mergeCursorHooksConfig(
  existing: CursorHooksConfig,
  hooks: Record<string, unknown>
): CursorHooksConfig {
  const source = unwrapCursorHooksConfig(existing);
  const mergedHooksPayload = mergePayloadConfig(source, hooks);

  const isWrapped = isRecord(existing.hooks);
  const hasVersion = "version" in existing;

  if (isWrapped || hasVersion) {
    const result: CursorHooksConfig = {};
    const existingKeys = Object.keys(existing);
    const hasHooks = existingKeys.includes("hooks");
    const mergedVersion =
      typeof existing.version === "number" ? existing.version : 1;

    for (const key of existingKeys) {
      if (key === "hooks") {
        result[key] = mergedHooksPayload;
      } else if (key === "version") {
        result[key] = mergedVersion;
      } else {
        result[key] = existing[key];
      }
    }

    if (!hasHooks) {
      result.hooks = mergedHooksPayload;
    }
    if (!hasVersion) {
      result.version = 1;
    }

    return result;
  }

  // Legacy direct configs: migrate to wrapped format for current Cursor schema.
  return {
    version: 1,
    hooks: mergedHooksPayload,
  };
}

/** Merge hook payloads preserving key order */
function mergePayloadConfig(
  existing: Record<string, unknown>,
  hooks: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const remainingHookKeys = new Set(Object.keys(hooks));

  for (const key of Object.keys(existing)) {
    if (key in hooks) {
      result[key] = hooks[key];
      remainingHookKeys.delete(key);
    } else {
      result[key] = existing[key];
    }
  }

  for (const key of Object.keys(hooks)) {
    if (remainingHookKeys.has(key)) {
      result[key] = hooks[key];
    }
  }

  return result;
}

/** Extract the mergeable Cursor hook payload (supports wrapped and direct formats). */
export function getCursorHooksPayload(config: CursorHooksConfig): Record<string, unknown> {
  return unwrapCursorHooksConfig(config);
}
