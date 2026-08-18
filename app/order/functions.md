# Funções de `app/order`

## `normalizeValue`

Arquivo: [`app/order/order.utils.ts`](order.utils.ts)

```ts
normalizeValue({
  value: number,
  decimal: number,
  isRoundUp: boolean,
}): number
```

Multiplica por `10 ** decimal`, usa `Math.ceil()` quando `isRoundUp` é `true` e `Math.floor()` quando é `false`, e divide novamente pelo mesmo fator.

```ts
normalizeValue({ value: 10.129, decimal: 2, isRoundUp: false }); // 10.12
normalizeValue({ value: 10.121, decimal: 2, isRoundUp: true });  // 10.13
```

É usada para arredondar preço e quantidade em `handleCreateOrder()`, gerar preços/quantidades no manager e corrigir quantidade quando o valor mínimo da ordem não é atingido.

Não valida número negativo, `decimal` negativo, `NaN` ou `Infinity`.

## Constantes e tipos

- `directionList`: `['buy', 'sell']`.
- `activeStatus`: `['active', 'executed', 'partialExecuted']`.
- `OrderEntry`: `botId`, `mode`, `direction`, `price`, `quantity`, `symbol` e `position` opcional (`1 | 2 | 3`).


