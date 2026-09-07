"use client";

import { useEffect, useState } from "react";
import { BarChart3, Coins, Sparkles, Star } from "lucide-react";
import { api } from "@/lib/api";
import { fmt, when } from "@/lib/format";
import { Badge, Card, Input, PageHeader, Pagination, Select, StatCard } from "@/components/ui";
import { LineCard } from "@/components/charts";
import { lineTrend } from "@/lib/chart-data";

type Job = { jobId?: string; uid?: string; status?: string; credits?: number; createdAt?: string; result?: { overallScore?: number } };

export default function BrandingPage() {
  const [items, setItems] = useState<Job[]>([]);
  useEffect(() => {
    api<{ data: { items: Job[] } }>("/admin/branding")
      .then((r) => setItems(r.data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const scores = items.map((j) => j.result?.overallScore).filter((n): n is number => typeof n === "number");
  const avg = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : 0;
  const credits = items.reduce((s, j) => s + (j.credits ?? 0), 0);

  return (
    <div>
      <PageHeader title="Branding Analysis" subtitle="Branding analysis volume and score trends." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Analyses" value={fmt(items.length)} icon={<Sparkles size={18} />} />
        <StatCard label="Average Score" value={fmt(avg)} tone="success" icon={<Star size={18} />} />
        <StatCard label="Completed" value={fmt(items.filter((j) => j.status === "completed").length)} icon={<BarChart3 size={18} />} />
        <StatCard label="Credits Consumed" value={fmt(credits)} icon={<Coins size={18} />} />
      </div>
      <Card className="mt-4 p-4">
        <div className="mb-3 text-sm font-medium">Analysis volume trend</div>
        <LineCard data={lineTrend(items.length)} lines={[{ key: "value", color: "var(--accent)" }]} />
      </Card>
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input placeholder="Search analysis ID or user" className="max-w-sm" />
          <Select><option>Score</option></Select>
          <Select><option>Status</option></Select>
        </div>
        <div className="scrollable">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="text-subtle"><tr>{["Analysis ID", "User", "Score", "Credits", "Status", "Created"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {items.length ? items.map((j) => (
                <tr key={j.jobId} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs text-accent">{j.jobId}</td>
                  <td className="px-4 py-3">{j.uid}</td>
                  <td className="px-4 py-3">{j.result?.overallScore ?? "—"}</td>
                  <td className="px-4 py-3">{j.credits ?? 0}</td>
                  <td className="px-4 py-3"><Badge tone={j.status === "failed" ? "danger" : "success"}>{j.status}</Badge></td>
                  <td className="px-4 py-3 text-subtle">{when(j.createdAt)}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={6}>No branding jobs in the local database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} total={items.length} from={items.length ? 1 : 0} to={items.length} />
      </Card>
    </div>
  );
}
