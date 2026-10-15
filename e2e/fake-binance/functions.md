# `e2e/fake-binance/`

Resumo: Binance falsa (REST + WebSocket API) usada nos testes e2e. Não é importada pelo código de produção.

## Arquivos

### `fake-binance.ts`
- `FakeOrderInput` — dados para registrar uma ordem falsa (exportada)
- `FakeBinanceCommand` — comando recebido pela Binance falsa (exportada)
- `FillReportTiming` — se o `executionReport` de uma execução imediata chega antes ou depois da resposta (exportada)
- `FakeDelivery` — mensagem enviada à aplicação sobre uma ordem: `executionReport` ou resposta (exportada)
- `asNumber` — converte parâmetro recebido em número (interna)
- `asString` — formata número como string da API (interna)
- `isOpenOrder` — indica se a ordem ainda está aberta no livro (`NEW`/`PARTIALLY_FILLED`) (interna)
- `INSUFFICIENT_BALANCE_ERROR` — erro `-2010` que a Binance real devolve quando falta saldo (interna)
- `FakeBinance` — servidor que simula respostas e eventos `executionReport` (exportada)
  - `setMarketPrice` — define o preço de mercado; ordens novas que o cruzam são executadas na hora
  - `setFillReportTiming` — define a ordem e o intervalo entre `executionReport` e resposta em execuções imediatas
  - `setFreeBalance` — define o saldo livre de um ativo; com saldo de BRL definido, compras acima dele são recusadas com `-2010` (ordens aceitas não bloqueiam o saldo)
  - `getOrders` — cópia das ordens registradas na exchange falsa
  - `getDeliveries` — mensagens enviadas à aplicação, na ordem de envio
  - `cancelOrderWithoutNotifying` — cancela a ordem na exchange sem avisar a aplicação (simula evento perdido)
  - `findOrder` — busca a ordem falsa ou lança erro (interna)
  - `hasBalanceFor` — indica se o saldo livre de BRL cobre a compra (interna)
  - `crossesMarket` — indica se a ordem cruza o preço de mercado (interna)
  - `fillIfCrossesMarket` — executa a ordem por completo se ela cruzar o mercado (interna)
  - `handleAccountStatus` — responde `account.status` só com os ativos com saldo (interna)
  - `respondWithNewOrder` — responde a criação/reposição; em execução imediata entrega `executionReport` e resposta na ordem de `setFillReportTiming` (interna)
