"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Banner, Button, Card, Input, PageHeader } from "@/components/ui";

type Row = { key: string; value: string; type?: string; status?: string; note?: string };

export default function RemoteConfigPage() {
  const [flags, setFlags] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api<{ data: Row[] | { items?: Row[] } }>("/admin/remote-config");
    const rows = Array.isArray(r.data) ? r.data : r.data.items ?? [];
    setFlags(rows.map((x) => ({ key: x.key, value: String(x.value ?? ""), type: x.type, status: x.status })));
  }

  useEffect(() => {
    load().catch(() => setFlags([]));
  }, []);

  async function save() {
    setStatus("");
    setBusy(true);
    try {
      for (const flag of flags) {
        await api("/admin/remote-config", { method: "PATCH", json: { key: flag.key, value: flag.value } });
      }
      await api("/admin/remote-config/publish", { method: "POST", json: {} });
      await load();
      setStatus("Remote config saved and published.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Remote Config / Settings" subtitle="Feature flags stored in MongoDB. Publish writes the current values." actions={<Button onClick={save} disabled={busy}>{busy ? "Publishing…" : "Publish changes"}</Button>} />
      {status ? <Banner className="mb-4">{status}</Banner> : null}
      <Card className="overflow-hidden">
        <div className="scrollable">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="text-subtle"><tr>{["Key", "Value", "Type", "Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {flags.length ? flags.map((f, i) => (
                <tr key={f.key} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs">{f.key}</td>
                  <td className="px-4 py-3">
                    <Input value={f.value} onChange={(e) => setFlags((prev) => prev.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))} />
                  </td>
                  <td className="px-4 py-3 text-subtle">{f.type ?? "json"}</td>
                  <td className="px-4 py-3 text-subtle">{f.status ?? "published"}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={4}>Loading remote config…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
