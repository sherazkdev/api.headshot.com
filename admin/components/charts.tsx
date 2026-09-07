"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from "recharts";

const grid = "var(--border)";
const tick = { fill: "var(--text-secondary)", fontSize: 11 };

export function ThemeTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-elevated px-3 py-2 text-xs shadow-card">
      <div className="mb-1 text-subtle">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export function LineCard({ data, lines }: { data: Array<Record<string, string | number>>; lines: Array<{ key: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
          <YAxis tick={tick} axisLine={false} tickLine={false} />
          <Tooltip content={<ThemeTooltip />} />
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={false} strokeDasharray={l.dashed ? "5 5" : undefined} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaCard({ data, dataKey, color }: { data: Array<Record<string, string | number>>; dataKey: string; color: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
          <YAxis tick={tick} axisLine={false} tickLine={false} />
          <Tooltip content={<ThemeTooltip />} />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.16} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarCard({ data, dataKey, color = "var(--accent)" }: { data: Array<Record<string, string | number>>; dataKey: string; color?: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
          <YAxis tick={tick} axisLine={false} tickLine={false} />
          <Tooltip content={<ThemeTooltip />} />
          <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComboCard({
  data,
  barKey,
  lineKey,
}: {
  data: Array<Record<string, string | number>>;
  barKey: string;
  lineKey: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
          <YAxis tick={tick} axisLine={false} tickLine={false} />
          <Tooltip content={<ThemeTooltip />} />
          <Bar dataKey={barKey} fill="var(--accent)" radius={[6, 6, 0, 0]} fillOpacity={0.75} />
          <Line type="monotone" dataKey={lineKey} stroke="var(--purple)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutCard({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex h-64 items-center gap-4">
      <div className="h-full flex-1">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ThemeTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-36 space-y-2 text-sm">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-subtle">
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="font-medium">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyChart({ label = "No data in MongoDB yet." }: { label?: string }) {
  return <div className="flex h-64 items-center justify-center text-sm text-subtle">{label}</div>;
}

export const SERIES = [
  { label: "Apr 28", a: 4200, b: 3800, c: 92, d: 61 },
  { label: "May 5", a: 5100, b: 4300, c: 94, d: 72 },
  { label: "May 12", a: 4800, b: 4600, c: 95, d: 68 },
  { label: "May 19", a: 6200, b: 5100, c: 97, d: 81 },
  { label: "May 26", a: 7100, b: 5600, c: 96, d: 88 },
  { label: "Jun 2", a: 6800, b: 5900, c: 98, d: 79 },
];
