# Pasta `models`

Contém os schemas Mongoose e os models usados pela aplicação. Não há funções nomeadas exportadas nesta pasta; os exports são models e tipos.

| Arquivo | Model | Uso principal |
|---|---|---|
| `bot.ts` | `BotModel` | configuração e estado de bots |
| `debuger.ts` | `DebugerModel` | erros retornados pela Binance, com a operação enviada |
| `order.ts` | `OrderModel` | ordens locais e vínculo com Binance |
| `rabbitData.ts` | `RabbitDataModel` | histórico de mensagens RabbitMQ |
| `session.ts` | `SessionModel` | credenciais e estado de sessões |
| `symbolConfig.ts` | `SymbolConfigModel` | casas decimais e valor mínimo por símbolo |
| `websocketData.ts` | `WebsocketDataModel` | histórico de mensagens Binance WebSocket |

Detalhes dos campos, enums e relacionamentos: [`schemas.md`](schemas.md).


