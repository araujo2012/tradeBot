import { Queue, Worker } from "bullmq";
import { redis } from "./redis";
import { runManagerJob } from "app/bot/bot.jobs";

const ACTIVATE_BOT = "activate-bot";

export const activateBotQueue = new Queue(ACTIVATE_BOT, {
  connection: redis as any,
});

export const activateBotWorker = new Worker(
  ACTIVATE_BOT,
  async (job) => {
    if (job.name !== "activate-bot") return;
    const { botId } = job.data as { botId: string };
    const ok = await runManagerJob(botId);
    if (!ok) {
      throw new Error(`Bot ${botId} is inflight, retrying`);
    }
  },
  {
    connection: redis as any,
  }
);
