# `app/`

Resumo: código de domínio. Cada subpasta é um domínio, com arquivos separados por sufixo (`.service`, `.utils`, `.type`, `.constants`, `.jobs`). Não há arquivos diretos nesta pasta.

## Subpastas

| Pasta | Resumo |
|---|---|
| [`binance/`](binance/functions.md) | REST da Binance (klines), estatísticas, tipos e constantes |
| [`bot/`](bot/functions.md) | estratégia *manager*/*administrator*, locks de bot em Redis |
| [`jobs/`](jobs/functions.md) | jobs periódicos do Agenda |
| [`lib/`](lib/functions.md) | clientes de infraestrutura: Mongo, Redis, RabbitMQ, BullMQ, Agenda, logger |
| [`limits/`](limits/functions.md) | cálculo de limites de Bollinger |
| [`order/`](order/functions.md) | tipos, constantes e arredondamento de ordens |
| [`session/`](session/functions.md) | CRUD e ciclo de vida de sessões (via RabbitMQ) |
| [`socket/`](socket/functions.md) | WebSocket API da Binance: conexão, requests, respostas e consumidor da fila `socket` |

## Arquivos

Nenhum arquivo direto.
