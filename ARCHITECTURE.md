# Arquitetura atual

## Visão de camadas

```text
Cliente HTTP/WebSocket
        │
        ├── app.ts ─────────────── Express, CORS e JSON
        └── websocket.ts ───────── /ws, JWT e notificações ao usuário

main.ts (bootstrap do processo)
        │
        ├── MongoDB ────────────── models/*
        ├── RabbitMQ ───────────── app/lib/rabbit.ts
        │                             └── fila socket
        ├── Redis ───────────────── app/lib/redis.ts
        │                             ├── cache de klines/offset
        │                             └── locks de bots
        ├── consumidor socket ───── app/socket/socket.consumer.ts
        ├── monitor Binance ─────── app/socket/socket.main.ts
        ├── Agenda ──────────────── app/jobs/*
        └── servidor HTTP + /ws

Binance REST ─── app/binance/binance.service.ts
Binance WS API ─ app/socket/socket.main.ts + socket.requests.ts
BullMQ ───────── app/lib/bullMq.ts ──> app/bot/bot.jobs.ts
```

## Inicialização

O fluxo executado pelo `main.ts` é, na ordem:

1. `connectToRabbitMQ()` abre o canal AMQP e garante as filas `messages` e `socket`.
2. `connectToDatabase()` conecta ao MongoDB.
3. `startSocketConsumer()` começa a consumir a fila `socket`.
4. `startPingMonitor()` ativa o monitor de ping dos sockets Binance.
5. `bootstrap()` busca sessões `active` ou `reconnecting`, marca-as como `reconnecting` e publica uma ação `startSession`.
6. `startAgenda()` inicia o scheduler e registra os dois jobs periódicos.
7. O servidor HTTP é criado com `app` e recebe o WebSocket externo em `/ws`.
8. O processo começa a escutar em `PORT` ou `3001`.

`main.ts` conecta ao RabbitMQ antes de chamar `startSocketConsumer()`, e o próprio consumidor chama `connectToRabbitMQ()` novamente. Portanto, o fluxo atual abre/obtém mais de uma conexão/canal RabbitMQ; isso deve ser considerado caso a intenção seja compartilhar um único canal.

Se uma etapa anterior do bloco principal falhar, o processo registra o erro e encerra com `process.exit(1)`. O `bootstrap()` possui tratamento próprio: registra o erro e também encerra o processo.

## Fluxo de sessão

```text
sessionService.startSession(sessionId)
        │
        └── RabbitMQ: { action: "startSession", sessionId }
                     │
                     ▼
          startSocketConsumer() / processQueue()
                     │
                     ▼
          handleStartSession(sessionId)
                     │
        ├── socketLogon() ─────── session.logon assinado
        ├── socketUserStream() ── userDataStream.subscribe
        ├── Session.status = active
        └── inicializa cada bot ativo da sessão
              ├── startAdministrator()
              └── startManager()
```

Quando o socket Binance fecha ou fica sem ping por mais de 90 segundos, `handleSocketFailure()` remove o socket dos mapas, calcula um backoff exponencial de até 30 segundos e chama `reconnectUserSocket()`. Essa função publica `restartSession`, que passa pelo consumidor novamente.

## Fluxo de ordens do modo manager

```text
Agenda / evento de execução
        │
        └── sendToActivateBotQueue({ action: "runManagerBot", botId })
                     │
                     ▼
               Worker BullMQ
                     │
                     └── runManagerJob(botId)
                           ├── lock Redis bot:inflight:<id>
                           ├── fecha execuções pendentes
                           ├── calcula variância e limites de Bollinger
                           ├── gera buyOrder e sellOrder
                           └── publica createOrder/replaceOrder em RabbitMQ
                                      │
                                      ▼
                            consumidor da fila socket
                                      │
                       socketOrderPlace/Replace/Cancel
                                      │
                                      ▼
                              Binance WebSocket API
                                      │
                 socket.main recebe mensagens e grava WebsocketData
                                      │
                 socket.responses atualiza OrderModel e reativa o bot
```

