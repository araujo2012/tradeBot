# Funções de `app/binance`

## `getKlines`

Arquivo: [`app/binance/binance.service.ts`](binance.service.ts)

```ts
getKlines(
  symbol: string,
  interval: string,
  limit: number
): Promise<KlinesResponse>
```

Busca klines da Binance e retorna os dados em ordem invertida, limitados ao número solicitado.

### Como funciona

1. Verifica se `interval` está em `VALID_INTERVALS`.
2. Verifica se `symbol.toUpperCase()` está em `VALID_SYMBOLS`.
3. Limita `limit` ao máximo `MAX_LIMIT` (`500`).
4. Procura `klines:${symbol}:${interval}` no Redis.
5. Se houver cache, faz `reverse().slice(0, limit)` e retorna.
6. Sem cache, consulta `GET https://api.binance.com/api/v3/klines` com `limit: 40`, grava o resultado por 60 segundos e retorna os dados invertidos.
7. Em erro, retorna `erro: true` e a mensagem serializada.

### Exemplo

```ts
const result = await getKlines("BTCBRL", "1h", 21);

if (!result.erro) {
  const candles = result.data ?? [];
}
```

### Retornos de validação

```ts
{ erro: true, message: "Intervalo inválido: ..." }
{ erro: true, message: "Symbol inválido: ..." }
```

### Observações de uso

- O símbolo é normalizado apenas para validação; a chave de cache e a requisição usam a string original recebida.
- O limite máximo é aplicado, mas não há validação explícita para limite negativo ou não numérico.
- O retorno usa `erro` (português) em vez de lançar exceção para falhas HTTP.

## `calculateAverage`

Arquivo: [`app/binance/binance.stats.ts`](binance.stats.ts)

```ts
calculateAverage(values: (number | null)[]): number
```

Remove valores `null`, calcula a média aritmética dos restantes e retorna `0` quando não há valores válidos.

```ts
calculateAverage([1, null, 3]); // 2
calculateAverage([null]);       // 0
```

## `calculateStandardDeviation`

```ts
calculateStandardDeviation(values: (number | null)[]): number
```

Remove `null`, chama `calculateAverage()` e calcula o desvio padrão populacional. Retorna `0` para uma lista sem números.

```ts
calculateStandardDeviation([1, 2, 3]);
```

## `calculateKlineValue`

```ts
calculateKlineValue(klines: Kline[]): (number | null)[]
```

Para cada kline, converte duas posições da tupla para número e retorna `volume / close`. Se o valor usado como `close` ou `volume` for `0`, retorna `null` naquela posição.

```ts
const values = calculateKlineValue(klines);
const mean = calculateAverage(values);
```

### Atenção sobre os índices atuais

A interface `Kline` declara `close` na posição `4`, `volume` na posição `5` e `quoteAssetVolume` na posição `7`. A implementação atual lê `kline[5]` como `close` e `kline[7]` como `volume`. A documentação registra esse comportamento literal; confirme a intenção da métrica antes de alterar a estratégia.

## Constantes e tipos usados pelas funções

- `BASE_URL`: `https://api.binance.com/api/v3/`.
- `VALID_INTERVALS`: `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`.
- `VALID_SYMBOLS`: `BTCBRL`, `ETHBRL`, `USDTBRL`, `XRPBRL`, `SOLBRL`, `BNBBRL`.
- `MAX_LIMIT`: `500`.
- `FIXED_FETCH_LIMIT`: `40`.
- `KlinesResponse`: `{ erro, data?, message? }`.


