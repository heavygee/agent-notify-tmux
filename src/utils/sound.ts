import type { SoundName } from "../types";

const bellPlayers: Array<{ command: string; args: string[] }> = [
  { command: "paplay", args: ["/usr/share/sounds/alsa/Front_Center.wav"] },
  { command: "aplay", args: ["/usr/share/sounds/alsa/Front_Center.wav"] },
  { command: "printf", args: ["\\a"] },
];

async function playBell() {
  for (const player of bellPlayers) {
    try {
      const proc = Bun.spawn([player.command, ...player.args], {
        stdout: "ignore",
        stderr: "ignore",
      });
      await proc.exited;
      if (proc.exitCode === 0) {
        return;
      }
    } catch (error) {
      continue;
    }
  }
}

/** Play a terminal/system bell */
export async function playSound(_name: SoundName): Promise<void> {
  await playBell();
}

/** Play sound async (non-blocking) */
export function playSoundAsync(_name: SoundName): void {
  void playSound(_name);
}
