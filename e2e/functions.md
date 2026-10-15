# `e2e/`

Resumo: testes ponta a ponta. Sobem a aplicação real como processo filho contra uma Binance falsa (REST + WebSocket) e infraestrutura (Mongo, Redis, RabbitMQ) em Docker.

## Subpastas

| Pasta | Resumo |
|---|---|
| [`fake-binance/`](fake-binance/functions.md) | Binance falsa (REST + WebSocket) usada nos testes |
| [`app-runner/`](app-runner/functions.md) | sobe e controla a aplicação como processo filho |
| [`support/`](support/functions.md) | helpers compartilhados pelos testes (infra, fixture, execução do cenário) |

## Arquivos

### `run-e2e.js`
Script que orquestra a execução da suíte.
- `runNpm` — executa um comando npm síncrono e propaga o código de saída (interna)

### `setup-env.ts`
Define as variáveis de ambiente usadas pela suíte.

### `partial-fill-orders.e2e.test.ts`
Cenário de ordens parcialmente executadas.
- `isOrderMutation` — indica se um comando da Binance falsa altera ordens (interna)
- `readFinalState` — lê o estado final de ordens/bot no banco (interna)

### `immediate-fill-replace.e2e.test.ts`
Reposição (`order.cancelReplace`) que cruza o mercado e é executada na hora, de compra e de venda, com o `executionReport` chegando antes e depois da resposta do request: o `crypto` do bot deve bater com o executado na exchange e devem sobrar só uma compra e uma venda ativas.
- `filledOnExchange` — ordens executadas na Binance falsa (interna)
- `expectedCrypto` — `crypto` esperado a partir das execuções na exchange (interna)
- `deliveriesOf` — tipos das mensagens enviadas sobre uma ordem, na ordem de envio (interna)
- `readFinalState` — lê ordens ativas, ordens não liquidadas e o `crypto` do bot (interna)

### `binance-errors.e2e.test.ts`
Tratamento de erros retornados pela Binance: espera um registro de debug na coleção `debuger` quando um request é rejeitado.
