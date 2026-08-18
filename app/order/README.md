# Módulo `app/order`

Define o vocabulário mínimo das ordens e a normalização de preço/quantidade antes do envio à Binance.

| Arquivo | Conteúdo |
|---|---|
| `order.constants.ts` | `directionList` e `activeStatus` |
| `order.type.ts` | `OrderEntry` |
| `order.utils.ts` | `normalizeValue` |

`OrderModel` acrescenta campos persistidos como usuário, sessão, IDs Binance, status e quantidade executada. Consulte [`../../models/README.md`](../../models/README.md).

Detalhes: [`functions.md`](functions.md).


