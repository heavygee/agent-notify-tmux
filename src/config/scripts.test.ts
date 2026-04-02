import { describe, expect, test } from "bun:test";
import { createScript, generateCursorScripts, generateCliScript, generateClaudeScripts } from "./scripts";

describe("voice announcement", () => {
  test("script mode keeps legacy local voice command path", () => {
    const script = createScript(
      "Glass",
      "Cursor task completion sound",
      "Cursor",
      "Task completed",
      "Cursor task completed",
      { sound: false, notification: false, voice: true, tmux: false, ntfy: false },
    );

    expect(script).toContain('AGENT_NOTIFY_VOICE_MODE="${AGENT_NOTIFY_VOICE_MODE:-script}"');
    expect(script).toContain("$HOME/coding/server-setup/.cursor/rules/system-voice.mdc");
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
    expect(script).toContain('"model": "${AGENT_NOTIFY_VOICE_MODEL}",');
  });
});

describe("generate scripts with optional voice output", () => {
  test("cursor scripts include generated voice backend block", () => {
    const scripts = generateCursorScripts(["Glass"], {
      sound: false,
      notification: false,
      voice: true,
      tmux: false,
      ntfy: false,
    });

    const cursorScript = scripts["cursor-done-sound.sh"] || "";
    expect(cursorScript).toContain("AGENT_NOTIFY_VOICE_MODE");
    expect(cursorScript).toContain("ffplay");
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
