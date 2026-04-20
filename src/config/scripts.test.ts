import { describe, expect, test } from "bun:test";
import { createScript, generateCursorScripts, generateCliScript, generateClaudeScripts, generateCursorStopHookWrapperScript } from "./scripts";

describe("voice announcement", () => {
  test("defaults to local mode but keeps legacy script hook configuration", () => {
    const script = createScript(
      "Glass",
      "Cursor task completion sound",
      "Cursor",
      "Task completed",
      "Cursor task completed",
      { sound: false, notification: false, voice: true, tmux: false, ntfy: false },
    );

    expect(script).toContain('AGENT_NOTIFY_VOICE_MODE="${AGENT_NOTIFY_VOICE_MODE:-local}"');
    expect(script).toContain("AGENT_NOTIFY_VOICE_COMMAND");
    expect(script).toContain("AGENT_NOTIFY_VOICE_PLAYER");
    expect(script).toContain("AGENT_NOTIFY_VOICE_PLAYER_ARGS");
    expect(script).toContain("__agent_notify_voice_log");
    expect(script).toContain("AGENT_NOTIFY_VOICE_URL");
  });

  test("local/openai compatible mode builds JSON speech request", () => {
    const script = createScript(
      "Glass",
      "Cursor task completion sound",
      "Cursor",
      "Task completed",
      "Cursor task completed",
      { sound: false, notification: false, voice: true, tmux: false, ntfy: false },
    );

    expect(script).toContain("AGENT_NOTIFY_VOICE_URL=\"${AGENT_NOTIFY_VOICE_URL:-}\"");
    expect(script).toContain("cat > \"$__agent_notify_voice_tmp_body\" <<EOF");
    expect(script).toContain('{"model": ${__agent_notify_voice_model_json},');
  });
});

describe("generate scripts with optional voice output", () => {
  test("cursor scripts include generated voice backend block", () => {
    const scripts = generateCursorScripts(["Glass"], {
      sound: false,
      notification: false,
      voice: true,
      tmux: true,
      ntfy: false,
    });

    const cursorScript = scripts["cursor-done-sound.sh"] || "";
    expect(cursorScript).toContain("AGENT_NOTIFY_VOICE_MODE");
    expect(cursorScript).toContain("AGENT_NOTIFY_VOICE_STRICT_VOICE");
    expect(cursorScript).toContain("AGENT_NOTIFY_VOICE_INCLUDE_CONTEXT");
    expect(cursorScript).toContain("__agent_notify_voice_body");
    expect(cursorScript).toContain("AGENT_NOTIFY_SUMMARY_SOURCE=transcript-tail");
    expect(cursorScript).toContain("AGENT_NOTIFY_SUMMARY_LLM_INPUT_MODE=last_assistant");
    expect(cursorScript).toContain('provider ${AGENT_NOTIFY_PROVIDER:-cursor}');
    expect(cursorScript).toContain('. "${AGENT_NOTIFY_ENV_FILE}"');
    expect(cursorScript).toContain("AGENT_NOTIFY_SUMMARY_MAX_USER_BYTES");
    expect(cursorScript).toContain("--rawfile");
    expect(cursorScript).toContain("--data-binary \"@$__agent_notify_sum_req\"");
    expect(cursorScript).toContain("--connect-timeout 5");
    expect(cursorScript).toContain("alsa_before_ffmpeg");
    expect(cursorScript).toContain('__agent_notify_last_asst_len="${#__agent_notify_last_asst}"');
    expect(cursorScript).not.toContain("#__agent_notify_last_asst:-");
    expect(cursorScript).toContain("event=cursor.tts.script.exit");
    expect(cursorScript).toContain("[ \"${AGENT_NOTIFY_VOICE_FALLBACK_WAV_PLAY:-0}\" = \"1\" ]");
    expect(cursorScript).toContain("[ -n \"${AGENT_NOTIFY_VOICE_TEXT:-}\" ] && [ \"${__agent_notify_voice_tts_played:-0}\" -ne 1 ]");
    expect(cursorScript).toContain(", action:");
    expect(cursorScript).toContain("curl");
    expect(cursorScript).toContain("ffplay");
  });

  test("cursor stop wrapper script includes stop payload parsing and context propagation", () => {
    const wrapperScript = generateCursorStopHookWrapperScript();

    expect(wrapperScript).toContain("AGENT_NOTIFY_PAYLOAD");
    expect(wrapperScript).toContain("conversation_id");
    expect(wrapperScript).toContain("voice");
    expect(wrapperScript).toContain("AGENT_NOTIFY_CONTEXT");
    expect(wrapperScript).toContain("AGENT_NOTIFY_VOICE_VOICE");
    expect(wrapperScript).toContain("AGENT_NOTIFY_PROJECT");
    expect(wrapperScript).toContain("payload=$AGENT_NOTIFY_PAYLOAD");
    expect(wrapperScript).toContain("AGENT_NOTIFY_CONTEXT=");
    expect(wrapperScript).toContain("export AGENT_NOTIFY_AGENT_ID");
    expect(wrapperScript).toContain("export AGENT_NOTIFY_PROJECT");
    expect(wrapperScript).toContain("AGENT_NOTIFY_VOICE_VOICE=");
    expect(wrapperScript).toContain("export AGENT_NOTIFY_TRANSCRIPT_PATH");
    expect(wrapperScript).toContain("AGENT_NOTIFY_ENV_FILE");
    expect(wrapperScript).toContain("[ -n \"${AGENT_NOTIFY_VOICE_LOG_FILE:-}\" ]");
    expect(wrapperScript).toContain("[ -z \"${AGENT_NOTIFY_VOICE_LOG_FILE:-}\" ]");
    expect(wrapperScript).toContain("[ -z \"${AGENT_NOTIFY_MODEL:-}\" ]");
    expect(wrapperScript).toContain("[ -z \"${AGENT_NOTIFY_STOP_ACTION:-}\" ]");
  });

  test("cli scripts include generated voice backend block for failure and success paths", () => {
    const script = generateCliScript("Glass", {
      sound: false,
      notification: false,
      voice: true,
      tmux: false,
      ntfy: false,
    });

    expect(script).toContain("if [ \"$EXIT_STATUS\" -eq 0 ]; then");
    expect(script).toContain("AGENT_NOTIFY_VOICE_MODE");
  });

  test("claude scripts include generated voice backend block", () => {
    const scripts = generateClaudeScripts(["Glass"], {
      sound: false,
      notification: false,
      voice: true,
      tmux: false,
      ntfy: false,
    });

    expect(scripts["claude-done-sound.sh"]).toContain("AGENT_NOTIFY_VOICE_URL");
    expect(scripts["claude-done-sound.sh"]).toContain("AGENT_NOTIFY_VOICE_TEXT");
  });
});
