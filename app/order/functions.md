# `app/order/`

Resumo: tipos, constantes e utilitários puros de ordens.

## Arquivos

### `order.constants.ts`
- `directionList` — direções possíveis (`buy`, `sell`) (exportada)
- `activeStatus` — status considerados ativos (exportada)

### `order.type.ts`
- `OrderEntry` — dados de entrada para criar uma ordem (exportada)

### `order.utils.ts`
- `normalizeValue` — arredonda preço/quantidade conforme a precisão do símbolo (exportada)
