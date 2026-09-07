"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Ban,
  Clock,
  Copy,
  Download,
  KeyRound,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { api, setApiKey } from "@/lib/api";
import { fmt, initials, when } from "@/lib/format";
import { Banner, Button, Card, Input, Modal, PageHeader, Pagination, Select, StatCard, StatusDot, Tabs } from "@/components/ui";
import { DualLineCard } from "@/components/charts";
import { trafficSeries, trendHint } from "@/lib/chart-data";
import { clsx } from "@/components/clsx";

type KeyRow = {
  _id: string;
  name: string;
  ownerEmail: string;
  ownerName?: string;
  prefix: string;
  role: string;
  status: string;
  requestCount: number;
  lastUsedAt?: string | null;
  createdAt: string;
};

type Created = KeyRow & { plaintext: string };

function classify(row: KeyRow) {
  if (row.status === "revoked") return "revoked";
  if (!row.lastUsedAt) return "never";
  const days = (Date.now() - new Date(row.lastUsedAt).getTime()) / 86400000;
  if (days > 30) return "idle";
  if (days <= 1) return "recent";
  return "active";
}

function relative(value?: string | null) {
  if (!value) return "Never";
  const ms = Date.now() - new Date(value).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `${Math.max(min, 1)} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.round(hr / 24)} days ago`;
}

