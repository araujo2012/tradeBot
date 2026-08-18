# Funções de `app/socket`

## `socket.main.ts`

Arquivo-fonte: [`app/socket/socket.main.ts`](socket.main.ts)

### `getBinanceSocket`

```ts
getBinanceSocket(sessionId: string): WebSocket | null
```

Retorna o socket Binance armazenado para a sessão ou `null` quando não existe.

```ts
const socket = getBinanceSocket(sessionId);
```

### `initializeBinanceSocket`

```ts
initializeBinanceSocket(sessionId: string): Promise<void>
```

Abre `wss://ws-api.binance.com:443/ws-api/v3`. No evento `open`, salva o socket e o timestamp de ping. Os listeners fazem o seguinte:

- `ping`: atualiza `lastPingMap` e responde com `pong`;
- `close`: chama `handleSocketFailure(sessionId, "close")`;
- `error`: registra o erro;
- `message`: faz parse, persiste em `WebsocketDataModel` e encaminha respostas de criação de ordem ou eventos `executionReport`.

A Promise resolve no `open`; não rejeita explicitamente em erro de conexão.

```ts
await initializeBinanceSocket(sessionId);
```

### `startPingMonitor`

```ts
startPingMonitor(): void
```

É idempotente por `monitorStarted`. Cria um intervalo de 30 segundos e chama `handleSocketFailure()` quando o último ping de uma sessão tem mais de 90 segundos.

```ts
startPingMonitor();
```

### `handleSocketFailure`

Privada.

```ts
handleSocketFailure(sessionId: string, reason: string): Promise<void>
```

Ignora uma segunda falha enquanto a sessão já estiver em `reconnectingMap`. Caso contrário, marca a sessão como em reconexão, termina e remove o socket, remove o timestamp, calcula o atraso e agenda `reconnectUserSocket(sessionId)`. O conjunto é limpo no `finally` do timer.

### `getBackoffDelay`

Privada.

```ts
getBackoffDelay(sessionId: string): number
```

Incrementa o contador da sessão e retorna `min(30_000, 2 ** retry * 1000)`. Os atrasos são 1s, 2s, 4s, ... até 30s.

## `socket.requests.ts`

Arquivo-fonte: [`app/socket/socket.requests.ts`](socket.requests.ts)

Todos os requests abaixo:

1. obtêm ou inicializam o socket da sessão;
2. calculam o offset de horário Binance;
3. montam uma mensagem JSON com `id`, `method` e `params`;
4. registram a mensagem como `sended` em `WebsocketDataModel`;
5. aguardam a resposta com o mesmo `id`, usando timeout de 10 segundos;
6. removem o listener quando a resposta chega.

### `signPayload`

Privada.

```ts
signPayload(params: Record<string, string | number>): string
```

Ordena as chaves, monta `key=value&...`, assina o payload ASCII com a chave privada PKCS#8 carregada de `scripts/private_key.pem` e retorna Base64.

### `getOrSetOffset`

Privada.

```ts
getOrSetOffset(): Promise<number>
```

Lê `binance:offset` no Redis. Se não houver cache, consulta `/api/v3/time`, calcula `Date.now() - serverTime`, grava por uma hora e retorna o offset.

### `socketOrderPlace`

```ts
socketOrderPlace({
  order: OrderEntry & { apiKey: string; sessionId: string },
  clientId: string,
}): Promise<any>
```

Envia `order.place` com ordem LIMIT, `GTC`, `BUY`/`SELL`, preço, quantidade, símbolo, timestamp ajustado e assinatura.

```ts
const response = await socketOrderPlace({
  order: { ...order, apiKey, sessionId },
  clientId,
});
```

### `socketOrderReplace`

```ts
socketOrderReplace({
  order: OrderEntry & { sessionId: string },
  apiKey: string,
  binanceId: string,
  clientId: string,
}): Promise<any>
```

Envia `order.cancelReplace` com `STOP_ON_FAILURE`, `ONLY_NEW` e `cancelOrigClientOrderId` igual ao ID original.

### `socketUserStream`

```ts
socketUserStream(sessionId: string): Promise<any>
```

Exige socket aberto e envia `userDataStream.subscribe`. É usado depois de `socketLogon()` durante o start da sessão.

### `socketLogon`

```ts
socketLogon({ apiKey, sessionId }): Promise<any>
```

Garante o socket, assina `apiKey` e `timestamp` e envia `session.logon`. Se a resposta indicar erro de timestamp (`-1021` ou mensagem contendo `timestamp`), remove `binance:offset` do Redis para forçar recálculo na próxima chamada.

### `socketOrderCancel`

```ts
socketOrderCancel({
  apiKey,
  symbol,
  origClientOrderId,
  sessionId,
}): Promise<BinanceOrderResponse>
```

Envia `order.cancel` com a assinatura e o ID original do cliente.

### `socketOrderStatus`

```ts
socketOrderStatus({
  apiKey,
  origClientOrderId,
  symbol,
  sessionId,
}): Promise<BinanceOrderResponse>
```

Envia `order.status` e é usado por `startAdministrator()` e `startManager()` para sincronizar ordens ao iniciar uma sessão.

## `socket.responses.ts`

