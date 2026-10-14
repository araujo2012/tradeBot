# `models/`

Resumo: schemas e models Mongoose (um arquivo por coleção) e os tipos `Document` correspondentes.

## Arquivos

### `bot.ts`
- `BotDocument` — documento hidratado de bot (exportada)
- `BotModel` — model `Bot` (exportada)

### `debuger.ts`
- `DebugerModel` — model `Debuger` (coleção `debuger`): erros retornados pela Binance com a operação enviada (exportada)

### `order.ts`
- `OrderType` — formato da ordem (exportada)
- `OrderDocument` — documento hidratado de ordem (exportada)
- `OrderModel` — model `Order` (exportada)

### `rabbitData.ts`
- `RabbitDataModel` — log das mensagens publicadas no RabbitMQ (exportada)

### `session.ts`
- `SessionModel` — model `Session` (usuário, apiKey, listenKey, status) (exportada)

### `symbolConfig.ts`
- `SymbolConfigType` — configuração de precisão por símbolo (exportada)
- `SymbolConfigDocument` — documento hidratado (exportada)
- `SymbolConfigModel` — model `SymbolConfig` (exportada)

### `websocketData.ts`
- `WebsocketDataModel` — log das mensagens trocadas com a Binance (exportada)
