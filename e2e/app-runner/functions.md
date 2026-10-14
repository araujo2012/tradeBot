# `e2e/app-runner/`

Resumo: sobe e controla a aplicação real como processo filho durante os testes e2e. Não é importada pelo código de produção.

## Arquivos

### `app-process.ts`
- `delay` — espera N ms (interna)
- `getFreePort` — obtém uma porta TCP livre (exportada)
- `createTestPrivateKey` — gera uma chave Ed25519 temporária para assinar requests (exportada)
- `ApplicationProcess` — sobe/derruba a aplicação como processo filho e captura logs (exportada)
