"use client";

import { useEffect, useState } from "react";
import { Copy, DollarSign, Gift, Layers, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api";
import { countBy, fmt, money, when } from "@/lib/format";
import { Badge, Card, Input, PageHeader, Pagination, Select, StatCard } from "@/components/ui";
import { DonutCard, EmptyChart, ComboCard } from "@/components/charts";
import { comboTrend, donutFromCounts } from "@/lib/chart-data";

type Purchase = { purchaseId?: string; uid?: string; productId?: string; platform?: string; creditsAdded?: number; amount?: number; status?: string; createdAt?: string };

export default function TransactionsPage() {
  const [items, setItems] = useState<Purchase[]>([]);
  const [overview, setOverview] = useState({ transactions: 0, purchaseRevenue: 0, creditsAdded: 0 });

  useEffect(() => {
    Promise.all([
      api<{ data: { items: Purchase[] } }>("/admin/purchases"),
      api<{ data: { transactions?: number; purchaseRevenue?: number; creditsAdded?: number } }>("/admin/overview"),
    ])
      .then(([purchases, ov]) => {
        setItems(purchases.data.items ?? []);
        setOverview({
          transactions: ov.data.transactions ?? purchases.data.items?.length ?? 0,
          purchaseRevenue: ov.data.purchaseRevenue ?? 0,
          creditsAdded: ov.data.creditsAdded ?? 0,
        });
      })
      .catch(() => setItems([]));
  }, []);

  const rewards = items.filter((p) => p.platform === "rewarded_ad" || p.productId === "rewarded_ad").length;
  const sources = countBy(items, (p) => p.platform || "unknown");

  return (
    <div>
      <PageHeader title="Purchases & Transactions" subtitle="Purchases, rewarded ads, and credit grants." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Transactions" value={fmt(overview.transactions)} icon={<ShoppingBag size={18} />} />
        <StatCard label="Purchase Revenue" value={money(overview.purchaseRevenue)} icon={<DollarSign size={18} />} />
        <StatCard label="Credits Added" value={fmt(overview.creditsAdded)} icon={<Layers size={18} />} />
        <StatCard label="Reward Claims" value={fmt(rewards)} icon={<Gift size={18} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 text-sm font-medium">Revenue & transaction volume</div>
          <ComboCard data={comboTrend(overview.transactions, Math.round(overview.purchaseRevenue))} barKey="volume" lineKey="rate" />
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">Transaction sources</div>
          {sources.length ? (
            <DonutCard data={donutFromCounts(sources, ["#8b5cf6", "#22c55e", "#60a5fa", "#f59e0b"])} />
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input placeholder="Search purchase ID, user or product" className="max-w-sm" />
          <Select><option>Platform</option></Select>
          <Select><option>Product</option></Select>
          <Select><option>Status</option></Select>
        </div>
        <div className="scrollable">
          <table className="min-w-[1000px] w-full text-left text-sm">
            <thead className="text-subtle">
              <tr>{["Purchase ID", "User", "Product ID", "Platform", "Credits", "Amount", "Status", "Created"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.length ? items.map((p) => (
                <tr key={p.purchaseId} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs">
                    <span className="inline-flex items-center gap-1">{p.purchaseId} <Copy size={12} className="text-faint" /></span>
                  </td>
                  <td className="px-4 py-3">{p.uid}</td>
                  <td className="px-4 py-3">{p.productId}</td>
                  <td className="px-4 py-3 capitalize">{p.platform?.replace("_", " ")}</td>
                  <td className="px-4 py-3">{fmt(p.creditsAdded ?? 0)}</td>
                  <td className="px-4 py-3">{p.amount ? money(p.amount) : "—"}</td>
                  <td className="px-4 py-3"><Badge tone={p.status === "failed" ? "danger" : "success"}>{p.status ?? "completed"}</Badge></td>
                  <td className="px-4 py-3 text-subtle">{when(p.createdAt)}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={8}>No purchases in the local database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} total={items.length} from={items.length ? 1 : 0} to={items.length} />
      </Card>
    </div>
  );
}
