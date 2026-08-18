# Arquivos da raiz e configuração

## `main.ts`

Ponto de entrada executado por `npm run dev`. Contém uma IIFE assíncrona que encadeia as conexões e inicializações descritas em [`ARCHITECTURE.md`](ARCHITECTURE.md). Não exporta uma função reutilizável.

Uso:

```bash
npx ts-node-dev --respawn --transpile-only main.ts
```

O valor da porta é `process.env.PORT || 3001`.

## `app.ts`

Cria e exporta a instância Express. No carregamento:

- chama `dotenv.config()`;
- registra CORS com `origin: process.env.FRONTEND_URL`;
- registra `express.json()`.

Não há handlers `GET` ou `POST` registrados neste arquivo.

## `websocket.ts`

Mantém um `Map<string, WebSocket>` chamado `userSockets` e implementa o canal de comunicação com o cliente.

### `sendToUser(userId: string, data: any)`

Procura o socket do usuário e envia `JSON.stringify(data)` apenas se ele estiver aberto.

```ts
sendToUser(userId, {
  type: "session",
  status: "active",
  sessionId,
});
```

### `initializeWebSocketServer(server: http.Server)`

Cria um `WebSocketServer` no caminho `/ws`. O cliente deve conectar com `?token=<jwt>`; o payload precisa conter `userId`.

Comportamento de rejeição:

| Código | Motivo |
|---:|---|
| `4001` | token ausente |
| `4002` | token inválido |
| `4003` | usuário não identificado |

Ao conectar, o servidor envia `{ type: "connection", message: "WebSocket conectado com sucesso" }`. Ao fechar, remove o usuário do mapa.

## `package.json`

Scripts atuais:

| Script | Uso |
|---|---|
| `dev` | `ts-node-dev --respawn --transpile-only main.ts` |
| `build` | compila com `tsc` |
| `start` | executa `node dist/server.js` |
| `test` | executa Jest |

Há uma diferença a validar: o arquivo fonte encontrado é `main.ts`, mas o script `start` referencia `dist/server.js`. Com o `rootDir` e `outDir` atuais, o caminho esperado para `main.ts` seria `dist/main.js`.

## `tsconfig.json`

- `target`: ES2020;
- `module`: CommonJS;
- `rootDir`: `./`;
- `outDir`: `./dist`;
- `strict`: `true`;
- alias `@binance/*` para `app/binance/*`;
- inclui `app`, `models`, `scripts`, `types/**/*.d.ts` e `**/*.ts`.

## `docker-compose.yml`

Disponibiliza MongoDB na porta `27017`, RabbitMQ nas portas `5672` e `15672`, e Redis na porta `6379`. Os nomes de serviço são `mongo`, `rabbitmq` e `redis`.

## `jest.config.js`

Configura `ts-jest`, ambiente Node, raiz de testes em `app` e padrão `**/__tests__/**/*.test.ts`. Nenhum arquivo de teste apareceu na árvore inspecionada.

## Variáveis de ambiente observadas

| Variável | Consumidor | Obrigatória no fluxo |
|---|---|---|
| `PORT` | `main.ts` | não; usa `3001` |
| `FRONTEND_URL` | `app.ts` | usada na origem CORS |
| `JWT_SECRET` | `websocket.ts` | não; usa `segredo_super_secreto` |
| `MONGO_URI` | MongoDB, Agenda, bootstrap | sim |
| `RABBITMQ_URI` | RabbitMQ | sim |
| `REDIS_URI` | Redis e BullMQ | sim |

Além dessas variáveis, `socket.requests.ts` requer o arquivo local `scripts/private_key.pem` para criar a assinatura privada usada nas requisições Binance.

