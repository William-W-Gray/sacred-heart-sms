/**
 * Notification chime via the Web Audio API — no audio asset to ship, and we can
 * synthesise a short, pleasant two-note chime. Browsers block audio until the
 * user has interacted with the page, so we lazily create the AudioContext and
 * "unlock" (resume) it on the first pointer/key event; until then play() is a
 * no-op and the visual notification (bell badge / toast) still fires.
 */

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let unlockInstalled = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Resume the audio context on the first user gesture so later chimes (which
 * arrive on a timer, not a gesture) are allowed to play. Idempotent. */
export function installAudioUnlock() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const unlock = () => {
    const audio = getCtx();
    if (audio && audio.state === "suspended") audio.resume().catch(() => {});
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

/** Play a short two-note notification chime. Silent no-op if audio is blocked. */
export function playNotificationChime() {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") {
    // Not yet unlocked by a gesture — try, but don't throw if it stays blocked.
    audio.resume().catch(() => {});
    if (audio.state === "suspended") return;
  }
  const now = audio.currentTime;
  const notes = [
    { freq: 880.0, at: 0 },     // A5
    { freq: 1174.66, at: 0.11 }, // D6
  ];
  for (const { freq, at } of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = now + at;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.13, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  }
}
