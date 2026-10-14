# `app/session/`

Resumo: operações sobre sessões de usuário; mudanças de estado são publicadas no RabbitMQ.

## Arquivos

### `session.service.ts`
- `sessionService` — objeto que expõe as funções abaixo (exportada)
- `getSessions` — lista as sessões do usuário (interna)
- `createSession` — cria uma sessão (interna)
- `updateSession` — atualiza dados de uma sessão (interna)
- `deleteSession` — remove uma sessão (interna)
- `startSession` — publica o início da sessão na fila (interna)
- `stopSession` — publica a parada da sessão na fila (interna)
- `reconnectUserSocket` — publica pedido de reconexão do socket (interna)
