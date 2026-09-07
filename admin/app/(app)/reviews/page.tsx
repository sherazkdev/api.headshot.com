"use client";

import { useEffect, useState } from "react";
import { Coins, Images, Star, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { countBy, fmt, when } from "@/lib/format";
import { Badge, Card, Input, PageHeader, Pagination, Select, StatCard } from "@/components/ui";
import { DonutCard, EmptyChart, LineCard } from "@/components/charts";
import { donutFromCounts, lineTrend } from "@/lib/chart-data";

type Job = { jobId?: string; uid?: string; status?: string; credits?: number; createdAt?: string; payload?: { uploadIds?: string[] }; result?: { bestScore?: number } };

export default function ReviewsPage() {
  const [items, setItems] = useState<Job[]>([]);
  useEffect(() => {
    api<{ data: { items: Job[] } }>("/admin/profile-reviews")
      .then((r) => setItems(r.data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const photos = items.reduce((s, j) => s + (j.payload?.uploadIds?.length ?? 0), 0);
  const scores = items.map((j) => j.result?.bestScore).filter((n): n is number => typeof n === "number");
  const avg = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : 0;
  const credits = items.reduce((s, j) => s + (j.credits ?? 0), 0);
  const photoMix = countBy(items, (j) => String(j.payload?.uploadIds?.length ?? 0));

  return (
    <div>
      <PageHeader title="Profile Reviews" subtitle="Live profile-review jobs from MongoDB." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Reviews" value={fmt(items.length)} icon={<Workflow size={18} />} />
        <StatCard label="Photos Reviewed" value={fmt(photos)} icon={<Images size={18} />} />
        <StatCard label="Average Best Score" value={fmt(avg)} icon={<Star size={18} />} />
        <StatCard label="Credits Consumed" value={fmt(credits)} icon={<Coins size={18} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 text-sm font-medium">Review volume trend</div>
          <LineCard data={lineTrend(items.length)} lines={[{ key: "value", color: "var(--accent)" }]} />
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">Photos per review</div>
          {photoMix.length ? (
            <DonutCard data={donutFromCounts(photoMix.map((p) => ({ name: `${p.name} photos`, value: p.value })), ["#3b82f6", "#22c55e", "#8b5cf6"])} />
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input placeholder="Search review ID or user" className="max-w-sm" />
          <Select><option>Best Score</option></Select>
          <Select><option>Photo Count</option></Select>
        </div>
        <div className="scrollable">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="text-subtle"><tr>{["Review ID", "User", "Photos", "Best Score", "Credits", "Status", "Created"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {items.length ? items.map((j) => (
                <tr key={j.jobId} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs text-accent">{j.jobId}</td>
                  <td className="px-4 py-3">{j.uid}</td>
                  <td className="px-4 py-3">{j.payload?.uploadIds?.length ?? 0}</td>
                  <td className="px-4 py-3">{j.result?.bestScore ?? "—"}</td>
                  <td className="px-4 py-3">{j.credits ?? 0}</td>
                  <td className="px-4 py-3"><Badge tone={j.status === "failed" ? "danger" : "success"}>{j.status}</Badge></td>
                  <td className="px-4 py-3 text-subtle">{when(j.createdAt)}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={7}>No profile reviews in the local database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} total={items.length} from={items.length ? 1 : 0} to={items.length} />
      </Card>
    </div>
  );
}
