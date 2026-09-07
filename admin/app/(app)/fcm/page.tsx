"use client";

import { useEffect, useState } from "react";
import { Bell, Send, Smartphone, Users } from "lucide-react";
import { api } from "@/lib/api";
import { fmt, when } from "@/lib/format";
import { Banner, Button, Card, Input, PageHeader, Select, StatCard, Tabs } from "@/components/ui";
import { DonutCard, EmptyChart } from "@/components/charts";

type Token = { uid?: string; email?: string; token?: string; platform?: string; lastSeen?: string };
type Hist = { notificationId?: string; title?: string; delivery?: string; createdAt?: string };

export default function FcmPage() {
  const [tab, setTab] = useState("compose");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [status, setStatus] = useState("");
  const [stats, setStats] = useState({ registeredTokens: 0, androidDevices: 0, iosDevices: 0, invalidTokens: 0 });
  const [tokens, setTokens] = useState<Token[]>([]);
  const [history, setHistory] = useState<Hist[]>([]);

  async function load() {
    const r = await api<{
      data: {
        registeredTokens?: number;
        androidDevices?: number;
        iosDevices?: number;
        invalidTokens?: number;
        tokens?: Token[];
        history?: Hist[];
      };
    }>("/admin/fcm");
    setStats({
      registeredTokens: r.data.registeredTokens ?? 0,
      androidDevices: r.data.androidDevices ?? 0,
      iosDevices: r.data.iosDevices ?? 0,
      invalidTokens: r.data.invalidTokens ?? 0,
    });
    setTokens(r.data.tokens ?? []);
    setHistory(r.data.history ?? []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function send() {
    setStatus("");
    if (!title.trim() || !body.trim()) {
      setStatus("Title and message are required.");
      return;
    }
    try {
      const res = await api<{ data: { queued: number } }>("/admin/fcm/campaign", {
        method: "POST",
        json: { title: title.trim(), body: body.trim(), audience },
      });
      setStatus(`Queued ${res.data.queued} device notifications.`);
      setTitle("");
      setBody("");
      await load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Push failed");
    }
  }

  const android = stats.androidDevices;
  const ios = stats.iosDevices;
  const web = Math.max(stats.registeredTokens - android - ios, 0);

  return (
    <div>
      <PageHeader title="FCM / Notification Management" subtitle="Compose campaigns and inspect registered device tokens." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered Tokens" value={fmt(stats.registeredTokens)} icon={<Smartphone size={18} />} />
        <StatCard label="Android" value={fmt(android)} tone="success" icon={<Users size={18} />} />
        <StatCard label="iOS" value={fmt(ios)} icon={<Send size={18} />} />
        <StatCard label="No token" value={fmt(stats.invalidTokens)} tone="warning" icon={<Bell size={18} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 text-sm font-medium">Campaign history</div>
          {history.length ? (
            <div className="space-y-2 text-sm">
              {history.slice(0, 8).map((c) => (
                <div key={c.notificationId} className="flex items-center justify-between rounded-card border border-line px-3 py-2">
                  <span>{c.title}</span>
                  <span className="text-subtle">{c.delivery} · {when(c.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart label="No FCM campaigns in MongoDB yet." />
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">Platform Mix</div>
          {android + ios + web ? (
            <DonutCard
              data={[
                { name: "Android", value: android, color: "#22c55e" },
                { name: "iOS", value: ios, color: "#3b82f6" },
                { name: "Other", value: web, color: "#8b5cf6" },
              ].filter((d) => d.value > 0)}
            />
          ) : (
            <EmptyChart label="No device tokens registered." />
          )}
        </Card>
      </div>
      <Card className="mt-4 p-4">
        <Tabs value={tab} onChange={setTab} items={[{ id: "compose", label: "Compose" }, { id: "tokens", label: "Tokens" }, { id: "history", label: "History" }]} />
        {tab === "compose" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Input placeholder="Campaign title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="min-h-32 w-full rounded-input border border-line bg-elevated px-3 py-2 text-sm" placeholder="Message body" value={body} onChange={(e) => setBody(e.target.value)} />
              <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="all">All users with tokens</option>
                <option value="subscribers">Subscribers</option>
                <option value="inactive">Inactive 7 days</option>
              </Select>
              <Button onClick={send}><Send size={14} /> Send campaign</Button>
              {status ? <Banner>{status}</Banner> : null}
            </div>
            <Card className="bg-muted p-4">
              <div className="text-xs font-medium text-subtle">Preview</div>
              <div className="mt-3 rounded-card border border-line bg-card p-3">
                <div className="text-sm font-semibold">{title || "Headshot AI"}</div>
                <div className="mt-1 text-sm text-muted">{body || "Your notification message appears here."}</div>
              </div>
            </Card>
          </div>
        ) : null}
        {tab === "tokens" ? (
          <div className="mt-4 scrollable">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="text-subtle"><tr>{["Token", "User", "Platform", "Last Seen"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {tokens.length ? tokens.map((r) => (
                  <tr key={`${r.uid}-${r.token}`} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-xs">{r.token}</td>
                    <td className="px-3 py-2">{r.email || r.uid}</td>
                    <td className="px-3 py-2 capitalize">{r.platform}</td>
                    <td className="px-3 py-2 text-subtle">{when(r.lastSeen)}</td>
                  </tr>
                )) : (
                  <tr><td className="px-3 py-8 text-center text-subtle" colSpan={4}>No FCM tokens registered yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
        {tab === "history" ? (
          <div className="mt-4 space-y-2 text-sm">
            {history.length ? history.map((c) => (
              <div key={c.notificationId} className="flex items-center justify-between rounded-card border border-line px-3 py-2">
                <span>{c.title}</span>
                <span className="text-subtle">{c.delivery} · {when(c.createdAt)}</span>
              </div>
            )) : <div className="py-8 text-center text-subtle">No campaigns yet. Compose one to write it to the database.</div>}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
