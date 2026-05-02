/**
 * Sound service — synthesises a short notification chime using the Web Audio API.
 * No audio files required. Respects a user-controlled mute setting in localStorage.
 */

const MUTE_KEY = "chat_muted";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function isMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function toggleMute(): boolean {
  const next = !isMuted();
  localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  return next;
}

export function playMessageSound() {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ac.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);

    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.3);
  } catch {
    // AudioContext blocked or unavailable — silently ignore
  }
}
