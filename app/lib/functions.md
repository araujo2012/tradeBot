# `app/lib/`

Resumo: clientes e conexões de infraestrutura. Sem regra de negócio: só criar/expor conexões e helpers de envio.

## Arquivos

### `agenda.ts`
- `agenda` — instância do Agenda (exportada)

### `bootstrap.ts`
- `bootstrap` — inicializa as dependências do processo (exportada)

### `bullMq.ts`
Fila e worker de ativação de bots.
- `activateBotQueue` — fila BullMQ de ativação (exportada)
- callback do `Worker` — executa o bot respeitando o lock in-flight (interna)
- `sendToActivateBotQueue` — enfileira uma ação de bot (exportada)

### `database.ts`
- `connectToDatabase` — conecta ao MongoDB (exportada)

### `pino.ts`
- `logger` — logger pino (exportada)

### `rabbit.ts`
- `connectToRabbitMQ` — abre conexão e canal RabbitMQ (exportada)
- `getRabbitChannel` — retorna o canal aberto (exportada)
- `logAndSendToQueue` — grava o payload em `RabbitData` e publica na fila (exportada)

### `redis.ts`
- `redis` — cliente ioredis (exportada)
