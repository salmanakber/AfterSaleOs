import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@aftersale/db";
import { QUEUE_NAMES } from "@aftersale/shared";
import { processWebhookEvent } from "./processors/webhooks";
import { processEmailJob } from "./processors/email";
import { runBackfillJob } from "./processors/backfill";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

async function recordFailure(queue: string, error: unknown, payload?: unknown, shopId?: string) {
  await prisma.jobFailure.create({
    data: {
      queue,
      shopId,
      error: error instanceof Error ? error.message : String(error),
      payload: payload as object | undefined,
    },
  });
}

const webhookWorker = new Worker(
  QUEUE_NAMES.WEBHOOKS,
  async (job) => {
    const { webhookEventId } = job.data as { webhookEventId: string };
    await processWebhookEvent(webhookEventId);
  },
  { connection, concurrency: 5 },
);

webhookWorker.on("failed", async (job, err) => {
  console.error("[webhooks] failed", job?.id, err);
  await recordFailure(QUEUE_NAMES.WEBHOOKS, err, job?.data);
  if (job?.data?.webhookEventId) {
    await prisma.webhookEvent.update({
      where: { id: job.data.webhookEventId },
      data: {
        status: job.attemptsMade >= (job.opts.attempts ?? 5) ? "DEAD" : "FAILED",
        lastError: err.message,
        attempts: job.attemptsMade,
      },
    });
  }
});

const emailWorker = new Worker(
  QUEUE_NAMES.EMAILS,
  async (job) => {
    await processEmailJob(job.data);
  },
  { connection, concurrency: 3 },
);

emailWorker.on("failed", async (job, err) => {
  console.error("[emails] failed", job?.id, err);
  await recordFailure(QUEUE_NAMES.EMAILS, err, job?.data, job?.data?.shopId);
});

const backfillWorker = new Worker(
  QUEUE_NAMES.BACKFILL,
  async (job) => {
    const { jobId } = job.data as { jobId: string };
    await runBackfillJob(jobId);
  },
  { connection, concurrency: 1 },
);

backfillWorker.on("failed", async (job, err) => {
  console.error("[backfill] failed", job?.id, err);
  await recordFailure(QUEUE_NAMES.BACKFILL, err, job?.data, undefined);
});

void new Queue(QUEUE_NAMES.WEBHOOKS, { connection });
void new Queue(QUEUE_NAMES.EMAILS, { connection });
void new Queue(QUEUE_NAMES.BACKFILL, { connection });

console.log("AfterSale worker started", {
  queues: Object.values(QUEUE_NAMES),
  redis: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
});

async function shutdown() {
  await Promise.all([webhookWorker.close(), emailWorker.close(), backfillWorker.close()]);
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
