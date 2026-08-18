# Índice completo de funções

Este índice inclui funções exportadas e funções privadas nomeadas. Funções anônimas usadas como callbacks de eventos, timers, Promises e jobs estão descritas nas páginas do módulo que as contém.

## Raiz

| Arquivo | Função | Visibilidade | Responsabilidade |
|---|---|---|---|
| [`websocket.ts`](websocket.ts) | `sendToUser(userId, data)` | exportada | envia JSON ao WebSocket associado ao usuário |
| [`websocket.ts`](websocket.ts) | `initializeWebSocketServer(server)` | exportada | cria o servidor `/ws`, valida JWT e registra conexões |
| [`main.ts`](main.ts) | rotina IIFE assíncrona | módulo | inicializa dependências, consumidores, jobs e servidor |

## `app/binance`

| Arquivo | Função | Visibilidade |
|---|---|---|
| [`binance.service.ts`](app/binance/binance.service.ts) | `getKlines(symbol, interval, limit)` | exportada |
| [`binance.stats.ts`](app/binance/binance.stats.ts) | `calculateAverage(values)` | exportada |
| [`binance.stats.ts`](app/binance/binance.stats.ts) | `calculateStandardDeviation(values)` | exportada |
| [`binance.stats.ts`](app/binance/binance.stats.ts) | `calculateKlineValue(klines)` | exportada |

## `app/bot`

| Arquivo | Função | Visibilidade |
|---|---|---|
| [`bot.jobs.ts`](app/bot/bot.jobs.ts) | `runManagerJob(botId)` | exportada |
| [`bot.jobs.ts`](app/bot/bot.jobs.ts) | `handleExecutedOrdersManager(args)` | privada |
| [`bot.jobs.ts`](app/bot/bot.jobs.ts) | `handleOperationManager(args)` | privada |
| [`bot.jobs.ts`](app/bot/bot.jobs.ts) | `setVarianceManager(args)` | privada |
| [`bot.jobs.ts`](app/bot/bot.jobs.ts) | `generateNewOrdersManager(args)` | privada |
| [`bot.jobs.ts`](app/bot/bot.jobs.ts) | `stopBotJob(botId)` | exportada |
| [`bot.service.ts`](app/bot/bot.service.ts) | `startAdministrator(bot, apiKey)` | exportada |
| [`bot.service.ts`](app/bot/bot.service.ts) | `startManager(bot, apiKey)` | exportada |
| [`bot.utils.ts`](app/bot/bot.utils.ts) | `normalizeBotId(botId)` | privada |
| [`bot.utils.ts`](app/bot/bot.utils.ts) | `handleRunManagerJobQueue(botId)` | exportada |
| [`bot.utils.ts`](app/bot/bot.utils.ts) | `incrementManagerInFlight(botId)` | exportada |
| [`bot.utils.ts`](app/bot/bot.utils.ts) | `decrementManagerInFlight(botId)` | exportada |
| [`bot.utils.ts`](app/bot/bot.utils.ts) | `getMinVarianceBot(minValue, money)` | exportada |

## `app/limits` e `app/order`

| Arquivo | Função | Visibilidade |
|---|---|---|
| [`limits.service.ts`](app/limits/limits.service.ts) | `calculateBollLimits(args)` | exportada |
| [`order.utils.ts`](app/order/order.utils.ts) | `normalizeValue(args)` | exportada |

## `app/session`

| Arquivo | Função | Visibilidade |
|---|---|---|
| [`session.service.ts`](app/session/session.service.ts) | `getSessions(userId)` | privada, exposta em `sessionService` |
| [`session.service.ts`](app/session/session.service.ts) | `createSession(userId, sessionData)` | privada, exposta em `sessionService` |
| [`session.service.ts`](app/session/session.service.ts) | `updateSession(sessionId, userId, updateData)` | privada, exposta em `sessionService` |
| [`session.service.ts`](app/session/session.service.ts) | `deleteSession(sessionId, userId)` | privada, exposta em `sessionService` |
| [`session.service.ts`](app/session/session.service.ts) | `startSession(sessionId)` | privada, exposta em `sessionService` |
| [`session.service.ts`](app/session/session.service.ts) | `stopSession(sessionId, userId)` | privada, exposta em `sessionService` |
| [`session.service.ts`](app/session/session.service.ts) | `reconnectUserSocket(sessionId)` | privada, exposta em `sessionService` |

## `app/socket`

