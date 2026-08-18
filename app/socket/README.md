# Módulo `app/socket`

É o núcleo de comunicação com a Binance e de processamento assíncrono de sessões e ordens.

## Arquivos

| Arquivo | Papel |
|---|---|
| `socket.main.ts` | mantém sockets Binance por sessão, recebe eventos, registra mensagens e reconecta |
| `socket.requests.ts` | assina e envia comandos da Binance WebSocket API |
| `socket.responses.ts` | traduz respostas/eventos Binance para atualizações de ordens |
| `socket.consumer.ts` | consome RabbitMQ e executa ações de sessão/ordem |

## Ações RabbitMQ aceitas

| `action` | Handler |
|---|---|
| `startSession` | `handleStartSession` |
| `stopSession` | `handleStopSession` |
| `restartSession` | `handleRestartSession` |
| `createOrder` | `handleCreateOrder` |
| `cancelOrder` | `handleCancelOrder` |
| `replaceOrder` | `handleReplaceOrder` |

Mensagens desconhecidas são apenas registradas e confirmadas (`ack`).

## Chaves e estados em memória

- `socketMap`: `sessionId -> WebSocket` Binance.
- `lastPingMap`: `sessionId -> timestamp` do último ping.
- `reconnectingMap`: sessões com reconexão já agendada.
- `retryCountMap`: contador usado pelo backoff.
- `restartingSessions`: evita dois restarts simultâneos da mesma sessão.
- `queue`: mensagens RabbitMQ recebidas e ainda não processadas.
- `processing`: impede que o loop local processe duas mensagens ao mesmo tempo.

Detalhes função a função: [`functions.md`](functions.md).


