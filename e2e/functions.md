# `e2e/`

Resumo: testes ponta a ponta. Sobem a aplicação real como processo filho contra uma Binance falsa (REST + WebSocket) e infraestrutura (Mongo, Redis, RabbitMQ) em Docker.

## Subpastas

| Pasta | Resumo |
|---|---|
| [`fake-binance/`](fake-binance/functions.md) | Binance falsa (REST + WebSocket) usada nos testes |
| [`app-runner/`](app-runner/functions.md) | sobe e controla a aplicação como processo filho |

## Arquivos

### `run-e2e.js`
Script que orquestra a execução da suíte.
- `runNpm` — executa um comando npm síncrono e propaga o código de saída (interna)

### `setup-env.ts`
Define as variáveis de ambiente usadas pela suíte.

### `partial-fill-orders.e2e.test.ts`
Cenário de ordens parcialmente executadas.
- `delay` — espera N ms (interna)
- `waitFor` — repete uma verificação até passar ou estourar o tempo (interna)
- `purgeRabbitQueues` — esvazia as filas do RabbitMQ (interna)
- `resetInfrastructure` — limpa Mongo, Redis e filas entre testes (interna)
- `createScenarioFixture` — cria usuário/sessão/bot do cenário (interna)
- `populateScenarioFixture` — cria as ordens iniciais do cenário (interna)
- `isOrderMutation` — indica se um comando da Binance falsa altera ordens (interna)
- `isCancellationOf` — indica se um comando cancela determinada ordem (interna)
- `readFinalState` — lê o estado final de ordens/bot no banco (interna)
- `runWithApplication` — sobe a aplicação, executa o teste e encerra (interna)
