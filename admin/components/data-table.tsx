"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function DataTable({
  title,
  subtitle,
  path,
}: {
  title: string;
  subtitle: string;
  path: string;
}) {
  const [rows, setRows] = useState<unknown>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ data: unknown }>(path)
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message));
  }, [path]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-slate-500">{subtitle}</p>
      {error ? <p className="mt-4 text-red-600">{error}</p> : null}
      <pre className="mt-6 overflow-auto rounded-2xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-[#161822]">
        {JSON.stringify(rows, null, 2)}
      </pre>
    </div>
  );
}
