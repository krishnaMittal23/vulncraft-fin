/**
 * Durable workflow execution via a BullMQ (Redis) queue. When REDIS_URL is set,
 * the execute endpoint enqueues a job and an in-process worker runs it — so
 * runs survive restarts, get bounded concurrency, and don't tie up the request.
 * When Redis is absent, callers fall back to running executeWorkflow in-process.
 */
const { Queue, Worker } = require("bullmq");
const { createRedis, redisEnabled } = require("./redis");

const QUEUE_NAME = "workflow-execution";
let queue = null;

function getWorkflowQueue() {
  if (!redisEnabled()) return null;
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: createRedis() });
  return queue;
}

async function enqueueWorkflow(workflowId, userId) {
  const q = getWorkflowQueue();
  if (!q) return null;
  return q.add(
    "run",
    { workflowId, userId },
    // Scans aren't safely idempotent to auto-retry, so attempts: 1.
    { attempts: 1, removeOnComplete: 100, removeOnFail: 100 }
  );
}

/**
 * Start the in-process worker. `io` is the live Socket.IO server so the worker
 * can stream progress to the same rooms the web layer serves.
 */
function startWorkflowWorker(io) {
  if (!redisEnabled()) return null;
  const { executeWorkflow } = require("../services/workflowExecutionServe");
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => executeWorkflow(job.data.workflowId, job.data.userId, io),
    {
      connection: createRedis(),
      concurrency: parseInt(process.env.WORKFLOW_CONCURRENCY || "3", 10),
    }
  );
  worker.on("failed", (job, err) => console.error(`[queue] job ${job?.id} failed:`, err.message));
  worker.on("completed", (job) => console.log(`[queue] job ${job?.id} completed`));
  worker.on("error", (err) => console.error("[queue] worker error:", err.message));
  console.log(`[queue] workflow worker started (concurrency ${worker.opts.concurrency})`);
  return worker;
}

module.exports = { QUEUE_NAME, getWorkflowQueue, enqueueWorkflow, startWorkflowWorker };
