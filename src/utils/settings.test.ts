import { describe, test, expect } from "bun:test";
import { mergeCursorHooksConfig } from "./settings";

describe("mergeCursorHooksConfig", () => {
  test("adds Cursor schema wrapper when starting from an empty config", () => {
    const merged = mergeCursorHooksConfig({}, { stop: [{ command: "/bin/echo" }] });

    expect(merged).toEqual({
      version: 1,
      hooks: { stop: [{ command: "/bin/echo" }] },
    });
  });

  test("preserves wrapped Cursor config fields and replaces only hooks", () => {
    const merged = mergeCursorHooksConfig(
      {
        version: 2,
        hooks: { postToolUse: [{ command: "/bin/other" }], stop: [{ command: "/bin/old" }] },
      },
      { stop: [{ command: "/bin/new" }] },
    );

    expect(merged).toEqual({
      version: 2,
      hooks: { postToolUse: [{ command: "/bin/other" }], stop: [{ command: "/bin/new" }] },
    });
  });

  test("migrates direct format to wrapped format", () => {
    const merged = mergeCursorHooksConfig(
      { stop: [{ command: "/bin/old" }] },
      { stop: [{ command: "/bin/new" }] },
    );

    expect(merged).toEqual({
      version: 1,
      hooks: { stop: [{ command: "/bin/new" }] },
    });
  });
});
