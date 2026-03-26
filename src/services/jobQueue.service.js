const jobHandlers = new Map();
const pendingJobs = [];

let started = false;
let processing = false;
let sequence = 0;

const scheduleProcessing = () => {
  if (!started || processing || !pendingJobs.length) {
    return;
  }

  queueMicrotask(processNextJob);
};

const requeueWithBackoff = (job) => {
  setTimeout(() => {
    pendingJobs.push(job);
    scheduleProcessing();
  }, job.backoffMs);
};

async function processNextJob() {
  if (!started || processing || !pendingJobs.length) {
    return;
  }

  processing = true;
  const job = pendingJobs.shift();

  try {
    const handler = jobHandlers.get(job.type);
    if (!handler) {
      throw new Error(`No job handler registered for ${job.type}`);
    }

    await handler(job.payload, job);
  } catch (error) {
    if (job.attempt < job.maxAttempts) {
      requeueWithBackoff({
        ...job,
        attempt: job.attempt + 1,
        backoffMs: job.backoffMs * 2
      });
    } else {
      console.error(`Job ${job.type} failed permanently`, error);
    }
  } finally {
    processing = false;
    scheduleProcessing();
  }
}

export const registerJobHandler = (type, handler) => {
  jobHandlers.set(type, handler);
};

export const enqueueJob = (type, payload, options = {}) => {
  const job = {
    id: `${type}-${Date.now()}-${++sequence}`,
    type,
    payload,
    attempt: 1,
    maxAttempts: Number(options.maxAttempts) || 3,
    backoffMs: Number(options.backoffMs) || 1000,
    createdAt: new Date()
  };

  pendingJobs.push(job);
  scheduleProcessing();

  return job.id;
};

export const startJobQueue = () => {
  started = true;
  scheduleProcessing();
};
