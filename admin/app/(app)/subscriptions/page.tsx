"use client";

import { useEffect, useState } from "react";
import { CreditCard, RefreshCw, ShieldCheck, Timer } from "lucide-react";
import { api } from "@/lib/api";
import { countBy, fmt, when } from "@/lib/format";
import { Badge, Card, Input, PageHeader, Pagination, Select, StatCard } from "@/components/ui";
import { DonutCard, EmptyChart, LineCard } from "@/components/charts";
import { donutFromCounts, lineTrend } from "@/lib/chart-data";

type User = { uid?: string; name?: string; email?: string; premiumPlanName?: string; premiumStatus?: string; premiumExpiresAt?: string; isPremium?: boolean };

export default function SubscriptionsPage() {
  const [items, setItems] = useState<User[]>([]);
  useEffect(() => {
    api<{ data: { items: User[] } }>("/admin/subscriptions")
      .then((r) => setItems(r.data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const active = items.filter((u) => u.isPremium || u.premiumStatus === "active").length;
  const cancelled = items.filter((u) => u.premiumStatus === "cancelled" || u.premiumStatus === "canceled").length;
  const mix = countBy(items, (u) => u.premiumPlanName || "Unknown");

  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Track premium passes and plan distribution." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Passes" value={fmt(active)} icon={<CreditCard size={18} />} />
        <StatCard label="Listed" value={fmt(items.length)} tone="success" icon={<RefreshCw size={18} />} />
        <StatCard label="Cancelled" value={fmt(cancelled)} tone="warning" icon={<Timer size={18} />} />
        <StatCard label="Healthy Rate" value={items.length ? `${Math.round((active / items.length) * 100)}%` : "0%"} tone="success" icon={<ShieldCheck size={18} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 text-sm font-medium">Active subscribers trend</div>
          <LineCard data={lineTrend(active)} lines={[{ key: "value", color: "var(--accent)" }]} />
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">Plan mix</div>
          {mix.length ? (
            <DonutCard data={donutFromCounts(mix, ["#22c55e", "#3b82f6", "#8b5cf6"])} />
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input placeholder="Search subscriber..." className="max-w-xs" />
          <Select><option>Plan</option></Select>
          <Select><option>Status</option></Select>
        </div>
        <div className="scrollable">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="text-subtle">
              <tr>{["User", "Plan", "Status", "Expires"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.length ? items.map((u, i) => (
                <tr key={u.uid ?? i} className="border-t border-line">
                  <td className="px-4 py-3"><div className="font-medium">{u.name ?? u.uid}</div><div className="text-xs text-subtle">{u.email}</div></td>
                  <td className="px-4 py-3">{u.premiumPlanName ?? "—"}</td>
                  <td className="px-4 py-3"><Badge tone={u.premiumStatus === "cancelled" ? "warning" : "success"}>{u.premiumStatus ?? (u.isPremium ? "active" : "free")}</Badge></td>
                  <td className="px-4 py-3 text-subtle">{when(u.premiumExpiresAt)}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={4}>No subscriptions in the local database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} total={items.length} from={items.length ? 1 : 0} to={items.length} />
      </Card>
    </div>
  );
}
