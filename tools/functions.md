# `tools/`

Resumo: scripts de manutenção do repositório (não fazem parte do build).

## Arquivos

### `check-index.js`
Verifica se os `functions.md` estão em dia com os exports (`node tools/check-index.js`).
- `walk` — percorre as pastas, valida `functions.md`, seções por arquivo e exports documentados (interna)
