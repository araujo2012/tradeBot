# `app/bot/`

Resumo: execução dos bots (modos *manager* e *administrator*), tipos do bot e controle de concorrência em Redis.

## Arquivos

### `bot.jobs.ts`
Ciclo de execução do bot *manager*.
- `runManagerJob` — executa uma rodada do manager: trata ordens executadas, calcula limites e gera novas ordens (exportada)
- `handleExecutedOrdersManager` — fecha ordens executadas e calcula o delta de cripto; cancela ordens parciais (interna)
- `handleOperationManager` — decide e envia as operações de compra/venda (interna)
- `setVarianceManager` — ajusta a variância mínima do bot (interna)
- `generateNewOrdersManager` — monta as novas ordens a partir dos limites (interna)
- `stopBotJob` — para o job de um bot (exportada)

### `bot.service.ts`
Inicialização dos bots por modo.
- `startAdministrator` — consulta na Binance o status das ordens ativas do bot (exportada)
- `startManager` — dispara o bot manager pela fila de ativação (exportada)

### `bot.type.ts`
Tipos do bot.
- `modeType` — união dos modos de bot (exportada)
- `modeEnum` — lista dos modos, usada no schema (exportada)
- `BotType` — formato do documento de bot (exportada)

### `bot.utils.ts`
Locks/contadores "in flight" por bot em Redis.
- `normalizeBotId` — converte `ObjectId`/string em string (interna)
- `handleRunManagerJobQueue` — tenta adquirir o lock `bot:inflight:<id>` (exportada)
- `incrementManagerInFlight` — incrementa o contador in-flight (exportada)
- `decrementManagerInFlight` — decrementa e remove o lock ao zerar (exportada)
- `getMinVarianceBot` — calcula a variância mínima considerando taxas (exportada)
