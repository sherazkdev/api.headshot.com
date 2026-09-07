"use client";

import { useEffect, useState } from "react";
import { Gift, Sparkles, Ticket, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { fmt, initials } from "@/lib/format";
import { Badge, Card, Input, PageHeader, Pagination, Select, StatCard } from "@/components/ui";
import { DonutCard, EmptyChart, AreaCard, ComboCard, LineCard } from "@/components/charts";
import { areaTrend, donutFromCounts } from "@/lib/chart-data";

type WalletRow = {
  uid?: string;
  name?: string;
  email?: string;
  credits?: number;
  passCredits?: number;
  isPremium?: boolean;
  wallet?: { spendable?: number; credits?: number; passCredits?: number };
};

export default function CreditsPage() {
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [spendable, setSpendable] = useState(0);

  useEffect(() => {
    Promise.all([
      api<{ data: { items: WalletRow[] } }>("/admin/wallets"),
      api<{ data: { spendableCredits?: number } }>("/admin/overview"),
    ])
      .then(([wallets, overview]) => {
        setRows(wallets.data.items ?? []);
        setSpendable(overview.data.spendableCredits ?? 0);
      })
      .catch(() => setRows([]));
  }, []);

  const pass = rows.reduce((s, r) => s + (r.wallet?.passCredits ?? r.passCredits ?? 0), 0);
  const bonus = rows.reduce((s, r) => s + (r.wallet?.credits ?? r.credits ?? 0), 0);

  return (
    <div>
      <PageHeader title="Credits & Wallet" subtitle="Live wallet balances from MongoDB." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Spendable Credits" value={fmt(spendable)} hint="Live MongoDB" icon={<Wallet size={18} />} />
        <StatCard label="Pass Credits" value={fmt(pass)} hint="This page of wallets" icon={<Ticket size={18} />} />
        <StatCard label="Bonus Credits" value={fmt(bonus)} hint="This page of wallets" icon={<Gift size={18} />} />
        <StatCard label="Wallets" value={fmt(rows.length)} hint="Returned rows" icon={<Sparkles size={18} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 text-sm font-medium">Credit balance trend</div>
          <AreaCard data={areaTrend(spendable)} dataKey="credits" color="var(--accent)" />
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">Credit source</div>
          {pass + bonus ? (
            <DonutCard data={donutFromCounts([{ name: "Pass", value: pass }, { name: "Bonus", value: bonus }], ["#3b82f6", "#6b7280"])} />
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input placeholder="Search users..." className="max-w-xs" />
          <Select defaultValue="all"><option>Credit Type</option></Select>
          <Select defaultValue="all"><option>Pass Status</option></Select>
        </div>
        <div className="scrollable">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="text-subtle">
              <tr>{["User", "Spendable", "Pass Credits", "Bonus Credits", "Pass Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((r, i) => (
                <tr key={r.uid ?? i} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs text-accent">{initials(r.name ?? "U")}</span>
                      <span>
                        <div className="font-medium">{r.name ?? r.uid}</div>
                        <div className="text-xs text-subtle">{r.email}</div>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{fmt(r.wallet?.spendable ?? (r.credits ?? 0) + (r.passCredits ?? 0))}</td>
                  <td className="px-4 py-3">{fmt(r.wallet?.passCredits ?? r.passCredits ?? 0)}</td>
                  <td className="px-4 py-3">{fmt(r.wallet?.credits ?? r.credits ?? 0)}</td>
                  <td className="px-4 py-3"><Badge tone={r.isPremium ? "success" : "neutral"}>{r.isPremium ? "Active" : "Free"}</Badge></td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={5}>No wallets in the local database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} total={rows.length} from={rows.length ? 1 : 0} to={rows.length} />
      </Card>
    </div>
  );
}
