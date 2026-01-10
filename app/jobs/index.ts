import { agenda } from "../lib/agenda";
import { CHECK_BUY_SELL, RUN_MANAGER_BOTS } from "./managerJobs";

export async function startAgenda() {
  await agenda.start();
  await agenda.every("1 minute", CHECK_BUY_SELL);
  await agenda.every("10 minutes", RUN_MANAGER_BOTS);
  console.log("[AGENDA] Scheduler iniciado");
}
