export const AI_JOB_POLL_MS = 1000;
export const AI_JOB_POLL_MAX = 120;
export const DEFAULT_FETCH_MS = 180_000;
export const LONG_FETCH_MS = 180_000;

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function pollAiJob<T extends { status?: string; imageUrl?: string | null }>(
  load: () => Promise<T>,
): Promise<{ job: T; status: string; imageUrl: string | null; polls: number; waitMs: number }> {
  const started = Date.now();
  let job: T = await load();
  let status = String(job.status ?? "missing");
  let polls = 1;
  while (polls < AI_JOB_POLL_MAX) {
    if (status === "completed" || status === "failed" || status === "cancelled") break;
    await sleep(AI_JOB_POLL_MS);
    job = await load();
    status = String(job.status ?? "missing");
    polls += 1;
  }
  return {
    job,
    status,
    imageUrl: job.imageUrl ?? null,
    polls,
    waitMs: Date.now() - started,
  };
}
