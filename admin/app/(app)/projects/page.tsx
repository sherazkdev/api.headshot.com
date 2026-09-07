"use client";

import { useEffect, useState } from "react";
import { Clock, Folder, LayoutGrid, List, Star, HardDrive } from "lucide-react";
import { api } from "@/lib/api";
import { fmt, when } from "@/lib/format";
import { Badge, Card, Input, PageHeader, Select, StatCard } from "@/components/ui";
import { clsx } from "@/components/clsx";

type Project = { projectId?: string; name?: string; uid?: string; toolType?: string; status?: string; isFavorite?: boolean; updatedAt?: string };

export default function ProjectsPage() {
  const [items, setItems] = useState<Project[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  useEffect(() => {
    api<{ data: { items: Project[] } }>("/admin/projects")
      .then((r) => setItems(r.data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const favorites = items.filter((p) => p.isFavorite).length;
  const today = items.filter((p) => p.updatedAt && new Date(p.updatedAt).toDateString() === new Date().toDateString()).length;

  return (
    <div>
      <PageHeader title="Projects & Library" subtitle="Live cloud-synced projects from MongoDB." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Projects" value={fmt(items.length)} icon={<Folder size={18} />} />
        <StatCard label="Favorites" value={fmt(favorites)} tone="warning" icon={<Star size={18} />} />
        <StatCard label="In this list" value={fmt(items.length)} tone="purple" icon={<HardDrive size={18} />} />
        <StatCard label="Updated Today" value={fmt(today)} tone="success" icon={<Clock size={18} />} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Search project, user or ID" className="max-w-sm" />
        <Select><option>Tool Type</option></Select>
        <Select><option>Status</option></Select>
        <Select><option>Favorite</option></Select>
        <div className="ml-auto flex rounded-btn border border-line p-0.5">
          <button className={clsx("rounded-btn p-1.5", view === "grid" && "bg-accent text-white")} onClick={() => setView("grid")}><LayoutGrid size={16} /></button>
          <button className={clsx("rounded-btn p-1.5", view === "list" && "bg-accent text-white")} onClick={() => setView("list")}><List size={16} /></button>
        </div>
      </div>
      {items.length === 0 ? (
        <Card className="mt-4 p-10 text-center text-sm text-subtle">No projects in the local database yet.</Card>
      ) : view === "grid" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((p) => (
            <Card key={p.projectId} className="overflow-hidden">
              <div className="relative aspect-[4/5] bg-muted">
                <Badge tone={p.status === "completed" ? "success" : "info"}>{p.status ?? "pending"}</Badge>
                {p.isFavorite ? <Star size={16} className="absolute right-3 top-3 text-warning" /> : null}
              </div>
              <div className="p-3">
                <div className="font-medium">{p.name}</div>
                <div className="mt-1 text-xs text-subtle">{p.uid} · {p.toolType}</div>
                <div className="mt-2 flex justify-between text-[11px] text-faint">
                  <span>ID: {p.projectId}</span>
                  <span>{when(p.updatedAt)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="mt-4 overflow-hidden">
          <table className="min-w-full text-left text-sm">
            <thead className="text-subtle"><tr>{["Name", "User", "Type", "Status", "Updated"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.projectId} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.uid}</td>
                  <td className="px-4 py-3">{p.toolType}</td>
                  <td className="px-4 py-3"><Badge tone="success">{p.status}</Badge></td>
                  <td className="px-4 py-3 text-subtle">{when(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
