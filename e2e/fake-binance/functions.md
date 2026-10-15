# `e2e/fake-binance/`

Resumo: Binance falsa (REST + WebSocket API) usada nos testes e2e. Não é importada pelo código de produção.

## Arquivos

### `fake-binance.ts`
- `FakeOrderInput` — dados para registrar uma ordem falsa (exportada)
- `FakeBinanceCommand` — comando recebido pela Binance falsa (exportada)
- `asNumber` — converte parâmetro recebido em número (interna)
- `asString` — formata número como string da API (interna)
- `isOpenOrder` — indica se a ordem ainda está aberta no livro (`NEW`/`PARTIALLY_FILLED`) (interna)
- `INSUFFICIENT_BALANCE_ERROR` — erro `-2010` que a Binance real devolve quando falta saldo (interna)
- `FakeBinance` — servidor que simula respostas e eventos `executionReport` (exportada)
  - `registerOrder` — registra uma ordem na exchange falsa
  - `setFreeBalance` — define o saldo livre de um ativo; com saldo de BRL definido, compras acima dele são recusadas com `-2010` (ordens aceitas não bloqueiam o saldo)
  - `getCommands` — comandos recebidos, na ordem de chegada
  - `getCommandSummary` — resumo dos comandos para o diagnóstico de falhas
  - `emitExecutionReport` — executa a ordem (parcial ou total) e avisa a aplicação pelo `executionReport`
  - `cancelOrderWithoutNotifying` — cancela a ordem na exchange sem avisar a aplicação (simula evento perdido)
  - `findOrder` — busca a ordem falsa ou lança erro (interna)
  - `hasBalanceFor` — indica se o saldo livre de BRL cobre a compra (interna)
  - `handleAccountStatus` — responde `account.status` só com os ativos com saldo (interna)
