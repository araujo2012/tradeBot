# Módulo `app/lib`

Agrupa os adaptadores de infraestrutura e a rotina de recuperação inicial.

| Arquivo | Papel |
|---|---|
| `database.ts` | conexão Mongoose |
| `rabbit.ts` | conexão, canal e publicação RabbitMQ |
| `redis.ts` | cliente Redis compartilhado |
| `bullMq.ts` | fila e worker `activate-bot` |
| `agenda.ts` | instância Agenda e listeners de observabilidade |
| `pino.ts` | logger Pino |
| `bootstrap.ts` | reativação de sessões existentes |

Detalhes: [`functions.md`](functions.md).


