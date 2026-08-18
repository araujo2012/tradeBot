# Módulo `app/bot`

Concentra os serviços de inicialização dos modos de bot, a estratégia do modo `manager`, o controle de execução concorrente em Redis e os tipos de bot.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `bot.type.ts` | `modeType`, `modeEnum` e `BotType` |
| `bot.service.ts` | sincronização inicial dos bots administrador e manager com a Binance |
| `bot.jobs.ts` | execução do manager, geração/substituição de ordens e parada de job |
| `bot.utils.ts` | lock/in-flight em Redis e variância mínima |

## Modos

- `administrator`: ao iniciar a sessão, consulta o status das ordens existentes e atualiza quantidades executadas.
- `manager`: ao iniciar a sessão, consulta ordens existentes e agenda uma nova execução; depois calcula limites, gera ordens de compra/venda e as publica na fila.

Detalhes função a função: [`functions.md`](functions.md).


