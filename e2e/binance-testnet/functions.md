# `e2e/binance-testnet/`

Resumo: cliente REST do [Spot Testnet da Binance](https://testnet.binance.vision) usado pelos testes `*.testnet.e2e.test.ts` para preparar e conferir os cenários (ler o mercado, criar ordens, listar o que a exchange registrou). A aplicação fala com o testnet pela WebSocket API dela. Não é importado pelo código de produção.

## Arquivos

### `testnet-client.ts`
- `TESTNET_REST_URL` — URL base da API REST v3 do testnet (exportada)
- `TESTNET_WS_URL` — URL da WebSocket API do testnet, usada pela aplicação nos testes (exportada)
- `TestnetCredentials` — API key Ed25519 e caminho da chave privada (exportada)
- `SymbolRules` — precisão de preço/quantidade e valor mínimo do símbolo, no formato do `SymbolConfig` (exportada)
- `BookTicker` — melhor compra (`bid`) e melhor venda (`ask`) do livro (exportada)
- `OrderSide` — lado da ordem na Binance (`BUY`/`SELL`) (exportada)
- `TestnetOrder` — ordem como a Binance devolve em `POST /order` e `GET /allOrders` (exportada)
- `LimitOrderInput` — dados de uma ordem LIMIT GTC (exportada)
- `TestnetRequestError` — erro devolvido pela Binance, com o corpo da resposta (exportada)
- `readTestnetCredentials` — lê `BINANCE_TESTNET_API_KEY` e `BINANCE_TESTNET_PRIVATE_KEY_PATH`; sem a API key, falha dizendo o que configurar (exportada)
- `decimalsOf` — casas decimais de um passo da Binance (`tickSize`/`stepSize`) (interna)
- `findFilter` — filtro do símbolo pelo tipo (interna)
- `toQuery` — monta a query string a partir dos parâmetros (interna)
- `TestnetClient` — cliente REST assinado com Ed25519 (exportada)
  - `getSymbolRules` — regras do símbolo a partir do `exchangeInfo`
  - `getBookTicker` — melhor compra e melhor venda do livro
  - `placeLimitOrder` — cria uma ordem LIMIT GTC com o `clientOrderId` informado
  - `getOrdersSince` — ordens do símbolo criadas a partir de um horário da Binance
  - `cancelOpenOrders` — cancela as ordens abertas do símbolo (sem ordem aberta, não faz nada)
  - `serverTimestamp` — horário da Binance, com o offset do relógio buscado uma vez (interna)
  - `signedRequest` — request assinado com a API key (interna)
  - `request` — executa o request e converte a recusa da Binance em `TestnetRequestError` (interna)