export default function ApiKeysPage() {
  const [items, setItems] = useState<KeyRow[]>([]);
  const [stats, setStats] = useState({ activeKeys: 0, usedToday: 0, unused30Days: 0, revoked: 0, neverUsed: 0 });
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [owner, setOwner] = useState("all");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [lastUsed, setLastUsed] = useState("any");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<"generate" | "rotate" | "revoke" | null>(null);
  const [target, setTarget] = useState<KeyRow | null>(null);
  const [name, setName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "read_only" | "developer">("admin");
  const [created, setCreated] = useState<Created | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  async function load() {
    try {
      const [list, st] = await Promise.all([
        api<{ data: { items: KeyRow[] } }>("/admin/api-keys"),
        api<{ data: { activeKeys?: number; usedToday?: number; unused30Days?: number; revoked?: number; health?: { neverUsed?: number } } }>("/admin/api-keys/stats"),
      ]);
      const rows = list.data.items ?? [];
      setItems(rows);
      setStats({
        activeKeys: st.data.activeKeys ?? rows.filter((k) => k.status === "active").length,
        usedToday: st.data.usedToday ?? 0,
        unused30Days: st.data.unused30Days ?? rows.filter((k) => classify(k) === "idle").length,
        revoked: st.data.revoked ?? rows.filter((k) => k.status === "revoked").length,
        neverUsed: st.data.health?.neverUsed ?? rows.filter((k) => !k.lastUsedAt).length,
      });
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const owners = useMemo(() => Array.from(new Set(items.map((i) => i.ownerEmail))), [items]);

  const filtered = items.filter((row) => {
    const bucket = classify(row);
    if (tab === "active" && row.status !== "active") return false;
    if (tab === "recent" && bucket !== "recent") return false;
    if (tab === "idle" && bucket !== "idle") return false;
    if (tab === "never" && bucket !== "never") return false;
    if (tab === "revoked" && row.status !== "revoked") return false;
    if (owner !== "all" && row.ownerEmail !== owner) return false;
    if (role !== "all" && row.role !== role) return false;
    if (status !== "all" && row.status !== status) return false;
    if (lastUsed === "never" && row.lastUsedAt) return false;
    if (lastUsed === "30d" && row.lastUsedAt && Date.now() - new Date(row.lastUsedAt).getTime() > 30 * 86400000) return false;
    const hay = `${row.name} ${row.prefix} ${row.ownerEmail} ${row.ownerName ?? ""}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: items.length,
    active: items.filter((i) => i.status === "active").length,
    recent: items.filter((i) => classify(i) === "recent").length,
    idle: items.filter((i) => classify(i) === "idle").length,
    never: items.filter((i) => classify(i) === "never").length,
    revoked: items.filter((i) => i.status === "revoked").length,
  };

  async function generate(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Enter a clear key name.");
      return;
    }
    try {
      const res = await api<{ data: Created }>("/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), role: newRole, env: "live" }),
      });
      setCreated(res.data);
      setOpen(null);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate key");
    }
  }

  async function rotate(id: string) {
    const res = await api<{ data: Created }>(`/admin/api-keys/${id}/rotate`, { method: "POST" });
    setCreated(res.data);
    setOpen(null);
    await load();
  }

  async function revoke(id: string) {
    await api(`/admin/api-keys/${id}/revoke`, { method: "POST" });
    setOpen(null);
    await load();
  }

  const roleTone = (r: string): "purple" | "success" | "info" => (r === "admin" ? "purple" : r === "developer" ? "success" : "info");
  const statusTone = (s: string, bucket: string): "danger" | "warning" | "success" => (s === "revoked" ? "danger" : bucket === "idle" ? "warning" : "success");
  const successTotal = items.reduce((s, k) => s + k.requestCount, 0);
  const deniedTotal = Math.max(stats.revoked, Math.round(successTotal * 0.04));

  return (
    <div>
      <PageHeader
        title="API Keys"
        subtitle="Manage permanent credentials for users and integrations."
        actions={
          <>
            <Button variant="outline"><Download size={14} /> Export Activity</Button>
            <Button onClick={() => { setOpen("generate"); setError(""); }}><Plus size={14} /> Generate API Key</Button>
          </>
        }
      />
      <Banner className="mb-4">
        API keys are stored as secure hashes. The full key is shown once at creation and cannot be retrieved later.{" "}
        <span className="font-medium underline">Learn about key security</span>
      </Banner>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Keys" value={fmt(stats.activeKeys)} hint={trendHint(stats.activeKeys)} icon={<KeyRound size={18} />} />
        <StatCard label="Used Today" value={fmt(stats.usedToday)} hint={trendHint(stats.usedToday)} tone="purple" icon={<Activity size={18} />} />
        <StatCard label="Unused 30 Days" value={fmt(stats.unused30Days)} hint="review recommended" tone="warning" icon={<Clock size={18} />} />
        <StatCard label="Revoked" value={fmt(stats.revoked)} hint="all time" tone="danger" icon={<Ban size={18} />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">API Key Traffic</div>
            <div className="flex gap-3 text-xs text-subtle">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-accent" /> Successful requests</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-px w-4 border-t border-dashed border-danger" /> Denied requests</span>
            </div>
          </div>
          <DualLineCard
            data={trafficSeries(successTotal || stats.usedToday, deniedTotal)}
            primaryKey="success"
            secondaryKey="denied"
            primaryLabel="Successful requests"
            secondaryLabel="Denied requests"
          />
        </Card>
        <Card className="p-4">
          <div className="mb-4 text-sm font-medium">Key Health</div>
          {([
            ["Active", stats.activeKeys],
            ["Idle", stats.unused30Days],
            ["Never used", stats.neverUsed],
            ["Revoked", stats.revoked],
          ] as const).map(([label, n]) => {
            const total = Math.max(stats.activeKeys + stats.unused30Days + stats.neverUsed + stats.revoked, 1);
            const pct = Math.round((n / total) * 100);
            return (
            <div key={label} className="mb-4 last:mb-0">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-subtle">{label}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </div>
            );
          })}
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="px-4 pt-3">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "all", label: "All", count: counts.all },
              { id: "active", label: "Active", count: counts.active },
              { id: "recent", label: "Recently Used", count: counts.recent },
              { id: "idle", label: "Idle", count: counts.idle },
              { id: "never", label: "Never Used", count: counts.never },
              { id: "revoked", label: "Revoked", count: counts.revoked },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="all">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="read_only">Read Only</option>
            <option value="developer">Developer</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="revoked">Revoked</option>
          </Select>
          <Select value={lastUsed} onChange={(e) => setLastUsed(e.target.value)}>
            <option value="any">Last used: Any</option>
            <option value="30d">Last 30 days</option>
            <option value="never">Never used</option>
          </Select>
          <Input placeholder="Search key, prefix or owner" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ml-auto rounded-btn p-2 hover:bg-muted" onClick={() => void load()} aria-label="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="scrollable">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="text-subtle">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" /></th>
                {["Key Name", "Owner", "Key Prefix", "Role", "Created", "Last Used", "Requests", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const bucket = classify(row);
                return (
                  <tr key={row._id} className="border-t border-line hover:bg-muted">
                    <td className="px-4 py-3"><input type="checkbox" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium">
                        <KeyRound size={14} className="text-accent" />
                        {row.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[10px] font-medium text-accent">
                          {initials(row.ownerName ?? row.ownerEmail)}
                        </span>
                        <span>
                          <div>{row.ownerName ?? "Owner"}</div>
                          <div className="text-xs text-subtle">{row.ownerEmail}</div>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        {row.prefix}…
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard.writeText(row.prefix)}
                          aria-label="Copy prefix"
                        >
                          <Copy size={12} className="text-faint" />
                        </button>
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", roleTone(row.role) === "purple" ? "bg-[color-mix(in_srgb,var(--purple)_16%,transparent)] text-[var(--purple)]" : roleTone(row.role) === "success" ? "bg-[var(--success-soft)] text-success" : "bg-accent-soft text-accent")}>{row.role.replace("_", " ")}</span></td>
                    <td className="px-4 py-3 text-subtle">{when(row.createdAt)}</td>
                    <td className="px-4 py-3 text-subtle">{relative(row.lastUsedAt)}</td>
                    <td className="px-4 py-3">{fmt(row.requestCount)}</td>
                    <td className="px-4 py-3">
                      <StatusDot tone={statusTone(row.status, bucket)} label={row.status === "revoked" ? "Revoked" : bucket === "idle" ? "Idle" : "Active"} />
                    </td>
                    <td className="relative px-4 py-3">
                      <button className="rounded-btn p-1 hover:bg-muted" onClick={() => setMenu(menu === row._id ? null : row._id)}>
                        <MoreHorizontal size={16} />
                      </button>
                      {menu === row._id ? (
                        <div className="absolute right-4 z-10 w-36 rounded-card border border-line bg-elevated p-1 shadow-card">
                          <button className="block w-full rounded-btn px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setTarget(row); setOpen("rotate"); setMenu(null); }}>Rotate</button>
                          {row.status !== "revoked" ? (
                            <button className="block w-full rounded-btn px-3 py-1.5 text-left text-sm text-danger hover:bg-muted" onClick={() => { setTarget(row); setOpen("revoke"); setMenu(null); }}>Revoke</button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} total={filtered.length} from={filtered.length ? 1 : 0} to={filtered.length} />
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer p-4" onClick={() => setOpen("generate")}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent"><Plus size={16} /></div>
          <div className="mt-3 font-medium">Generate</div>
          <p className="mt-1 text-sm text-subtle">Create a new key with a clear name and copy it immediately.</p>
        </Card>
        <Card className="p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--purple)_16%,transparent)] text-[var(--purple)]"><RotateCcw size={16} /></div>
          <div className="mt-3 font-medium">Rotate</div>
          <p className="mt-1 text-sm text-subtle">Replace a key and revoke its previous credential.</p>
        </Card>
        <Card className="p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--error-soft)] text-danger"><Ban size={16} /></div>
          <div className="mt-3 font-medium">Revoke</div>
          <p className="mt-1 text-sm text-subtle">Deny access immediately while keeping audit history.</p>
        </Card>
      </div>
      <p className="mt-3 text-xs text-faint">All generate, rotate and revoke actions are written to the audit log.</p>

      {open === "generate" ? (
        <Modal title="Generate API Key" onClose={() => setOpen(null)}>
          <p className="mt-1 text-sm text-subtle">Name the key clearly. The complete secret is shown only once.</p>
          <form onSubmit={generate} className="mt-4 space-y-3">
            <Input placeholder="Key name, e.g. Production Mobile App" value={name} onChange={(e) => setName(e.target.value)} />
            <Select value={newRole} onChange={(e) => setNewRole(e.target.value as typeof newRole)}>
              <option value="admin">Admin</option>
              <option value="read_only">Read Only</option>
              <option value="developer">Developer</option>
            </Select>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
              <Button type="submit">Generate</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {open === "rotate" && target ? (
        <Modal title="Rotate key" onClose={() => setOpen(null)}>
          <p className="mt-2 text-sm text-subtle">This replaces <strong>{target.name}</strong> and revokes the previous credential.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button onClick={() => void rotate(target._id)}>Rotate now</Button>
          </div>
        </Modal>
      ) : null}

      {open === "revoke" && target ? (
        <Modal title="Revoke key" onClose={() => setOpen(null)}>
          <p className="mt-2 text-sm text-subtle">Deny access for <strong>{target.name}</strong> immediately. Audit history is kept.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => void revoke(target._id)}>Revoke</Button>
          </div>
        </Modal>
      ) : null}

      {created ? (
        <Modal title="Copy your API key" onClose={() => setCreated(null)}>
          <p className="mt-1 text-sm text-subtle">This is the only time the full key is shown.</p>
          <code className="mt-4 block break-all rounded-input bg-muted p-3 text-xs">{created.plaintext}</code>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(created.plaintext);
                setApiKey(created.plaintext);
              }}
            >
              Copy & use as x-api-key
            </Button>
            <Button variant="outline" onClick={() => setCreated(null)}>Done</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
