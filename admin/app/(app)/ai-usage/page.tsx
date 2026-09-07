"use client";

import { useEffect, useState } from "react";
import { Activity, Cpu, Layers, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { Card, PageHeader, Select, StatCard } from "@/components/ui";
import { BarCard, DonutCard, EmptyChart } from "@/components/charts";

type Bucket = { _id: string; n: number };

export default function AiUsagePage() {
  const [stats, setStats] = useState({ jobs: 0, tools: 0, providers: 0, exceeded: 0 });
  const [byType, setByType] = useState<Bucket[]>([]);
  const [byProvider, setByProvider] = useState<Bucket[]>([]);
  const [byStatus, setByStatus] = useState<Bucket[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<{ data: { jobs?: number; byEndpoint?: Bucket[]; byProvider?: Bucket[]; byStatus?: Bucket[]; exceeded50Today?: unknown[] } }>("/admin/ai-usage")
      .then((r) => {
        const types = r.data.byEndpoint ?? [];
        const providers = (r.data.byProvider ?? []).filter((p) => p._id);
        const jobs = r.data.jobs ?? types.reduce((s, x) => s + x.n, 0);
        setByType(types);
        setByProvider(providers);
        setByStatus(r.data.byStatus ?? []);
        setStats({
          jobs,
          tools: types.length,
          providers: providers.length,
          exceeded: r.data.exceeded50Today?.length ?? 0,
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const providerColors: Record<string, string> = { gemini: "#3b82f6", bfl: "#8b5cf6", flux: "#8b5cf6" };
  const donut = byProvider.map((p) => ({
    name: p._id === "bfl" ? "Flux" : p._id,
    value: p.n,
    color: providerColors[p._id] ?? "#22c55e",
  }));
  const bars = byType.map((t) => ({
    label: (t._id || "other").replaceAll("_", " "),
    n: t.n,
  }));
  const statusBars = byStatus.map((t) => ({
    label: (t._id || "unknown").replaceAll("_", " "),
    n: t.n,
  }));

  return (
    <div>
      <PageHeader
        title="AI Usage / Analytics"
        subtitle="AI job volume, provider mix, and tool usage."
        actions={<Select className="w-36"><option>All time</option></Select>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="AI Jobs" value={loaded ? fmt(stats.jobs) : "—"} icon={<Cpu size={18} />} />
        <StatCard label="Tools used" value={loaded ? fmt(stats.tools) : "—"} tone="purple" icon={<Layers size={18} />} />
        <StatCard label="Providers" value={loaded ? fmt(stats.providers) : "—"} tone="warning" icon={<Activity size={18} />} />
        <StatCard label="Users over 50 today" value={loaded ? fmt(stats.exceeded) : "—"} tone="success" icon={<TriangleAlert size={18} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 text-sm font-medium">Jobs by tool</div>
          {bars.length ? <BarCard data={bars} dataKey="n" /> : <EmptyChart />}
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">Provider mix</div>
          {donut.length ? <DonutCard data={donut} /> : <EmptyChart />}
        </Card>
      </div>
      <Card className="mt-4 p-4">
        <div className="mb-3 text-sm font-medium">Jobs by status</div>
        {statusBars.length ? <BarCard data={statusBars} dataKey="n" /> : <EmptyChart />}
      </Card>
    </div>
  );
}
