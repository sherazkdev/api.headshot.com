export type QueueJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export type QueueJob<T = unknown> = {
  id: string;
  name: string;
  payload: T;
  status: QueueJobStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
};

type Handler = (job: QueueJob) => Promise<void>;

export class MemoryQueue {
  private readonly pending: QueueJob[] = [];
  private readonly inflight = new Map<string, QueueJob>();
  private readonly handlers = new Map<string, Handler>();
  private running = false;
  private active = 0;

  constructor(private readonly concurrency: number) {}

  register(name: string, handler: Handler): void {
    this.handlers.set(name, handler);
  }

  enqueue<T>(name: string, payload: T, maxAttempts = 5): QueueJob<T> {
    const job: QueueJob<T> = {
      id: crypto.randomUUID(),
      name,
      payload,
      status: "queued",
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
    };
    this.pending.push(job);
    this.kick();
    return job;
  }

  stats() {
    return {
      queued: this.pending.length,
      processing: this.active,
      inflight: this.inflight.size,
    };
  }

  start(): void {
    this.running = true;
    this.kick();
  }

  stop(): void {
    this.running = false;
  }

  private kick(): void {
    if (!this.running) return;
    while (this.active < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      if (!job) return;
      void this.run(job);
    }
  }

  private async run(job: QueueJob): Promise<void> {
    const handler = this.handlers.get(job.name);
    if (!handler) {
      job.status = "failed";
      job.error = `No handler for ${job.name}`;
      return;
    }
    this.active += 1;
    job.status = "processing";
    job.startedAt = Date.now();
    job.attempts += 1;
    this.inflight.set(job.id, job);
    try {
      await handler(job);
      job.status = "completed";
      job.finishedAt = Date.now();
    } catch (err) {
      job.error = err instanceof Error ? err.message : "Job failed";
      if (job.attempts < job.maxAttempts) {
        job.status = "queued";
        this.pending.push(job);
      } else {
        job.status = "failed";
        job.finishedAt = Date.now();
      }
    } finally {
      this.inflight.delete(job.id);
      this.active -= 1;
      this.kick();
    }
  }
}
