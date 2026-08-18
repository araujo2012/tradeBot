# Funções de `app/jobs`

## `startAgenda`

Arquivo: [`app/jobs/index.ts`](index.ts)

Assinatura: `startAgenda(): Promise<void>`.

Inicia a instância Agenda e registra:

- `CHECK_BUY_SELL` (`checkBuyAndSellOrder`) a cada 1 minuto;
- `RUN_MANAGER_BOTS` (`runManagerBotsBatch`) a cada 1 minuto.

```ts
await startAgenda();
```

## `processBotOrders`

Privada em [`app/jobs/managerJobs.ts`](managerJobs.ts).

Assinatura: `processBotOrders({ bot, session }): Promise<void>`.

Busca ordens ativas de compra e venda de um bot, mantém no máximo uma de cada direção e publica `cancelOrder` para as excedentes. Se não houver cancelamento e faltar compra ou venda, publica `runManagerBot` na fila BullMQ.

O `session` precisa fornecer `apiKey`; o `bot` precisa fornecer `_id`, `sessionId` e `symbol`.

## Job `CHECK_BUY_SELL`

Nome: `checkBuyAndSellOrder`.

Callback registrado com concorrência `1` e lock de `50_000 ms`. Busca sessões ativas, depois bots ativos em modo manager dessas sessões, e chama `processBotOrders()` para cada par encontrado.

## Job `RUN_MANAGER_BOTS`

Nome: `runManagerBotsBatch`.

Callback registrado com concorrência `1` e lock de `2 * 60 * 1000 ms`. Busca bots manager ativos em sessões ativas e, para cada bot, publica `runManagerBot` quando `Math.random() <= 0.1`.


