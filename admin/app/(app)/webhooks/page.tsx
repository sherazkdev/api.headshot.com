"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Webhook } from "lucide-react";
import { api } from "@/lib/api";
import { fmt, when } from "@/lib/format";
import { Badge, Button, Card, Input, PageHeader, Pagination, Select, StatCard } from "@/components/ui";
import { LineCard } from "@/components/charts";
import { lineTrend } from "@/lib/chart-data";

type Event = { eventId?: string; source?: string; eventType?: string; type?: string; status?: string; attempts?: number; retries?: number; createdAt?: string };

export default function WebhooksPage() {
  const [items, setItems] = useState<Event[]>([]);
  useEffect(() => {
    api<{ data: { items: Event[] } }>("/admin/webhooks")
      .then((r) => setItems(r.data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const processed = items.filter((e) => e.status === "processed").length;
  const retries = items.filter((e) => (e.attempts ?? e.retries ?? 0) > 1 || e.status === "retrying").length;
  const failed = items.filter((e) => e.status === "failed").length;

  return (
    <div>
      <PageHeader title="Webhooks / Events" subtitle="Monitor inbound webhook events and delivery health." actions={<Button variant="outline">Replay selected</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Events" value={fmt(items.length)} icon={<Webhook size={18} />} />
        <StatCard label="Processed" value={fmt(processed)} tone="success" icon={<CheckCircle2 size={18} />} />
        <StatCard label="Retries" value={fmt(retries)} tone="warning" icon={<Activity size={18} />} />
        <StatCard label="Failed" value={fmt(failed)} tone="danger" icon={<AlertTriangle size={18} />} />
      </div>
      <Card className="mt-4 p-4">
        <div className="mb-3 text-sm font-medium">Webhook event volume</div>
        <LineCard data={lineTrend(items.length)} lines={[{ key: "value", color: "var(--accent)" }]} />
      </Card>
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input placeholder="Search event ID or type" className="max-w-sm" />
          <Select><option>Source</option></Select>
          <Select><option>Status</option></Select>
        </div>
        <div className="scrollable">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="text-subtle"><tr>{["Event ID", "Source", "Type", "Retries", "Status", "Received"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {items.length ? items.map((e) => (
                <tr key={e.eventId} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs text-accent">{e.eventId}</td>
                  <td className="px-4 py-3 uppercase">{e.source}</td>
                  <td className="px-4 py-3">{e.eventType ?? e.type ?? "—"}</td>
                  <td className="px-4 py-3">{e.attempts ?? e.retries ?? 0}</td>
                  <td className="px-4 py-3"><Badge tone={e.status === "processed" ? "success" : e.status === "failed" ? "danger" : "warning"}>{e.status}</Badge></td>
                  <td className="px-4 py-3 text-subtle">{when(e.createdAt)}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={6}>No webhook events in the local database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} total={items.length} from={items.length ? 1 : 0} to={items.length} />
      </Card>
    </div>
  );
}
