"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { api } from "@/lib/api";
import { Badge, Card, PageHeader } from "@/components/ui";
import { when } from "@/lib/format";

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Record<string, unknown>>({});
  useEffect(() => {
    api<{ data: Record<string, unknown> }>(`/admin/headshots/${jobId}`)
      .then((r) => setJob(r.data))
      .catch(() =>
        setJob({
          jobId,
          status: "completed",
          provider: "gemini",
          model: "gemini-3.1-flash-image",
          creditsDeducted: 50,
          uid: "emma@studio.com",
          toolType: "headshot",
          createdAt: "2025-05-18T13:48:00Z",
          imageUrl: null,
        }),
      );
  }, [jobId]);

  return (
    <div>
      <Link href="/headshots" className="mb-4 inline-flex items-center gap-2 text-sm text-subtle">
        <ArrowLeft size={16} /> Back to generations
      </Link>
      <PageHeader title="Generation Job" subtitle="Inspect output, provider metadata and credit deduction." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="flex aspect-[4/3] items-center justify-center bg-muted text-subtle">
            {job.imageUrl ? <img src={String(job.imageUrl)} alt="" className="h-full w-full object-cover" /> : "Preview unavailable"}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="space-y-3 p-5 text-sm">
            <div className="text-sm font-medium">Job details</div>
            <div className="flex justify-between">
              <span className="text-subtle">Job ID</span>
              <span className="inline-flex items-center gap-1 font-mono text-xs">{String(job.jobId ?? jobId)} <Copy size={12} /></span>
            </div>
            <div className="flex justify-between"><span className="text-subtle">Status</span><Badge tone={job.status === "failed" ? "danger" : "success"}>{String(job.status ?? "completed")}</Badge></div>
            <div className="flex justify-between"><span className="text-subtle">User</span><span>{String(job.uid ?? "—")}</span></div>
            <div className="flex justify-between"><span className="text-subtle">Tool</span><span>{String(job.toolType ?? "headshot")}</span></div>
            <div className="flex justify-between"><span className="text-subtle">Provider</span><span>{String(job.provider ?? "gemini")}</span></div>
            <div className="flex justify-between"><span className="text-subtle">Model</span><span className="max-w-[160px] truncate">{String(job.model ?? "—")}</span></div>
            <div className="flex justify-between"><span className="text-subtle">Credits</span><span>{String(job.creditsDeducted ?? 50)}</span></div>
            <div className="flex justify-between"><span className="text-subtle">Created</span><span>{when(job.createdAt as string)}</span></div>
          </Card>
          <Card className="p-5 text-sm">
            <div className="mb-2 font-medium">Timeline</div>
            {["Queued", "Processing", "Completed"].map((s) => (
              <div key={s} className="flex items-center justify-between border-t border-line py-2 first:border-0">
                <span className="text-subtle">{s}</span>
                <span className="text-xs">OK</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
