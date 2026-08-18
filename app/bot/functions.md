# Funções de `app/bot`

## `startAdministrator`

Arquivo: [`app/bot/bot.service.ts`](bot.service.ts)

```ts
startAdministrator(bot: BotDocument, apiKey: string): Promise<void>
```

Busca as ordens ativas do bot, consulta cada uma com `socketOrderStatus()` e atualiza `executedQtd` e `status` localmente quando o retorno Binance mostra execução. Em qualquer erro, marca o bot como `error` e grava o documento.

É chamado por `handleStartSession()` para bots ativos com `mode === "administrator"`.

## `startManager`

```ts
startManager(bot: BotDocument, apiKey: string): Promise<void>
```

Tem a mesma sincronização inicial do administrador, mas, quando o valor executado não aumentou, publica `runManagerBot` na fila BullMQ. Ao final também publica uma execução do manager.

```ts
await startManager(bot, session.apiKey);
```

Os resultados são processados com `results.forEach(async ...)`; o `forEach` não aguarda as Promises internas. O chamador pode recuperar o controle antes de todas as gravações de ordens terminarem.

## `runManagerJob`

Arquivo: [`app/bot/bot.jobs.ts`](bot.jobs.ts)

```ts
runManagerJob(botId: string): Promise<boolean | undefined>
```

É o núcleo da estratégia manager.

### Sequência atual

1. Tenta adquirir o lock Redis com `handleRunManagerJobQueue()`.
2. Carrega bot, sessão ativa e ordens nos estados `active`, `executed` ou `partialExecuted`.
3. Chama `handleExecutedOrdersManager()` para fechar execuções completas ou publicar cancelamento de execução parcial.
4. Atualiza `bot.crypto` pela variação executada.
5. Busca `SymbolConfig` e calcula a variância com `setVarianceManager()`.
6. Gera as ordens de compra e venda com `generateNewOrdersManager()`.
7. Compara cada direção com uma ordem ativa usando `handleOperationManager()`; publica criação ou substituição quando necessário.
8. No `finally`, decrementa o in-flight e retorna `true` quando o lock foi adquirido.

Se o lock já estiver ocupado, retorna `false` imediatamente. Se bot, sessão, configuração ou execução não forem elegíveis, o retorno efetivo dentro do caminho protegido é `true` por causa do `finally`.

```ts
const accepted = await runManagerJob(botId);
// false significa que outra execução está em andamento
```

## `handleExecutedOrdersManager`

Privada em `bot.jobs.ts`.

```ts
handleExecutedOrdersManager({ bot, orders, session })
  : Promise<{ stopRun: boolean; cryptoDelta: number }>
```

Filtra ordens com `executedQtd > 0`. Para ordens completamente executadas ou já marcadas como `partialExecuted`, soma/subtrai a quantidade da posição e fecha a ordem. Para uma execução incompleta, incrementa o in-flight, publica `cancelOrder` em RabbitMQ e interrompe a rodada com `stopRun: true`.

O payload publicado contém `apiKey`, `origClientOrderId`, `symbol` e `sessionId`.

## `handleOperationManager`

Privada.

```ts
handleOperationManager({ botId, direction, newOrder, symbol, apiKey, qtdDecimal })
```

Procura uma ordem ativa para a direção. Sem ordem, incrementa o in-flight e publica `createOrder`. Com ordem existente, calcula a diferença absoluta de quantidade e a diferença percentual de preço.

Publica `replaceOrder` quando `qtyDiff > qtdDecimal` ou quando a diferença percentual de preço é maior que `0.001` (0,1%). Caso contrário, não faz nada.

## `setVarianceManager`

Privada.

```ts
setVarianceManager({ symbolConfig, symbol, target }): Promise<number>
```

Calcula uma variância mínima baseada em `minValue / target` e em quatro taxas de `0,1%`, depois calcula limites de Bollinger para `symbol`, intervalo `1h`, período `21` e largura `2.1`. Retorna o maior valor entre a variância mínima e `(upperLimit - lowerLimit) / (upperLimit + lowerLimit)`.

É chamada por `runManagerJob()`.

## `generateNewOrdersManager`

Privada.

```ts
generateNewOrdersManager({ variance, target, crypto, symbolConfig })
  : { sellOrder; buyOrder }
```

Gera as duas pontas do manager:

```text
moneyDif  = variance * target
sellPrice = (target + moneyDif) / crypto
buyPrice  = (target - moneyDif) / crypto
```

Quantidades e preços são normalizados pelos decimais configurados. A venda arredonda preço para cima; a compra arredonda preço para baixo. Se o valor mínimo da ordem ficar abaixo de `symbolConfig.minValue`, a quantidade é recalculada arredondando para cima.

O resultado tem este formato:

```ts
{
  sellOrder: { direction: "sell", quantity: number, price: number },
  buyOrder:  { direction: "buy",  quantity: number, price: number }
}
```

Não há proteção explícita contra `crypto === 0`, `target === 0` ou denominador inválido.

## `stopBotJob`

```ts
stopBotJob(botId: string): void
```

Procura um timer em `botIntervals`, cancela com `clearInterval()` e remove a entrada. No estado atual, nenhum timer é criado por `runManagerJob`; a função permanece disponível para o consumidor de sessões durante restart/stop.

```ts
stopBotJob(bot._id.toString());
```

## `normalizeBotId`

Privada em `bot.utils.ts`. Converte uma string, `Types.ObjectId` ou outro valor para string. É usada para montar chaves Redis estáveis.

## `handleRunManagerJobQueue`

```ts
handleRunManagerJobQueue(botId: string): Promise<boolean>
```

Tenta criar `bot:inflight:<botId>` com `SET NX`. Retorna `true` quando adquire o lock e `false` quando a chave já existe.

```ts
if (!(await handleRunManagerJobQueue(botId))) return false;
```

Não define TTL na chave por conta própria.

## `incrementManagerInFlight`

```ts
incrementManagerInFlight(botId: string): Promise<void>
```

Executa `INCR bot:inflight:<botId>` e registra o contador. É chamado antes de publicar operações assíncronas de ordem.

## `decrementManagerInFlight`

```ts
decrementManagerInFlight(botId: string): Promise<void>
```

Executa `DECR` na mesma chave e remove-a quando o resultado é menor ou igual a zero.

## `getMinVarianceBot`

```ts
getMinVarianceBot(minValue: number, money: number): Promise<number>
```

Retorna `Math.max(minValue / money, 0.004)`, pois `aboveTax` é calculado como `0.001 * 4`. Apesar de ser `async`, não contém `await`.

## Tipos

- `modeType`: união `"administrator" | "manager"`.
- `modeEnum`: array usado pelo Mongoose.
- `BotType`: nome, referências de usuário/sessão, símbolo, status, modo, valores financeiros e timestamps.


