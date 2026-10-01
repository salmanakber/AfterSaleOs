import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "@aftersale/shared";

let connection: IORedis | null = null;

export function getRedis(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: getRedis() });
    queues.set(name, q);
  }
  return q;
}

export async function enqueueWebhookProcessing(webhookEventId: string) {
  await getQueue(QUEUE_NAMES.WEBHOOKS).add(
    "process",
    { webhookEventId },
    {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
}

export async function enqueueEmail(payload: {
  shopId: string;
  to: string;
  template: string;
  data: Record<string, unknown>;
}) {
  await getQueue(QUEUE_NAMES.EMAILS).add("send", payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
  });
}

export async function enqueueBackfill(jobId: string) {
  await getQueue(QUEUE_NAMES.BACKFILL).add(
    "backfill",
    { jobId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}
