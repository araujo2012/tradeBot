# Módulo `app/session`

Oferece um objeto `sessionService` para consultar e alterar sessões MongoDB e publicar comandos de start/stop/restart na fila RabbitMQ `socket`.

| Arquivo | Conteúdo |
|---|---|
| `session.service.ts` | sete operações privadas expostas pelo objeto `sessionService` |

Não há controller HTTP no projeto atual chamando esse serviço. Para uso interno, importe `sessionService`.

Detalhes: [`functions.md`](functions.md).


