# Módulo `app/jobs`

Registra jobs periódicos do Agenda para manter ordens manager consistentes e iniciar rodadas ocasionais dos bots.

| Arquivo | Conteúdo |
|---|---|
| `index.ts` | `startAgenda`, que inicia o scheduler e agenda os dois jobs |
| `managerJobs.ts` | nomes, callbacks e helper de processamento de ordens |

Detalhes: [`functions.md`](functions.md).


