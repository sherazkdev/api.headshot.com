import { SERIES } from "@/components/charts";

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

export function donutFromCounts(
  entries: Array<{ name: string; value: number }>,
  colors: string[],
) {
  return entries.filter((e) => e.value > 0).map((e, i) => ({ ...e, color: colors[i % colors.length] }));
}
