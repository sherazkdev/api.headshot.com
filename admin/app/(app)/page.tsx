"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Sparkles, Users, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { countBy, fmt, initials, when } from "@/lib/format";
import { Badge, Card, DateRangeSelect, PageHeader, StatCard } from "@/components/ui";
import { BarCard, DonutCard, DualLineCard, EmptyChart } from "@/components/charts";
import { donutFromCounts, trendHint, usersGenerationsSeries } from "@/lib/chart-data";

type Overview = {
  totalUsers?: number;
  spendableCredits?: number;
  premium?: number;
  aiGenerations?: number;
};

type Job = { jobId?: string; jobType?: string; uid?: string; status?: string; createdAt?: string };
type Bucket = { _id: string; n: number };
type Sub = { premiumPlanName?: string };

export default function OverviewPage() {
  const [data, setData] = useState<Overview>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [byType, setByType] = useState<Bucket[]>([]);
  const [byStatus, setByStatus] = useState<Bucket[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ data: Overview }>("/admin/overview"),
      api<{ data: { items?: Job[] } }>("/admin/jobs?page=1&per_page=8"),
      api<{ data: { byEndpoint?: Bucket[]; byStatus?: Bucket[] } }>("/admin/ai-usage"),
      api<{ data: { items?: Sub[] } }>("/admin/subscriptions?page=1&per_page=100"),
    ])
      .then(([overview, jobRes, usage, subRes]) => {
        setData(overview.data);
        setJobs(jobRes.data.items ?? []);
        setByType(usage.data.byEndpoint ?? []);
        setByStatus(usage.data.byStatus ?? []);
        setSubs(subRes.data.items ?? []);
        setLive(true);
      })
      .catch((err) => {
        console.error("overview load failed", err);
        setLive(true);
      });
  }, []);

  const statusN = (id: string) => byStatus.find((s) => s._id === id)?.n ?? 0;
  const statusTotal = byStatus.reduce((s, x) => s + x.n, 0) || 1;
  const pct = (id: string) => Math.round((statusN(id) / statusTotal) * 100);
  const planMix = countBy(subs, (s) => s.premiumPlanName || "Unknown");
  const bars = byType.map((t) => ({ label: (t._id || "other").replaceAll("_", " "), n: t.n }));
  const users = Number(data.totalUsers ?? 0);
  const generations = Number(data.aiGenerations ?? 0);

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Platform health and business performance"
        actions={<DateRangeSelect />}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={live ? fmt(users) : "—"} hint={trendHint(users)} icon={<Users size={18} />} />
        <StatCard label="Spendable Credits" value={live ? fmt(Number(data.spendableCredits ?? 0)) : "—"} hint={trendHint(Number(data.spendableCredits ?? 0))} icon={<Wallet size={18} />} />
        <StatCard label="Active Subscriptions" value={live ? fmt(Number(data.premium ?? 0)) : "—"} hint={trendHint(Number(data.premium ?? 0))} icon={<CreditCard size={18} />} />
        <StatCard label="AI Generations" value={live ? fmt(generations) : "—"} hint={trendHint(generations)} icon={<Sparkles size={18} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-1 text-sm font-medium">Users & Generations</div>
          <DualLineCard
            data={usersGenerationsSeries(users, generations)}
            primaryKey="users"
            secondaryKey="generations"
            primaryLabel="Users"
            secondaryLabel="Generations"
          />
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">Subscription mix</div>
          {planMix.length ? (
            <DonutCard data={donutFromCounts(planMix, ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b"])} />
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 text-sm font-medium">AI usage by feature</div>
          {bars.length ? <BarCard data={bars} dataKey="n" /> : <EmptyChart />}
        </Card>
        <Card className="p-4">
          <div className="mb-4 text-sm font-medium">AI job health</div>
          {([
            ["Completed", pct("completed"), "bg-accent"],
            ["Processing", pct("processing"), "bg-info"],
            ["Failed", pct("failed"), "bg-[var(--purple)]"],
          ] as const).map(([label, value, bar]) => (
            <div key={label} className="mb-4 last:mb-0">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-subtle">{label}</span>
                <span>{live ? `${value}%` : "—"}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className={`h-2 rounded-full ${bar}`} style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="px-4 py-3 text-sm font-medium">Recent jobs</div>
        <table className="min-w-full text-left text-sm">
          <thead className="text-subtle">
            <tr>
              {["Job", "User", "Type", "Status", "Time"].map((h) => (
                <th key={h} className="px-4 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.length ? jobs.map((j) => (
              <tr key={j.jobId} className="border-t border-line">
                <td className="px-4 py-3 font-mono text-xs text-accent">{j.jobId}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[10px] font-medium text-accent">{initials(j.uid ?? "U")}</span>
                    {j.uid}
                  </span>
                </td>
                <td className="px-4 py-3 text-subtle">{(j.jobType ?? "job").replaceAll("_", " ")}</td>
                <td className="px-4 py-3">
                  <Badge tone={j.status === "failed" ? "danger" : j.status === "completed" ? "success" : "info"}>{j.status}</Badge>
                </td>
                <td className="px-4 py-3 text-subtle">{when(j.createdAt)}</td>
              </tr>
            )) : (
              <tr><td className="px-4 py-10 text-center text-subtle" colSpan={5}>No jobs in the local database yet.</td></tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-line py-3 text-center">
          <Link href="/jobs" className="text-sm text-accent">View all jobs</Link>
        </div>
      </Card>
    </div>
  );
}
