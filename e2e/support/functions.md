# `e2e/support/`

Resumo: utilitários dos testes e2e (dublês e controle de processo). Não é importado pelo código de produção.

## Arquivos

### `app-process.ts`
Controle do processo da aplicação em teste.
- `delay` — espera N ms (interna)
- `getFreePort` — obtém uma porta TCP livre (exportada)
- `createTestPrivateKey` — gera uma chave Ed25519 temporária para assinar requests (exportada)
- `ApplicationProcess` — sobe/derruba a aplicação como processo filho e captura logs (exportada)

### `fake-binance.ts`
Binance falsa (REST + WebSocket API).
- `FakeOrderInput` — dados para registrar uma ordem falsa (exportada)
- `FakeBinanceCommand` — comando recebido pela Binance falsa (exportada)
- `asNumber` — converte parâmetro recebido em número (interna)
- `asString` — formata número como string da API (interna)
- `FakeBinance` — servidor que simula respostas e eventos `executionReport` (exportada)
