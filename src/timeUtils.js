export function formatElapsed(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export function formatClock(ms) {
  return new Date(ms).toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export const WARN_RATIO = 0.75;

export function timerStatus(elapsedMs, objetivoMin) {
  const ratio = elapsedMs / (objetivoMin * 60000);
  if (ratio >= 1) return "late";
  if (ratio >= WARN_RATIO) return "warn";
  return "ok";
}
