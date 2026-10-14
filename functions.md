# `/` (raiz)

Resumo: pontos de entrada do processo (servidor HTTP, WebSocket de clientes) e configuração. A lógica de negócio fica em `app/`, os schemas em `models/` e os testes ponta a ponta em `e2e/`. Convenção destes índices: [DOCS-CONVENTION.md](DOCS-CONVENTION.md). Achados de duplicação: [DOCS-FINDINGS.md](DOCS-FINDINGS.md).

## Subpastas

| Pasta | Resumo |
|---|---|
| [`app/`](app/functions.md) | domínio do bot: Binance, bots, ordens, sessões, sockets, filas e jobs |
| [`models/`](models/functions.md) | schemas e models Mongoose |
| [`e2e/`](e2e/functions.md) | testes e2e com Binance falsa e infraestrutura em Docker |
| [`tools/`](tools/functions.md) | scripts de manutenção do repositório |

## Arquivos

### `main.ts`
Ponto de entrada (`npm run dev` / `npm start`).
- IIFE assíncrona — conecta banco/Redis/Rabbit, inicia consumidores, Agenda e o servidor HTTP + WebSocket (interna)

### `app.ts`
Configuração do Express (CORS, JSON).
- `app` (default) — instância do Express (exportada)

### `websocket.ts`
WebSocket `/ws` para clientes autenticados por JWT.
- `sendToUser` — envia JSON ao socket do usuário (exportada)
- `initializeWebSocketServer` — cria o servidor `/ws`, valida o token e registra conexões (exportada)

### `jest.config.js`
- `default` — configuração do Jest para testes unitários (exportada)

### `jest.e2e.config.js`
- `default` — configuração do Jest para a suíte `e2e/` (exportada)
