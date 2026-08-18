# Funções de `app/lib`

## `connectToDatabase`

Arquivo: [`app/lib/database.ts`](database.ts)

Assinatura: `connectToDatabase(): Promise<void>`.

Lê `MONGO_URI`, chama `mongoose.connect()` e registra sucesso. Se a variável não existir ou a conexão falhar, registra o erro e encerra o processo com `process.exit(1)`.

```ts
await connectToDatabase();
```

## `connectToRabbitMQ`

Arquivo: [`app/lib/rabbit.ts`](rabbit.ts)

Assinatura: `connectToRabbitMQ(): Promise<amqp.Channel>`.

Conecta em `RABBITMQ_URI`, cria o canal, garante as filas duráveis `messages` e `socket`, armazena o canal no estado do módulo e o retorna.

```ts
const channel = await connectToRabbitMQ();
```

## `getRabbitChannel`

Assinatura: `getRabbitChannel(): amqp.Channel`.

Retorna o canal armazenado. Lança `RabbitMQ channel not initialized.` se `connectToRabbitMQ()` ainda não tiver sido concluída.

## `logAndSendToQueue`

Assinatura: `logAndSendToQueue(queue: string, payload: any): void`.

Serializa `payload`, publica uma mensagem persistente no RabbitMQ e cria um registro em `RabbitDataModel`.

```ts
logAndSendToQueue("socket", {
  action: "startSession",
  sessionId,
});
```

A gravação Mongo é iniciada sem `await`; o retorno da função não representa a conclusão dela.

## `sendToActivateBotQueue`

Arquivo: [`app/lib/bullMq.ts`](bullMq.ts)

Assinatura: `sendToActivateBotQueue({ action: string, botId: string }): Promise<void>`.

Adiciona um job na fila BullMQ `activate-bot`. O nome do job é `action`, o ID é `${action}-${botId}`, há até 5 tentativas, backoff exponencial de 5 segundos, remoção após sucesso e permanência após falha.

```ts
await sendToActivateBotQueue({
  action: "runManagerBot",
  botId: bot._id.toString(),
});
```

O worker reconhece somente o nome `runManagerBot` e chama `runManagerJob(botId)`; outros nomes geram erro.

## `bootstrap`

Arquivo: [`app/lib/bootstrap.ts`](bootstrap.ts)

Assinatura: `bootstrap(): Promise<void>`.

Busca sessões em `active` ou `reconnecting`, marca cada uma como `reconnecting`, salva e publica `startSession` com `sessionId` e `userId`. É executado pelo `main.ts` e também possui um guard `require.main === module` para execução direta.

## Exports de infraestrutura

- `redis`: cliente `ioredis` criado com `REDIS_URI`; registra eventos `connect` e `error`.
- `agenda`: instância Agenda ligada ao Mongo, coleção `agendaJobs`, `processEvery: "5 seconds"`; listeners registram início, conclusão e falha de jobs.
- `logger`: instância Pino com timestamp ISO customizado.


