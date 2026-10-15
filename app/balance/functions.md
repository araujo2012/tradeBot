# `app/balance/`

Resumo: saldo da conta Binance usado pelos bots. O saldo livre em BRL fica no campo `brl` de cada bot da sessão (todos operam na mesma conta) e é conferido antes de enviar uma compra.

## Arquivos

### `balance.service.ts`
Conferência e atualização do saldo.
- `getOrderBrlCost` — BRL que a ordem bloqueia na Binance (`price * quantity` em compras; `0` em vendas) (exportada)
- `isInsufficientBalanceError` — indica se a resposta da Binance é a recusa `-2010` por saldo insuficiente (exportada)
- `getFreeBalance` — saldo livre de um ativo na lista do `account.status`; ativo ausente vale `0` (interna)
- `refreshAccountBalance` — consulta `account.status` e grava o saldo livre em BRL no `brl` dos bots da sessão (exportada)
- `hasBalanceForOrder` — confere o `brl` local; se não cobrir a ordem, atualiza pela Binance e confere de novo (falha na consulta conta como sem saldo) (exportada)
