# Funções de `app/session`

Arquivo: [`app/session/session.service.ts`](session.service.ts)

As funções são declaradas como privadas no módulo e expostas por:

```ts
import { sessionService } from "./app/session/session.service";
```

## `sessionService.getSessions`

Assinatura atual: `getSessions(userId: string): Promise<unknown[]>`.

Busca sessões pelo `userId` e seleciona `-apiKey -apiSecret`. O schema atual possui `apiKey`, mas não declara `apiSecret`; o select é mantido como está no código.

```ts
const sessions = await sessionService.getSessions(userId);
```

## `sessionService.createSession`

Assinatura atual: `createSession(userId: string, sessionData: any): Promise<unknown>`.

Cria uma sessão com `{ ...sessionData, userId }` usando `SessionModel.create()`.

```ts
await sessionService.createSession(userId, {
  apiKey,
  name: "Conta principal",
});
```

`sessionData` é `any`; a validação efetiva vem do schema Mongoose.

## `sessionService.updateSession`

Assinatura atual: `updateSession(sessionId: string, userId: string, updateData: any): Promise<unknown>`.

Atualiza somente os campos `name` e `limit`, sempre filtrando pelo par `_id + userId`. Retorna o documento novo. Lança `Error("Session not found")` se não encontrar uma sessão autorizada.

```ts
await sessionService.updateSession(sessionId, userId, {
  name: "Conta nova",
  limit: 1000,
  apiKey: "ignorada",
});
```

No exemplo, `apiKey` é descartada por não estar na lista de campos permitidos.

## `sessionService.deleteSession`

Assinatura atual: `deleteSession(sessionId: string, userId: string): Promise<unknown>`.

Exclui a sessão somente quando `_id` e `userId` coincidem. Lança `Session not found` caso contrário.

## `sessionService.startSession`

Assinatura atual: `startSession(sessionId: string): Promise<{ message: string }>`.

Publica em RabbitMQ:

```json
{
  "action": "startSession",
  "sessionId": "..."
}
```

Retorna `{ message: "Session start request sent to queue" }`.

## `sessionService.stopSession`

Assinatura atual: `stopSession(sessionId: string, userId: string): Promise<{ message: string }>`.

Publica `stopSession` com `sessionId` e `userId` e retorna uma mensagem de confirmação de enfileiramento.

## `sessionService.reconnectUserSocket`

Assinatura atual: `reconnectUserSocket(sessionId: string): Promise<void>`.

Busca a sessão, marca-a como `reconnecting`, salva e publica `{ action: "restartSession", sessionId }`. Se a sessão não existe, apenas registra um aviso e retorna.


