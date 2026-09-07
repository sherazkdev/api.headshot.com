"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { api } from "@/lib/api";
import { fmt, initials, when } from "@/lib/format";
import { Badge, Button, Card, PageHeader, Tabs } from "@/components/ui";

type User = Record<string, unknown> & { uid?: string; name?: string; email?: string; accountStatus?: string; wallet?: Record<string, unknown> };

export default function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    api<{ data: User }>(`/admin/users/${uid}`)
      .then((r) => setUser(r.data))
      .catch(() =>
        setUser({
          uid,
          name: "Emma Wilson",
          email: "emma@studio.com",
          accountStatus: "active",
          loginProvider: "google",
          credits: 250,
          passCredits: 1000,
          wallet: { spendableCredits: 1250, credits: 250, passCredits: 1000, usesLeft: 25, isPremium: true },
        }),
      );
  }, [uid]);

  const wallet = (user?.wallet ?? {}) as Record<string, number | string | boolean>;

  return (
    <div>
      <Link href="/users" className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-line">
        <ArrowLeft size={16} />
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {initials(String(user?.name ?? "EW"))}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{String(user?.name ?? "Emma Wilson")}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-subtle">
              <span>{String(user?.email ?? "")}</span>
              <span className="inline-flex items-center gap-1 font-mono text-xs">
                {uid} <Copy size={12} />
              </span>
              <Badge tone="success">{String(user?.accountStatus ?? "active")}</Badge>
            </div>
          </div>
        </div>
        <Button variant="outline">Suspend</Button>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "overview", label: "Overview" },
          { id: "wallet", label: "Wallet" },
          { id: "subscription", label: "Subscription" },
          { id: "purchases", label: "Purchases" },
          { id: "activity", label: "Activity" },
        ]}
      />
      {tab === "overview" ? <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-5">
            <div className="mb-4 text-sm font-medium">Account Information</div>
            {[
              ["Name", user?.name],
              ["Email", user?.email],
              ["Login Provider", user?.loginProvider ?? "google"],
              ["Email Verified", "Verified"],
              ["Account Status", user?.accountStatus ?? "active"],
              ["Created At", when((user?.createdAt as string) || "2024-04-12T09:24:00Z")],
              ["Last Login", when((user?.lastLoginAt as string) || "2025-05-18T14:15:00Z")],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between border-t border-line py-2 text-sm first:border-0">
                <span className="text-subtle">{String(k)}</span>
                <span>{String(v ?? "—")}</span>
              </div>
            ))}
          </Card>
          <Card className="p-5">
            <div className="mb-4 text-sm font-medium">Recent Activity</div>
            {[
              ["Login", "May 18, 2025 02:15 PM · 203.0.113.14"],
              ["Headshot generation completed", "May 18, 2025 01:48 PM · Generated 8 headshots"],
              ["Credits purchased", "May 17, 2025 11:32 AM · +$25.00"],
              ["Subscription renewed", "May 12, 2025 09:24 AM"],
            ].map(([e, meta]) => (
              <div key={e} className="border-t border-line py-3 text-sm first:border-0">
                <div className="font-medium">{e}</div>
                <div className="text-xs text-subtle">{meta}</div>
              </div>
            ))}
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 text-sm font-medium">Wallet Summary</div>
            {[
              ["Spendable Credits", wallet.spendableCredits ?? 1250],
              ["Bonus Credits", wallet.credits ?? 250],
              ["Pass Credits", wallet.passCredits ?? 1000],
              ["Uses Left", wallet.usesLeft ?? 25],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between py-1.5 text-sm">
                <span className="text-subtle">{String(k)}</span>
                <span className="font-medium">{fmt(Number(v))}</span>
              </div>
            ))}
          </Card>
          <Card className="p-5">
            <div className="mb-3 text-sm font-medium">Subscription</div>
            <div className="flex items-center justify-between text-sm">
              <span>Monthly</span>
              <Badge tone="success">Active</Badge>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-3 text-sm font-medium">Usage Summary</div>
            {[
              ["Headshots Generated", 38],
              ["Branding Analyses", 6],
              ["Profile Reviews", 4],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between py-1.5 text-sm">
                <span className="text-subtle">{String(k)}</span>
                <span>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div> : null}
      {tab === "wallet" ? (
        <Card className="mt-4 p-5">
          <div className="mb-3 text-sm font-medium">Wallet</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Spendable", wallet.spendableCredits ?? 1250],
              ["Bonus", wallet.credits ?? 250],
              ["Pass", wallet.passCredits ?? 1000],
              ["Uses left", wallet.usesLeft ?? 25],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-card border border-line p-3">
                <div className="text-xs text-subtle">{k}</div>
                <div className="mt-1 text-xl font-semibold">{fmt(Number(v))}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {tab === "subscription" ? (
        <Card className="mt-4 space-y-2 p-5 text-sm">
          <div className="flex justify-between"><span className="text-subtle">Plan</span><span>Monthly</span></div>
          <div className="flex justify-between"><span className="text-subtle">Status</span><Badge tone="success">Active</Badge></div>
          <div className="flex justify-between"><span className="text-subtle">Next Renewal</span><span>Jun 12, 2025</span></div>
          <div className="flex justify-between"><span className="text-subtle">Product ID</span><span>sub_monthly</span></div>
        </Card>
      ) : null}
      {tab === "purchases" ? (
        <Card className="mt-4 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="text-subtle"><tr>{["Purchase", "Amount", "Credits", "Status"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              <tr className="border-t border-line"><td className="px-4 py-3">sub_monthly</td><td className="px-4 py-3">$9.99</td><td className="px-4 py-3">3,000</td><td className="px-4 py-3"><Badge tone="success">completed</Badge></td></tr>
            </tbody>
          </table>
        </Card>
      ) : null}
      {tab === "activity" ? (
        <Card className="mt-4 p-5 text-sm">
          {["Signed in from iOS", "Generated studio headshots", "Claimed ad reward"].map((e) => (
            <div key={e} className="border-t border-line py-3 first:border-0">{e}</div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
