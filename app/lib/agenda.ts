import Agenda from "agenda";

const mongoUri = process.env.MONGO_URI!;
if (!mongoUri) {
  throw new Error("MONGO_URI não definida");
}

export const agenda = new Agenda({
  db: {
    address: mongoUri,
    collection: "agendaJobs",
  },
  processEvery: "5 seconds",
});

agenda.on("start", (job) => {
  console.log(`[AGENDA] Job iniciado: ${job.attrs.name}`);
});

agenda.on("complete", (job) => {
  console.log(`[AGENDA] Job finalizado: ${job.attrs.name}`);
});

agenda.on("fail", (err, job) => {
  console.error(`[AGENDA] Job falhou: ${job?.attrs.name}`, err);
});
