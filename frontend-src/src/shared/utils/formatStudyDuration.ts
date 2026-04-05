/**
 * Human-readable study duration from a whole-second count.
 * Avoids flooring away partial minutes (e.g. 90s → "1m 30s", not "1 min").
 */
export function formatStudyDurationSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";
  const s = Math.floor(totalSeconds);
  if (s < 60) return `${s}s`;

  const m = Math.floor(s / 60);
  const secRem = s % 60;

  if (m < 60) {
    return secRem > 0 ? `${m}m ${secRem}s` : `${m}m`;
  }

  const h = Math.floor(m / 60);
  const minRem = m % 60;
  return minRem > 0 ? `${h}h ${minRem}m` : `${h}h`;
}
