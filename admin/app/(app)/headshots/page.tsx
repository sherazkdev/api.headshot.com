"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Image as ImageIcon } from "lucide-react";
import { api } from "@/lib/api";
import { countBy, fmt, when } from "@/lib/format";
import { Badge, Card, Input, PageHeader, Pagination, Select, StatCard } from "@/components/ui";
import { DonutCard, EmptyChart, ComboCard } from "@/components/charts";
import { comboTrend, donutFromCounts } from "@/lib/chart-data";

type Job = { jobId?: string; uid?: string; status?: string; provider?: string; model?: string; credits?: number; createdAt?: string; payload?: { toolType?: string } };

export default function HeadshotsPage() {
  const [items, setItems] = useState<Job[]>([]);
  useEffect(() => {
    api<{ data: { items: Job[] } }>("/admin/headshots")
      .then((r) => setItems(r.data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const tone = (s?: string) => (s === "failed" ? "danger" : s === "processing" || s === "queued" ? "info" : s === "cancelled" ? "neutral" : "success");
  const completed = items.filter((j) => j.status === "completed").length;
  const processing = items.filter((j) => j.status === "processing" || j.status === "queued").length;
  const failed = items.filter((j) => j.status === "failed").length;
  const providers = countBy(items, (j) => j.provider || "unknown");

  return (
    <div>
      <PageHeader title="Headshot Generations" subtitle="Live headshot jobs from MongoDB." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Generations" value={fmt(items.length)} icon={<ImageIcon size={18} />} />
        <StatCard label="Completed" value={fmt(completed)} hint={items.length ? `${Math.round((completed / items.length) * 100)}% success` : "No jobs"} tone="success" icon={<CheckCircle2 size={18} />} />
        <StatCard label="Processing" value={fmt(processing)} icon={<Clock size={18} />} />
        <StatCard label="Failed" value={fmt(failed)} tone="danger" icon={<AlertTriangle size={18} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 text-sm font-medium">Generation volume & success rate</div>
          <ComboCard data={comboTrend(items.length, completed)} barKey="volume" lineKey="rate" />
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">Provider split</div>
          {providers.length ? (
            <DonutCard data={donutFromCounts(providers, ["#3b82f6", "#93c5fd", "#8b5cf6"])} />
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input placeholder="Search job ID, user or style" className="max-w-sm" />
          <Select><option>Status: All</option></Select>
          <Select><option>Provider: All</option></Select>
        </div>
        <div className="scrollable">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="text-subtle">
              <tr>{["Job ID", "User", "Tool Type", "Provider / Model", "Credits", "Status", "Created"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.length ? items.map((j) => (
                <tr key={j.jobId} className="border-t border-line hover:bg-muted">
                  <td className="px-4 py-3 font-mono text-xs"><Link className="text-accent" href={`/headshots/${j.jobId}`}>{j.jobId}</Link></td>
                  <td className="px-4 py-3">{j.uid}</td>
                  <td className="px-4 py-3">{j.payload?.toolType ?? "headshot"}</td>
                  <td className="px-4 py-3">{j.provider ?? "—"}{j.model ? ` / ${j.model}` : ""}</td>
                  <td className="px-4 py-3">{fmt(j.credits ?? 0)}</td>
                  <td className="px-4 py-3"><Badge tone={tone(j.status)}>{j.status}</Badge></td>
                  <td className="px-4 py-3 text-subtle">{when(j.createdAt)}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={7}>No headshot jobs in the local database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} total={items.length} from={items.length ? 1 : 0} to={items.length} />
      </Card>
    </div>
  );
}