Arquivo-fonte: [`app/socket/socket.responses.ts`](socket.responses.ts)

### `handlePlaceOrderResponse`

```ts
handlePlaceOrderResponse(response: any): Promise<any>
```

Procura uma ordem por `clientId` ou `binanceId`, grava `clientOrderId` como `binanceId`, converte `pending -> active` para `NEW` e marca como `executed` para `FILLED` ou `PARTIALLY_FILLED`. Retorna a resposta recebida.

### `handleExecutionReport`

```ts
handleExecutionReport(response: any): Promise<void>
```

Extrai o evento de user stream, localiza a ordem pelo ID de cliente (ou ID de cancelamento para `CANCELED`) e encaminha pelo `mode`. Hoje apenas `manager` chama `handleExecutionReportManager()`.

### `handleExecutionReportManager`

Privada.

Atualiza ordens manager conforme `status` Binance:

- `NEW`: não faz nada;
- `CANCELED`: `executed` se já houve quantidade executada, caso contrário `closed`, e agenda `runManagerBot`;
- `PARTIALLY_FILLED`: grava quantidade, marca `executed`, espera 60 segundos e agenda o manager;
- `FILLED`: grava quantidade, marca `executed` e agenda o manager.

## `socket.consumer.ts`

Arquivo-fonte: [`app/socket/socket.consumer.ts`](socket.consumer.ts)

### `handleStartSession`

```ts
handleStartSession(sessionId: string): Promise<void>
```

Busca a sessão, valida `apiKey`, executa `socketLogon()` e `socketUserStream()`, marca a sessão como `active`, notifica o usuário pelo WebSocket externo e inicializa cada bot ativo com `startAdministrator()` ou `startManager()`.

Em erro, notifica `inactive` e relança a exceção para que `processQueue()` faça `nack`.

### `handleStopSession`

```ts
handleStopSession(sessionId: string, userId: string): Promise<void>
```

Procura um socket, fecha-o, valida que a sessão pertence ao usuário, marca a sessão como `inactive` e envia o evento de status ao usuário. Em erro, notifica `active` e relança.

O código atual chama `getBinanceSocket(userId)`, embora os sockets sejam armazenados por `sessionId`; validar essa chave é recomendado.

### `handleCreateOrder`

```ts
handleCreateOrder(order: OrderEntry, apiKey: string): Promise<void>
```

Busca `SymbolConfig` e bot, normaliza quantidade/preço, cria um `clientId`, persiste a ordem como `pending`, chama `socketOrderPlace()` e então:

- `NEW`: grava `active` e `binanceId`;
- outro status: grava o ID e chama `handleExecutedOrder()`.

Ao final decrementa o in-flight do bot. O código usa `crypto.randomUUID()`; não há import de `crypto` visível neste arquivo.

### `handleCancelOrder`

```ts
handleCancelOrder({ apiKey, origClientOrderId, symbol, sessionId }): Promise<void>
```

Chama `socketOrderCancel()`, procura a ordem pela resposta, marca `closed` ou processa execução parcial, decrementa o in-flight e agenda nova execução manager.

### `handleRestartSession`

```ts
handleRestartSession(sessionId: string): Promise<void>
```

Evita restart duplicado, marca a sessão `reconnecting`, notifica o usuário, para os bots, espera 1,5 segundos e chama `handleStartSession()`. Em falha, notifica `inactive`, salva esse status e sempre libera o lock local no `finally`.

### `handleReplaceOrder`

```ts
handleReplaceOrder(order, apiKey, binanceId): Promise<void>
```

Envia `socketOrderReplace()`. Se o cancelamento antigo for bem-sucedido, fecha a ordem anterior. Se a nova ordem for criada, persiste uma nova ordem ativa e processa eventual quantidade executada. Ao final decrementa o in-flight e agenda o manager.

Em erro, registra o contexto e tenta `handleCancelOrder()` como fallback.

### `handleExecutedOrder`

```ts
handleExecutedOrder(order: OrderDocument, result: any): Promise<void>
```

Despacha pelo modo da ordem. Hoje o modo `manager` chama `handleExecutedOrderManager()`; outros modos não têm tratamento.

### `handleExecutedOrderManager`

Privada.

Converte `result.executedQty`, mantém o maior valor em `order.executedQtd`, marca a ordem como `executed` e salva.

### `stopSessionBots`

Privada.

Busca bots ativos da sessão e chama `stopBotJob()` para cada um. Como `stopBotJob()` só remove timers existentes, o efeito atual é principalmente limpar eventuais timers registrados no mapa do módulo.

### `processQueue`

Privada.

Processa uma mensagem por vez a cada intervalo de `1000 / 5` ms. Faz parse do conteúdo, despacha pelo campo `action`, confirma com `channel.ack()` em sucesso e usa `channel.nack(msg, false, false)` em erro, removendo a mensagem sem requeue.

### `startSocketConsumer`

```ts
startSocketConsumer(): Promise<void>
```

Conecta ao RabbitMQ, garante a fila `socket`, define `prefetch(50)`, registra `channel.consume()` com `noAck: false`, coloca mensagens na fila local e inicia `setInterval(processQueue, 200)`.

```ts
await startSocketConsumer();
```


