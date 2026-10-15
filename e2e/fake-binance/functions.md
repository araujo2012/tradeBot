# `e2e/fake-binance/`

Resumo: Binance falsa (REST + WebSocket API) usada nos testes e2e. Não é importada pelo código de produção.

## Arquivos

### `fake-binance.ts`
- `FakeOrderInput` — dados para registrar uma ordem falsa (exportada)
- `FakeBinanceCommand` — comando recebido pela Binance falsa (exportada)
- `asNumber` — converte parâmetro recebido em número (interna)
- `asString` — formata número como string da API (interna)
- `isOpenOrder` — indica se a ordem ainda está aberta no livro (`NEW`/`PARTIALLY_FILLED`) (interna)
- `FakeBinance` — servidor que simula respostas e eventos `executionReport` (exportada)
  - `setMarketPrice` — define o preço de mercado; ordens novas que o cruzam são executadas na hora
  - `getOrders` — cópia das ordens registradas na exchange falsa
  - `cancelOrderWithoutNotifying` — cancela a ordem na exchange sem avisar a aplicação (simula evento perdido)
  - `findOrder` — busca a ordem falsa ou lança erro (interna)
  - `crossesMarket` — indica se a ordem cruza o preço de mercado (interna)
  - `fillIfCrossesMarket` — executa a ordem por completo se ela cruzar o mercado (interna)
  - `respondWithNewOrder` — responde a criação/reposição; em execução imediata envia o `executionReport` antes da resposta (interna)