O job `CHECK_BUY_SELL` também cancela ordens duplicadas de compra/venda e dispara novamente o manager quando falta uma das duas pontas. O job `RUN_MANAGER_BOTS` escolhe aleatoriamente cerca de 10% dos bots ativos a cada execução para enfileirar uma rodada.

## Integrações e responsabilidades

| Integração | Onde é configurada | Uso atual |
|---|---|---|
| MongoDB/Mongoose | `app/lib/database.ts`, `models/*`, Agenda | sessões, bots, ordens, configurações e logs de mensagens |
| RabbitMQ | `app/lib/rabbit.ts` | comandos de sessão e ordens na fila `socket` |
| Redis | `app/lib/redis.ts` | cache de klines, offset de horário Binance e locks/in-flight de bots |
| BullMQ | `app/lib/bullMq.ts` | fila `activate-bot` para executar `runManagerJob` |
| Agenda | `app/lib/agenda.ts`, `app/jobs/*` | jobs periódicos de verificação e ativação de managers |
| Binance REST | `app/binance/binance.service.ts`, `socket.requests.ts` | klines e horário do servidor |
| Binance WebSocket API | `app/socket/*` | logon, stream de usuário, criação, cancelamento, substituição e status de ordens |
| WebSocket do cliente | `websocket.ts` | autenticação JWT e eventos de status de sessão |

## Persistência

As mensagens publicadas em RabbitMQ são copiadas para `RabbitDataModel`. Mensagens enviadas e recebidas pela conexão Binance são copiadas para `WebsocketDataModel`. Isso cria um histórico operacional, mas as chamadas de `create()` não são aguardadas em todos os pontos; falhas de persistência podem não impedir o fluxo principal.

## Estados principais

### Sessão

`inactive` → `reconnecting` → `active`.

Uma falha durante o start notifica o usuário como `inactive`; uma falha de socket inicia o fluxo de reconexão.

### Ordem

Os valores aceitos pelo schema são `pending`, `active`, `executed`, `partialExecuted` e `closed`. O código de resposta Binance transforma estados externos como `NEW`, `FILLED`, `PARTIALLY_FILLED` e `CANCELED` nesses estados internos.

### Bot

O schema aceita `active`, `inactive`, `archive`, `pending` e `error`, e os modos `administrator` e `manager`. Apenas bots ativos em modo manager entram nos jobs de geração automática de ordens.

## Interfaces expostas atualmente

Implementado diretamente no código:

- `GET`/upgrade WebSocket em `/ws`, com token JWT na query string.
- Funções de serviço e filas que podem ser chamadas por outros módulos.

Não há registro de `/health` ou de `/api/socket/*` em `app.ts` no estado atual, embora essas rotas estejam descritas no README da raiz. Antes de tratá-las como API disponível, é necessário implementar ou conectar os handlers correspondentes.

## Pontos de atenção identificados por inspeção estática

- `package.json` usa `node dist/server.js` em `start`, mas o ponto de entrada fonte encontrado é `main.ts`; com o `tsconfig` atual, o build tende a produzir `dist/main.js`.
- `main.ts` e `startSocketConsumer()` chamam `connectToRabbitMQ()` em momentos distintos, o que pode deixar conexões/canais duplicados.
- `socket.consumer.ts` chama `crypto.randomUUID()` sem importar `crypto` no arquivo.
- `socket.requests.ts` carrega uma chave privada em `scripts/private_key.pem`, mas essa pasta não está presente na árvore inspecionada e está ignorada pelo Git.
- `handleStopSession()` procura o socket Binance usando `userId`, enquanto o mapa de sockets é indexado por `sessionId` em `socket.main.ts`; isso deve ser validado antes de depender do encerramento remoto.
- Não foi possível executar `npm run build` neste ambiente porque o comando `npm` não está disponível; a revisão final desta documentação foi feita por inspeção dos arquivos.


