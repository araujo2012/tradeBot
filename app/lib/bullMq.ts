import { Queue, Worker } from "bullmq";
import { runManagerJob } from "../bot/bot.jobs";
import Redis from "ioredis";

const ACTIVATE_BOT = "activate-bot";

const bullRedis = new Redis(process.env.REDIS_URI!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const activateBotQueue = new Queue(ACTIVATE_BOT, {
  connection: bullRedis as any,
});

new Worker(
  ACTIVATE_BOT,
  async (job: any) => {
    const { botId } = job.data as { botId: string; action: string };
    switch (job.name) {
      case "runManagerBot":
        const ok = await runManagerJob(botId);
        if (!ok) {
          throw new Error(`Bot ${botId} is inflight, retrying`);
        }
        break;
      default:
        throw new Error(`Unknown job action: ${job.name}`);
    }
  },
  {
    connection: bullRedis as any,
  }
);

export async function sendToActivateBotQueue({
  action,
  botId,
}: {
  action: string;
  botId: string;
}) {
  const normalizedBotId = botId.toString();
  await activateBotQueue.add(
    action,
    {
      botId: normalizedBotId,
    },
    {
      jobId: `${action}-${normalizedBotId}`,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5_000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}
