"use client";

import { useEffect, useState } from "react";
import { Bell, CheckSquare, Mail, Plane, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { countBy, fmt, when } from "@/lib/format";
import { Badge, Button, Card, Input, PageHeader, Pagination, Select, StatCard, Tabs } from "@/components/ui";
import { DonutCard, EmptyChart, LineCard } from "@/components/charts";
import { donutFromCounts, lineTrend } from "@/lib/chart-data";

type Note = { notificationId?: string; title?: string; body?: string; uid?: string; type?: string; delivery?: string; read?: boolean; createdAt?: string };

export default function NotificationsPage() {
  const [items, setItems] = useState<Note[]>([]);
  const [tab, setTab] = useState("all");
  useEffect(() => {
    api<{ data: { items: Note[] } }>("/admin/notifications")
      .then((r) => setItems(r.data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const filtered = items.filter((n) => (tab === "unread" ? !n.read : tab === "read" ? n.read : true));
  const unread = items.filter((n) => !n.read).length;
  const read = items.filter((n) => n.read).length;
  const types = countBy(items, (n) => n.type || "system");

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Live notification rows from MongoDB."
        actions={<><Button variant="outline"><CheckSquare size={14} /> Mark all as read</Button><Button variant="outline">Export CSV</Button></>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={fmt(items.length)} icon={<Plane size={18} />} />
        <StatCard label="Unread" value={fmt(unread)} tone="purple" icon={<Mail size={18} />} />
        <StatCard label="Read Rate" value={items.length ? `${Math.round((read / items.length) * 100)}%` : "0%"} tone="success" icon={<Bell size={18} />} />
        <StatCard label="Queued / delivered" value={fmt(items.filter((n) => n.delivery === "delivered" || n.delivery === "queued").length)} tone="warning" icon={<Shield size={18} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 text-sm font-medium">Notification volume</div>
          <LineCard data={lineTrend(items.length)} lines={[{ key: "value", color: "var(--accent)" }]} />
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">Notification types</div>
          {types.length ? (
            <DonutCard data={donutFromCounts(types, ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"])} />
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="px-4 pt-3"><Tabs value={tab} onChange={setTab} items={[{ id: "all", label: "All" }, { id: "unread", label: "Unread" }, { id: "read", label: "Read" }]} /></div>
        <div className="flex flex-wrap gap-2 p-3">
          <Input placeholder="Search notifications or users" className="max-w-sm" />
          <Select><option>Type</option></Select>
          <Select><option>Status</option></Select>
        </div>
        <div className="scrollable">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="text-subtle"><tr>{["Notification", "Recipient", "Type", "Delivery", "Read", "Sent At"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length ? filtered.map((n) => (
                <tr key={n.notificationId} className="border-t border-line">
                  <td className="px-4 py-3"><div className="font-medium">{n.title}</div><div className="text-xs text-subtle">{n.body}</div></td>
                  <td className="px-4 py-3">{n.uid}</td>
                  <td className="px-4 py-3 capitalize">{n.type}</td>
                  <td className="px-4 py-3"><Badge tone={n.delivery === "failed" ? "danger" : "success"}>{n.delivery ?? "queued"}</Badge></td>
                  <td className="px-4 py-3">{n.read ? "Read" : "Unread"}</td>
                  <td className="px-4 py-3 text-subtle">{when(n.createdAt)}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={6}>No notifications in the local database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} total={filtered.length} from={filtered.length ? 1 : 0} to={filtered.length} />
      </Card>
    </div>
  );
}
