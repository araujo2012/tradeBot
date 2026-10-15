# Schemas e models

## `BotModel` — `models/bot.ts`

### Tipo `BotType`

Campos principais:

| Campo | Tipo/valores | Obrigatório/default |
|---|---|---|
| `name` | `string` | sim |
| `sessionId` | ObjectId, ref `Session` | sim |
| `userId` | ObjectId, ref `User` | sim |
| `symbol` | `BTCBRL`, `ETHBRL`, `USDTBRL`, `BNBBRL`, `SOLBRL`, `XRPBRL` | sim |
| `status` | `active`, `inactive`, `archive`, `pending`, `error` | default `inactive` |
| `limit` | number | sim, default `0` |
| `mode` | `administrator`, `manager` | sim |
| `target` | number | sim, default `0` |
| `brl` | number — saldo livre em BRL da conta Binance da sessão, atualizado por `app/balance` | sim, default `0` |
| `crypto` | number | sim, default `0` |
| `lastExecutionTime` | Date | opcional |

O schema tem timestamps. `BotDocument` é `HydratedDocument<BotType>`.

## `OrderModel` — `models/order.ts`

### `OrderType`

| Campo | Tipo/valores |
|---|---|
| `userId`, `botId`, `sessionId` | ObjectId com refs `User`, `Bot`, `Session` |
| `mode` | `administrator` ou `manager` |
| `symbol` | string |
| `price`, `quantity`, `value` | number, default `0` |
| `direction` | valor de `directionList`: `buy` ou `sell` |
| `binanceId`, `clientId` | string, default vazio |
| `executedQtd` | number, default `0` |
| `status` | `active`, `executed`, `partialExecuted`, `closed`, `pending`; default `closed` |
| `position` | number opcional |

O schema possui timestamps. `OrderDocument` é `HydratedDocument<OrderType>`.

## `SessionModel` — `models/session.ts`

| Campo | Tipo/valores |
|---|---|
| `userId` | ObjectId, ref `User`, obrigatório |
| `listenKey` | string opcional |
| `apiKey` | string obrigatório |
| `status` | `active`, `inactive`, `reconnecting`; default `inactive` |
| `name` | string opcional |
| `limit` | number opcional |

Possui timestamps.

## `SymbolConfigModel` — `models/symbolConfig.ts`

| Campo | Tipo |
|---|---|
| `symbol` | String obrigatório |
| `priceDecimal` | number obrigatório |
| `qtdDecimal` | number obrigatório |
| `minValue` | number obrigatório |

O tipo `SymbolConfigType` usa `String` (objeto wrapper) para `symbol`; o schema usa `String` do Mongoose. O schema não configura timestamps.

## `RabbitDataModel` — `models/rabbitData.ts`

| Campo | Tipo |
|---|---|
| `queue` | string |
| `payload` | objeto livre |

Possui timestamps. É preenchido por `logAndSendToQueue()`.

## `WebsocketDataModel` — `models/websocketData.ts`

| Campo | Tipo |
|---|---|
| `sessionId` | string |
| `type` | string, atualmente `sended` ou `received` |
| `payload` | objeto livre |

Possui timestamps. É preenchido pelas requisições e pelo listener de mensagens em `socket.main.ts`.

## `DebugerModel` — `models/debuger.ts`

Coleção `debuger`.

| Campo | Tipo |
|---|---|
| `sessionId` | string |
| `method` | string, método da WebSocket API (ex.: `order.cancel`) |
| `requestId` | string, `id` do request enviado |
| `params` | objeto livre, parâmetros enviados sem `apiKey` e `signature` |
| `status` | number, status da resposta (ex.: `400`) |
| `error` | objeto livre, `{ code, msg }` retornado pela Binance |

Possui timestamps. É preenchido por `saveBinanceError()` em `socket.requests.ts` quando a resposta não tem status `200`.

## Relacionamentos observados

```text
User ──< Session ──< Bot ──< Order
                         └── SymbolConfig (por symbol, sem ref)

Session ──< WebsocketData
Session ──< Debuger
RabbitData é independente e registra a fila/payload.
```

Os models `User` e outros possíveis refs não estão presentes na árvore atual; os refs são apenas nomes usados pelo Mongoose.


