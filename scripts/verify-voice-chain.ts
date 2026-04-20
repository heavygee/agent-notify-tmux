#!/usr/bin/env bun
/**
 * TTS -> WAV -> aplay. No shell completions, no Cursor stop hook.
 * Reads ~/.config/agent-notify/.env for URL, voice, format, player args (aplay -D ...).
 */
import { homedir } from "node:os";
import { join } from "node:path";

const envPath = process.env.AGENT_NOTIFY_ENV_FILE ?? join(homedir(), ".config/agent-notify/.env");
let url = "http://127.0.0.1:18008/v1/audio/speech";
let voice = "xev";
let fmt = "wav";
let timeout = 30;
let playerArgs: string[] = [];

const raw = await Bun.file(envPath).text().catch(() => "");
for (const line of raw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 1) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim();
  if (k === "AGENT_NOTIFY_VOICE_URL") url = v;
  else if (k === "AGENT_NOTIFY_VOICE_VOICE") voice = v;
  else if (k === "AGENT_NOTIFY_VOICE_RESPONSE_FORMAT") fmt = v;
  else if (k === "AGENT_NOTIFY_VOICE_TIMEOUT") timeout = Number(v) || 30;
  else if (k === "AGENT_NOTIFY_VOICE_PLAYER_ARGS") {
    playerArgs = v.trim().split(/\s+/).filter(Boolean);
  }
}

const out = "/tmp/agent-notify-verify-bun.wav";
const body = JSON.stringify({
  model: "kokoro",
  input: "Voice chain test from Bun.",
  voice,
  response_format: fmt,
});

console.log(`POST ${url} -> ${out} -> aplay ${playerArgs.join(" ")}`);

const ac = new AbortController();
const tmr = setTimeout(() => ac.abort(), timeout * 1000);
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
  signal: ac.signal,
});
clearTimeout(tmr);
if (!res.ok) {
  console.error("TTS HTTP", res.status, await res.text());
  process.exit(1);
}
await Bun.write(out, await res.arrayBuffer());
const st = await Bun.file(out).stat();
console.log("wav bytes", st.size);

const args = ["aplay", ...playerArgs, out];
const proc = Bun.spawn(args, { stdout: "inherit", stderr: "inherit" });
const code = await proc.exited;
process.exit(code === 0 ? 0 : 1);
