# `e2e/support/`

Resumo: helpers compartilhados pelos testes e2e — conexão e limpeza da infraestrutura, fixture do bot manager e execução da aplicação contra a Binance falsa ou o Spot Testnet.

## Arquivos

### `scenario.ts`
- `PARTIAL_FILL_GRACE_MS` — espera de fill parcial usada pela aplicação nos testes (exportada)
- `delay` — espera N ms (exportada)
- `waitFor` — repete uma verificação até passar ou estourar o tempo (exportada)
- `purgeRabbitQueues` — esvazia as filas do RabbitMQ (interna)
- `resetInfrastructure` — limpa Mongo, Redis e filas entre testes (interna)
- `useE2EInfrastructure` — registra os hooks do Jest que conectam e limpam a infraestrutura (exportada)
- `ScenarioFixture` — ids e quantidades do cenário (exportada)
- `BinanceConnection` — URLs e chave privada que a aplicação usa para falar com a Binance (exportada)
- `createScenarioSession` — cria a sessão ativa, com a apiKey informada, que a aplicação inicia ao subir (exportada)
- `createScenarioFixture` — cria a sessão do cenário com a Binance falsa (interna)
- `populateScenarioFixture` — cria bot, config do símbolo e ordens iniciais no banco e na Binance falsa (interna)
- `triggerManagerRun` — enfileira uma rodada do manager na fila `activate-bot` do BullMQ (exportada)
- `readRedisTtl` — TTL em segundos de uma chave do Redis da aplicação (exportada)
- `isCancellationOf` — indica se um comando cancela determinada ordem (exportada)
- `startApplication` — sobe a aplicação apontando para a Binance informada e espera a sessão ficar ativa (exportada)
- `withApplicationLogs` — erro do cenário com os logs da aplicação e detalhes extras (exportada)
- `runWithApplication` — sobe a aplicação contra a Binance falsa, executa o cenário e encerra (exportada)

### `testnet-scenario.ts`
- `TestnetScenario` — sessão do cenário e cliente do testnet (exportada)
- `runWithTestnet` — sobe a aplicação contra o Spot Testnet, executa o cenário e encerra, cancelando as ordens abertas do símbolo antes e depois (exportada)
