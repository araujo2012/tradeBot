# Mapa da pasta `app`

`app` concentra a lógica de aplicação. A raiz do módulo é dividida por responsabilidade:

| Pasta | Papel | Documentação |
|---|---|---|
| `binance` | acesso a klines, estatísticas e tipos da Binance | [`README.md`](binance/README.md) |
| `bot` | serviços e estratégia do bot | [`README.md`](bot/README.md) |
| `limits` | cálculo estatístico de limites | [`README.md`](limits/README.md) |
| `order` | tipos, constantes e normalização de valores | [`README.md`](order/README.md) |
| `session` | CRUD de sessões e publicação de comandos | [`README.md`](session/README.md) |
| `socket` | conexão Binance, consumidor RabbitMQ e tratamento de respostas | [`README.md`](socket/README.md) |
| `lib` | infraestrutura compartilhada | [`README.md`](lib/README.md) |
| `jobs` | agendamento de rotinas periódicas | [`README.md`](jobs/README.md) |

## Dependências entre áreas

```text
lib ────────────────> bot, session, socket, jobs
binance ────────────> limits ───────────> bot
order ──────────────> bot e socket
models <──────────── bot, jobs, session, socket, lib
socket <──────────── bot, session, main.ts
```

Para o inventário função a função, consulte [`../FUNCTION-INDEX.md`](../FUNCTION-INDEX.md).

