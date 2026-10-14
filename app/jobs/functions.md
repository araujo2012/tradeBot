# `app/jobs/`

Resumo: definição e agendamento dos jobs periódicos do Agenda.

## Arquivos

### `index.ts`
- `startAgenda` — inicia o Agenda e agenda `CHECK_BUY_SELL` e `RUN_MANAGER_BOTS` a cada minuto (exportada)

### `managerJobs.ts`
Definições dos jobs do manager.
- `CHECK_BUY_SELL` — nome do job que confere ordens de compra/venda (exportada)
- `RUN_MANAGER_BOTS` — nome do job que roda os bots manager em lote (exportada)
- `processBotOrders` — separa ordens de compra/venda de um bot e trata inconsistências (interna)
