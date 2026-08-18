# Funções de `app/limits`

## `calculateBollLimits`

Arquivo: [`app/limits/limits.service.ts`](limits.service.ts)

```ts
calculateBollLimits({
  symbol,
  interval,
  period,
  width,
}): Promise<LimitResult>
```

Busca `period` klines com `getKlines()`, transforma-os com `calculateKlineValue()`, calcula média e desvio padrão e retorna:

```text
upperLimit = mean + width * standardDeviation
lowerLimit = mean - width * standardDeviation
```

### Exemplo

```ts
const limits = await calculateBollLimits({
  symbol: "BTCBRL",
  interval: "1h",
  period: 21,
  width: 2.1,
});
```

### Falha ao obter klines

Retorna `success: false`, a mensagem recebida, `upperLimit: Infinity` e `lowerLimit: 0`. A função não lança a falha de consulta.

### Interface de retorno

```ts
interface LimitResult {
  success?: boolean;
  upperLimit: number;
  lowerLimit: number;
  message?: string;
}
```


