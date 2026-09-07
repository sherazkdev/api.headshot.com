"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Crown, Download, Plus, Search, ShieldAlert, UserCheck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { fmt, initials, when } from "@/lib/format";
import { Badge, Button, Card, Input, PageHeader, Pagination, Select, StatCard } from "@/components/ui";
import { trendHint } from "@/lib/chart-data";
import { clsx } from "@/components/clsx";

type User = {
  uid: string;
  name: string;
  email: string;
  loginProvider?: string;
  credits?: number;
  isPremium?: boolean;
  premiumPlanName?: string;
  accountStatus?: string;
  lastLoginAt?: string;
  createdAt?: string;
};

export default function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [totals, setTotals] = useState({ totalUsers: 0, premium: 0, suspended: 0 });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [provider, setProvider] = useState("all");
  const [premium, setPremium] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      api<{ data: { items: User[] } }>("/admin/users"),
      api<{ data: { totalUsers?: number; premium?: number; suspended?: number } }>("/admin/overview"),
    ])
      .then(([users, overview]) => {
        setItems(users.data.items ?? []);
        setTotals({
          totalUsers: overview.data.totalUsers ?? users.data.items?.length ?? 0,
          premium: overview.data.premium ?? 0,
          suspended: overview.data.suspended ?? 0,
        });
      })
      .catch(() => setItems([]));
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((u) => {
        const hay = `${u.name} ${u.email} ${u.uid}`.toLowerCase();
        if (q && !hay.includes(q.toLowerCase())) return false;
        if (status !== "all" && (u.accountStatus ?? "active") !== status) return false;
        if (provider !== "all" && (u.loginProvider ?? "email") !== provider) return false;
        if (premium === "premium" && !u.isPremium) return false;
        if (premium === "free" && u.isPremium) return false;
        return true;
      }),
    [items, q, status, provider, premium],
  );

  function toggle(uid: string) {
    setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));
  }

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage registered accounts and access." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={fmt(totals.totalUsers)} hint={trendHint(totals.totalUsers)} icon={<Users size={18} />} />
        <StatCard label="Active" value={fmt(Math.max(totals.totalUsers - totals.suspended, 0))} hint={trendHint(Math.max(totals.totalUsers - totals.suspended, 0))} tone="success" icon={<UserCheck size={18} />} />
        <StatCard label="Premium" value={fmt(totals.premium)} hint={trendHint(totals.premium)} tone="purple" icon={<Crown size={18} />} />
        <StatCard label="Suspended" value={fmt(totals.suspended)} hint="accountStatus" tone="warning" icon={<ShieldAlert size={18} />} />
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-faint" />
            <Input className="pl-8" placeholder="Search by name, email or UID" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="all">Provider</option>
            <option value="google">Google</option>
            <option value="apple">Apple</option>
            <option value="email">Email</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Account Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </Select>
          <Select value={premium} onChange={(e) => setPremium(e.target.value)}>
            <option value="all">Premium Status</option>
            <option value="premium">Premium</option>
            <option value="free">Free</option>
          </Select>
          <Select defaultValue="range">
            <option value="range">Apr 24, 2025 – May 23, 2025</option>
          </Select>
          <Button variant="outline"><Download size={14} /> Export CSV</Button>
          <Button><Plus size={14} /> Add user</Button>
        </div>
        {selected.length ? (
          <div className="flex items-center gap-3 border-b border-line bg-muted px-4 py-2 text-sm">
            <span>{selected.length} selected</span>
            <button className="text-accent">Activate</button>
            <button className="text-accent">Suspend</button>
            <button className="text-danger">Delete</button>
            <button className="ml-auto text-subtle" onClick={() => setSelected([])}>Clear selection</button>
          </div>
        ) : null}
        <div className="scrollable">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="text-subtle">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" /></th>
                {["User", "UID", "Provider", "Credits", "Plan", "Account Status", "Last Login", "Created", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((u) => (
                <tr key={u.uid} className={clsx("border-t border-line hover:bg-muted", selected.includes(u.uid) && "bg-accent-soft/40")}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(u.uid)} onChange={() => toggle(u.uid)} /></td>
                  <td className="px-4 py-3">
                    <Link href={`/users/${u.uid}`} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent">{initials(u.name || u.email)}</span>
                      <span>
                        <div className="font-medium">{u.name || "—"}</div>
                        <div className="text-xs text-subtle">{u.email}</div>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{u.uid}</td>
                  <td className="px-4 py-3 capitalize">{u.loginProvider ?? "email"}</td>
                  <td className="px-4 py-3">{fmt(u.credits ?? 0)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.premiumPlanName === "Yearly" ? "purple" : u.isPremium ? "info" : "neutral"}>{u.premiumPlanName ?? "Free"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.accountStatus === "suspended" ? "warning" : u.accountStatus === "deleted" ? "danger" : "success"}>
                      {u.accountStatus ?? "active"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-subtle">{when(u.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-subtle">{when(u.createdAt)}</td>
                  <td className="px-4 py-3"><Link className="text-accent" href={`/users/${u.uid}`}>View</Link></td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-subtle" colSpan={10}>No users in the local database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} total={filtered.length} from={filtered.length ? 1 : 0} to={filtered.length} />
      </Card>
    </div>
  );
}
