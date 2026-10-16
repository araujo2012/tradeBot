# `e2e/`

Resumo: testes ponta a ponta. Sobem a aplicação real como processo filho com infraestrutura (Mongo, Redis, RabbitMQ) em Docker, contra uma Binance falsa (REST + WebSocket) ou, nos arquivos `*.testnet.e2e.test.ts`, contra o Spot Testnet da Binance.

## Subpastas

| Pasta | Resumo |
|---|---|
| [`fake-binance/`](fake-binance/functions.md) | Binance falsa (REST + WebSocket) usada nos testes |
| [`binance-testnet/`](binance-testnet/functions.md) | cliente REST do Spot Testnet usado para preparar e conferir os cenários |
| [`app-runner/`](app-runner/functions.md) | sobe e controla a aplicação como processo filho |
| [`support/`](support/functions.md) | helpers compartilhados pelos testes (infra, fixture, execução do cenário) |

## Arquivos

### `run-e2e.js`
Script que orquestra a execução da suíte.
- `runNpm` — executa um comando npm síncrono e propaga o código de saída (interna)

### `setup-env.ts`
Carrega o `.env.e2e` (se existir) e define os valores padrão das variáveis de ambiente usadas pela suíte.

### `partial-fill-orders.e2e.test.ts`
Cenário de ordens parcialmente executadas.
- `isOrderMutation` — indica se um comando da Binance falsa altera ordens (interna)
- `readFinalState` — lê o estado final de ordens/bot no banco (interna)

### `immediate-fill-replace.testnet.e2e.test.ts`
Contra o Spot Testnet: o bot tem uma compra e uma venda a 10% do mercado (criadas direto na Binance) e o manager as repõe com preços em que uma delas, de compra ou de venda, cruza o livro e é executada na hora. Confere a resposta do `order.cancelReplace` e o `executionReport`, que o banco espelha as ordens da Binance (status, preço e quantidades), que o `crypto` do bot recebe a execução uma vez e quantas requests a aplicação enviou.
- `minOrderValue` — valor das ordens do bot: o dobro do mínimo da Binance (interna)
- `placeOldOrder` — cria na Binance uma ordem antiga com o valor mínimo do bot (interna)
- `placeOldOrders` — cria a compra e a venda antigas a 10% do mercado (interna)
- `toBotOrder` — converte a ordem da Binance em ordem ativa do bot no banco (interna)
- `createBot` — grava config do símbolo, ordens antigas e o bot com o centro que faz uma reposição cruzar o livro (interna)
- `readBotState` — lê `crypto`, ordens por liquidar, direções ativas e o lock in-flight do bot (interna)
- `waitForSettledBot` — espera o manager contabilizar a execução e ficar sem mensagens pendentes (interna)
- `readSentRequests` — requests enviadas pela aplicação, com a sessão do socket (interna)
- `countByMethod` — conta as requests por método (interna)
- `readReplaceReplyFor` — resposta do `order.cancelReplace` que criou uma ordem (interna)
- `readExecutionReports` — `executionReport`s recebidos sobre uma ordem (interna)
- `fromExchange` — ordem da Binance no formato comparável ao do banco (interna)
- `readComparableDbOrders` — ordens do bot no banco no formato comparável (interna)
- `byBinanceId` — ordena ordens pelo `binanceId` (interna)

### `insufficient-balance.e2e.test.ts`
Compra do manager sem saldo: a recusa `-2010` da Binance atualiza o `brl` do bot com o saldo da conta; com `brl` local abaixo do custo, a aplicação consulta `account.status` antes de enviar e só envia se a conta tiver saldo. Sem saldo na conta, o bot fica travado por 10 minutos (não roda nem consulta a Binance) até uma ordem dele ser executada.
- `fillOldBuy` — executa a compra antiga para o manager criar uma compra nova (interna)
- `setLocalBrl` — define o `brl` do bot no banco (interna)
- `readBotBrl` — lê o `brl` do bot (interna)
- `commandsOf` — comandos recebidos pela Binance falsa de um método (interna)
- `readBuyOrders` — ordens de compra criadas no cenário (interna)
- `readLockTtl` — TTL do lock de saldo do bot no Redis (interna)
- `readReplacementSell` — venda reposta pelo manager no lugar da antiga (interna)
- `runOutOfBalance` — deixa o bot sem saldo local nem na conta e espera ele ser travado (interna)
- `expectLockedForTenMinutes` — confere que o TTL do lock é de cerca de 10 minutos (interna)

### `binance-errors.e2e.test.ts`
Tratamento de erros retornados pela Binance: espera um registro de debug na coleção `debuger` quando um request é rejeitado.
