# `e2e/fake-binance/`

Resumo: Binance falsa (REST + WebSocket API) usada nos testes e2e. Não é importada pelo código de produção.

## Arquivos

### `fake-binance.ts`
- `FakeOrderInput` — dados para registrar uma ordem falsa (exportada)
- `FakeBinanceCommand` — comando recebido pela Binance falsa (exportada)
- `asNumber` — converte parâmetro recebido em número (interna)
- `asString` — formata número como string da API (interna)
- `FakeBinance` — servidor que simula respostas e eventos `executionReport` (exportada)
