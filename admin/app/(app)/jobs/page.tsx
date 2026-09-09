"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Workflow } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { fmt, when } from "@/lib/format";
import { Badge, Banner, Card, Input, PageHeader, Pagination, Select, StatCard, Tabs } from "@/components/ui";
import { BarCard } from "@/components/charts";
import { trendHint } from "@/lib/chart-data";

type Job = {
  jobId?: string;
  jobType?: string;
  type?: string;
  uid?: string;
  status?: string;
  credits?: number;
  createdAt?: string;
  provider?: string;
  model?: string;
};

type Queue = { queued?: number; running?: number; processing?: number };

export default function JobsPage() {
  const [items, setItems] = useState<Job[]>([]);
  const [queue, setQueue] = useState<Queue>({});
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [provider, setProvider] = useState("all");
  const [meta, setMeta] = useState({ total: 0, last_page: 1 });
  const [error, setError] = useState("");

  useEffect(() => {
    const status = tab === "all" ? "" : tab === "running" ? "processing" : tab;
    const qs = new URLSearchParams({ page: "1", per_page: "50" });
    if (status) qs.set("status", status);
    api<{ data: { items: Job[]; meta?: { total: number; last_page: number }; queue?: Queue } }>(`/admin/jobs?${qs}`)
      .then((r) => {
        setItems(r.data.items ?? []);
        setQueue(r.data.queue ?? {});
        setMeta({ total: r.data.meta?.total ?? r.data.items?.length ?? 0, last_page: r.data.meta?.last_page ?? 1 });
        setError("");
      })
      .catch((err) => {
        setItems([]);
        setError(errorMessage(err));
      });
  }, [tab]);

  const filtered = useMemo(
    () =>
      items.filter((j) => {
        const hay = `${j.jobId} ${j.uid} ${j.jobType} ${j.provider}`.toLowerCase();
        if (q && !hay.includes(q.toLowerCase())) return false;
        if (type !== "all" && (j.jobType ?? j.type) !== type) return false;
        if (provider !== "all" && j.provider !== provider) return false;
        return true;
      }),
    [items, q, type, provider],
  );

  const completed = items.filter((j) => j.status === "completed").length;
  const failed = items.filter((j) => j.status === "failed").length;
  const queued = queue.queued ?? items.filter((j) => j.status === "queued").length;
  const running = queue.running ?? queue.processing ?? items.filter((j) => j.status === "processing").length;
  const statusBars = [
    { label: "Queued", n: queued },
    { label: "Running", n: running },
    { label: "Completed", n: completed },
    { label: "Failed", n: failed },
  ];

  return (
    <div>
      <PageHeader title="AI Jobs" subtitle="Queue, retries, and provider outcomes across all generation tools." />
      {error ? <Banner tone="warning" className="mb-4">{error}</Banner> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In Queue" value={fmt(queued)} hint={trendHint(queued)} icon={<Loader2 size={18} />} />
        <StatCard label="Running" value={fmt(running)} hint={trendHint(running)} tone="info" icon={<Workflow size={18} />} />
        <StatCard label="Completed" value={fmt(completed)} hint={trendHint(completed)} tone="success" icon={<CheckCircle2 size={18} />} />
        <StatCard label="Failed" value={fmt(failed)} hint={trendHint(failed)} tone="danger" icon={<AlertTriangle size={18} />} />
      </div>
      <Card className="mt-4 p-4">
        <div className="mb-3 text-sm font-medium">Jobs by status</div>
        <BarCard data={statusBars} dataKey="n" />
      </Card>
      <Card className="mt-4 overflow-hidden">
        <div className="px-4 pt-3">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "all", label: "All" },
              { id: "queued", label: "Queued" },
              { id: "running", label: "Running" },
              { id: "completed", label: "Completed" },
              { id: "failed", label: "Failed" },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          <Input placeholder="Search job ID or user" className="max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">Type</option>
            <option value="headshot_generation">Headshot</option>
            <option value="branding_analyze">Branding</option>
            <option value="branding_improve">Improve</option>
            <option value="profile_review">Review</option>
          </Select>
          <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="all">Provider</option>
            <option value="gemini">Gemini</option>
            <option value="bfl">BFL</option>
          </Select>
        </div>
        <div className="scrollable">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="text-subtle"><tr>{["Job ID", "Type", "User", "Provider", "Credits", "Status", "Created"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length ? filtered.map((j) => (
                <tr key={j.jobId} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs text-accent">{j.jobId}</td>
                  <td className="px-4 py-3">{(j.jobType ?? j.type ?? "—").replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{j.uid}</td>
                  <td className="px-4 py-3">{j.provider ?? "auto"}{j.model ? ` / ${j.model}` : ""}</td>
                  <td className="px-4 py-3">{j.credits ?? 0}</td>
                  <td className="px-4 py-3"><Badge tone={j.status === "failed" ? "danger" : j.status === "completed" ? "success" : "info"}>{j.status}</Badge></td>
                  <td className="px-4 py-3 text-subtle">{when(j.createdAt)}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={7}>No jobs in the local database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={meta.last_page} total={meta.total} from={filtered.length ? 1 : 0} to={filtered.length} />
      </Card>
    </div>
  );
}
