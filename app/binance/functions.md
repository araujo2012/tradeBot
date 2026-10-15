# `app/binance/`

Resumo: integração REST com a Binance e cálculos sobre klines. Tipos e constantes da API ficam aqui.

## Arquivos

### `binance.constants.ts`
Constantes da API REST.
- `BASE_URL` — URL base da API v3 (sobrescrevível por `BINANCE_REST_URL`) (exportada)
- `VALID_INTERVALS` — intervalos de kline aceitos (exportada)
- `VALID_SYMBOLS` — símbolos aceitos (exportada)
- `MAX_LIMIT` — limite máximo de klines por request (exportada)
- `FIXED_FETCH_LIMIT` — quantidade padrão de klines buscadas (exportada)
- `NEW_ORDER_REJECTED_CODE` — código `-2010` de ordem nova recusada (exportada)
- `INSUFFICIENT_BALANCE_MESSAGE` — trecho da mensagem que identifica a recusa por saldo insuficiente (exportada)

### `binance.interface.ts`
Tipos de resposta da Binance.
- `Kline` — tupla de uma vela (exportada)
- `KlinesResponse` — resposta de klines (exportada)
- `RateLimit` — limites de requisição informados pela API (exportada)
- `OrderStatus` — enum de status de ordem da Binance (exportada)
- `OrderResult` — resultado de ordem (exportada)
- `BinanceOrderResponse` — envelope de resposta de ordem via WebSocket (exportada)
- `BinanceError` — erro `{ code, msg }` devolvido pela Binance (exportada)
- `AccountBalance` — saldo de um ativo (`free`/`locked`) (exportada)
- `BinanceAccountResponse` — envelope de resposta do `account.status` (exportada)

### `binance.service.ts`
Chamadas REST.
- `getKlines` — busca klines de um símbolo/intervalo (exportada)

### `binance.stats.ts`
Funções puras de estatística.
- `calculateAverage` — média ignorando `null` (exportada)
- `calculateStandardDeviation` — desvio padrão (exportada)
- `calculateKlineValue` — extrai de cada kline o valor usado nos cálculos (exportada)