| Arquivo | Função | Visibilidade |
|---|---|---|
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `handleStartSession(sessionId)` | privada |
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `handleStopSession(sessionId, userId)` | privada |
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `handleCreateOrder(order, apiKey)` | privada |
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `handleCancelOrder(args)` | privada |
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `handleRestartSession(sessionId)` | exportada |
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `handleReplaceOrder(order, apiKey, binanceId)` | privada |
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `handleExecutedOrder(order, result)` | privada |
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `handleExecutedOrderManager(order, result)` | privada |
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `stopSessionBots(sessionId)` | privada |
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `processQueue()` | privada |
| [`socket.consumer.ts`](app/socket/socket.consumer.ts) | `startSocketConsumer()` | exportada |
| [`socket.main.ts`](app/socket/socket.main.ts) | `getBinanceSocket(sessionId)` | exportada |
| [`socket.main.ts`](app/socket/socket.main.ts) | `initializeBinanceSocket(sessionId)` | exportada |
| [`socket.main.ts`](app/socket/socket.main.ts) | `startPingMonitor()` | exportada |
| [`socket.main.ts`](app/socket/socket.main.ts) | `handleSocketFailure(sessionId, reason)` | privada |
| [`socket.main.ts`](app/socket/socket.main.ts) | `getBackoffDelay(sessionId)` | privada |
| [`socket.requests.ts`](app/socket/socket.requests.ts) | `signPayload(params)` | privada |
| [`socket.requests.ts`](app/socket/socket.requests.ts) | `getOrSetOffset()` | privada |
| [`socket.requests.ts`](app/socket/socket.requests.ts) | `socketOrderPlace(args)` | exportada |
| [`socket.requests.ts`](app/socket/socket.requests.ts) | `socketOrderReplace(args)` | exportada |
| [`socket.requests.ts`](app/socket/socket.requests.ts) | `socketUserStream(sessionId)` | exportada |
| [`socket.requests.ts`](app/socket/socket.requests.ts) | `socketLogon(args)` | exportada |
| [`socket.requests.ts`](app/socket/socket.requests.ts) | `socketOrderCancel(args)` | exportada |
| [`socket.requests.ts`](app/socket/socket.requests.ts) | `socketOrderStatus(args)` | exportada |
| [`socket.responses.ts`](app/socket/socket.responses.ts) | `handlePlaceOrderResponse(response)` | exportada |
| [`socket.responses.ts`](app/socket/socket.responses.ts) | `handleExecutionReport(response)` | exportada |
| [`socket.responses.ts`](app/socket/socket.responses.ts) | `handleExecutionReportManager(args)` | privada |

## `app/lib` e `app/jobs`

| Arquivo | Função | Visibilidade |
|---|---|---|
| [`bootstrap.ts`](app/lib/bootstrap.ts) | `bootstrap()` | exportada |
| [`bullMq.ts`](app/lib/bullMq.ts) | callback do `Worker` | privada/anônima |
| [`bullMq.ts`](app/lib/bullMq.ts) | `sendToActivateBotQueue(args)` | exportada |
| [`database.ts`](app/lib/database.ts) | `connectToDatabase()` | exportada |
| [`rabbit.ts`](app/lib/rabbit.ts) | `connectToRabbitMQ()` | exportada |
| [`rabbit.ts`](app/lib/rabbit.ts) | `getRabbitChannel()` | exportada |
| [`rabbit.ts`](app/lib/rabbit.ts) | `logAndSendToQueue(queue, payload)` | exportada |
| [`jobs/index.ts`](app/jobs/index.ts) | `startAgenda()` | exportada |
| [`jobs/managerJobs.ts`](app/jobs/managerJobs.ts) | `processBotOrders(args)` | privada |
| [`jobs/managerJobs.ts`](app/jobs/managerJobs.ts) | callback do job `CHECK_BUY_SELL` | anônima |
| [`jobs/managerJobs.ts`](app/jobs/managerJobs.ts) | callback do job `RUN_MANAGER_BOTS` | anônima |

## Funções de callback relevantes

Além das funções nomeadas, o projeto usa callbacks em:

- listeners `open`, `ping`, `close`, `error` e `message` de `ws`;
- listeners `start`, `complete` e `fail` do Agenda;
- timers de `setInterval`, `setTimeout` e timeouts de resposta Binance;
- `channel.consume()` do RabbitMQ;
- `new Worker()` do BullMQ;
- filtros, mapas e `forEach` que transformam ordens e klines.

Esses callbacks estão explicados junto ao arquivo correspondente, pois não podem ser importados ou chamados diretamente.


