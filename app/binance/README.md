# Módulo `app/binance`

Responsável pelas constantes e tipos da Binance, pela leitura de klines via REST e pelos cálculos estatísticos usados pelos limites do bot.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `binance.constants.ts` | URL base, intervalos, símbolos e limites de consulta |
| `binance.interface.ts` | `Kline`, `KlinesResponse`, `RateLimit`, `OrderStatus`, `OrderResult` e `BinanceOrderResponse` |
| `binance.service.ts` | função `getKlines` e cache Redis |
| `binance.stats.ts` | média, desvio padrão e transformação de klines |

## Dependências e consumidores

`binance.service.ts` usa Axios e Redis. `limits.service.ts` consome `getKlines` e as três funções de `binance.stats.ts`. As requisições autenticadas de ordens ficam em [`../socket/README.md`](../socket/README.md), não neste módulo.

Detalhes de cada função: [`functions.md`](functions.md).


