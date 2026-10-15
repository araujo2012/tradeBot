# `app/socket/`

Resumo: WebSocket API da Binance — conexões por sessão, requests assinados, tratamento de respostas/eventos e consumidor da fila `socket` do RabbitMQ.

## Arquivos

### `socket.consumer.ts`
Consumidor da fila `socket` (processa uma mensagem por vez).
- `handleStartSession` — abre o socket, faz logon e assina o user data stream (interna)
- `handleStopSession` — fecha a sessão e para os bots (interna)
- `handleCreateOrder` — envia `order.place` e salva o resultado (interna)
- `handleCancelOrder` — envia `order.cancel` (interna)
- `handleRestartSession` — reinicia a sessão (exportada)
- `handleReplaceOrder` — envia `order.cancelReplace`, registra a execução imediata da nova ordem a partir da resposta, com fallback para cancelamento (interna)
- `handleExecutedOrder` — despacha ordem executada conforme o modo (interna)
- `handleExecutedOrderManager` — atualiza `executedQtd`/status da ordem do manager (interna)
- `stopSessionBots` — para os bots ativos da sessão (interna)
- `processQueue` — processa a fila interna de mensagens (interna)
- `startSocketConsumer` — começa a consumir a fila `socket` (exportada)

### `socket.main.ts`
Conexões WebSocket por sessão, ping e reconexão (URL via `BINANCE_WS_URL`).
- `getBinanceSocket` — retorna o socket da sessão (exportada)
- `initializeBinanceSocket` — abre a conexão e registra listeners (exportada)
- `startPingMonitor` — monitora pings e derruba conexões mortas (exportada)
- `handleSocketFailure` — trata falha e agenda reconexão (interna)
- `getBackoffDelay` — calcula o atraso exponencial de reconexão (interna)

### `socket.requests.ts`
Requests assinados (Ed25519) para a WebSocket API.
- `signPayload` — assina os parâmetros ordenados (interna)
- `saveBinanceError` — grava na coleção `debuger` a operação e o erro quando a resposta não tem status `200` (interna)
- `getOrSetOffset` — offset de relógio com a Binance, em cache no Redis (interna)
- `socketOrderPlace` — `order.place` (exportada)
- `socketOrderReplace` — `order.cancelReplace` (exportada)
- `socketUserStream` — `userDataStream.subscribe` (exportada)
- `socketLogon` — `session.logon` (exportada)
- `socketOrderCancel` — `order.cancel` (exportada)
- `socketOrderStatus` — `order.status` (exportada)

### `socket.responses.ts`
Tratamento de respostas e eventos.
- `handlePlaceOrderResponse` — vincula `binanceId` e atualiza o status da ordem (exportada)
- `markOrderCanceled` — marca ordem cancelada como `partialExecuted` (se houve execução) ou `closed`, sem reabrir ordem fechada (exportada)
- `handleExecutionReport` — trata `executionReport` do user stream (exportada)
- `handleExecutionReportManager` — atualiza a ordem do manager e reenfileira o bot após `PARTIAL_FILL_GRACE_MS` em fills parciais (interna)
