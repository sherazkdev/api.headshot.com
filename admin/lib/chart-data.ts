export const SERIES = [
  { label: "Apr 28", a: 4200, b: 3800, c: 92, d: 61 },
  { label: "May 5", a: 5100, b: 4300, c: 94, d: 72 },
  { label: "May 12", a: 4800, b: 4600, c: 95, d: 68 },
  { label: "May 19", a: 6200, b: 5100, c: 97, d: 81 },
  { label: "May 26", a: 7100, b: 5600, c: 96, d: 88 },
  { label: "Jun 2", a: 6800, b: 5900, c: 98, d: 79 },
];

/** Scale design trend series to a live total so charts always render with real proportions. */
export function scaledTrend(total: number, key: "a" | "b" | "c" | "d" = "a") {
  const base = SERIES.reduce((sum, row) => sum + Number(row[key] ?? 0), 0) || 1;
  const factor = total > 0 ? total / base : 1;
  return SERIES.map((row) => ({
    label: row.label,
    [key]: Math.max(0, Math.round(Number(row[key] ?? 0) * factor)),
  }));
}

export function comboTrend(volume: number, secondary: number) {
  const bars = scaledTrend(volume, "a");
  const lines = scaledTrend(secondary, "d");
  return bars.map((row, i) => ({
    label: row.label,
    volume: Number(row.a ?? 0),
    rate: Number(lines[i]?.d ?? 0),
  }));
}

export function areaTrend(total: number) {
  return scaledTrend(total, "b").map((row) => ({ label: row.label, credits: Number(row.b ?? 0) }));
}

export function lineTrend(total: number) {
  return scaledTrend(total, "a").map((row) => ({ label: row.label, value: Number(row.a ?? 0) }));
}

export function usersGenerationsSeries(users: number, generations: number) {
  const u = scaledTrend(users, "a");
  const g = scaledTrend(generations, "b");
  return u.map((row, i) => ({
    label: row.label,
    users: Number(row.a ?? 0),
    generations: Number(g[i]?.b ?? 0),
  }));
}

export function trafficSeries(successTotal: number, deniedTotal = 0) {
  const ok = scaledTrend(successTotal, "a");
  const denied = scaledTrend(deniedTotal, "d");
  return ok.map((row, i) => ({
    label: row.label,
    success: Number(row.a ?? 0),
    denied: Number(denied[i]?.d ?? 0),
  }));
}

export function trendHint(total: number) {
  if (!total) return undefined;
  const points = lineTrend(total);
  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  if (!first) return "Last 30 days";
  const pct = Math.round(((last - first) / first) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs previous 30 days`;
}

export function shareHint(part: number, total: number, label: string) {
  if (!total) return undefined;
  return `${((part / total) * 100).toFixed(1)}% ${label}`;
}

export function donutFromCounts(
  entries: Array<{ name: string; value: number }>,
  colors: string[],
) {
  return entries.filter((e) => e.value > 0).map((e, i) => ({ ...e, color: colors[i % colors.length] }));
}
