# Mapa técnico do BotTrade

Documentação gerada a partir do código existente no repositório em **18/08/2026**. Ela descreve a arquitetura, os módulos, as funções públicas e privadas e as formas de uso observáveis no estado atual do projeto.

## Como navegar

Comece por estes arquivos:

1. [`ARCHITECTURE.md`](ARCHITECTURE.md) — visão geral, inicialização, integrações e fluxos.
2. [`FUNCTION-INDEX.md`](FUNCTION-INDEX.md) — índice de todas as funções nomeadas encontradas no código.
3. [`ROOT-FILES.md`](ROOT-FILES.md) — arquivos da raiz, configuração e ponto de entrada.
4. [`app/README.md`](app/README.md) — mapa da pasta `app`.
5. Entre na área desejada para obter a descrição específica dos arquivos e das funções:
   - [`app/binance`](app/binance/README.md)
   - [`app/bot`](app/bot/README.md)
   - [`app/limits`](app/limits/README.md)
   - [`app/order`](app/order/README.md)
   - [`app/session`](app/session/README.md)
   - [`app/socket`](app/socket/README.md)
   - [`app/lib`](app/lib/README.md)
   - [`app/jobs`](app/jobs/README.md)
   - [`models`](models/README.md)

Em cada pasta, o `README.md` é a visão geral e o arquivo `functions.md` ou `schemas.md` aprofunda o comportamento.

## Mapa resumido

```text
tradeBot/
├── main.ts                 inicialização do processo
├── app.ts                  configuração do Express
├── websocket.ts            WebSocket externo para clientes autenticados
├── app/
│   ├── binance/            REST, klines, estatísticas e tipos Binance
│   ├── bot/                estratégia manager, serviços e locks
│   ├── limits/             cálculo de limites de Bollinger
│   ├── order/              tipos, constantes e arredondamento de ordens
│   ├── session/            operações de sessão e publicação em RabbitMQ
│   ├── socket/             WebSockets Binance, consumidor RabbitMQ e respostas
│   ├── lib/                MongoDB, Redis, RabbitMQ, BullMQ, Agenda e bootstrap
│   └── jobs/               jobs periódicos do Agenda
└── models/                 schemas e models Mongoose
```

## Escopo e fonte da verdade

Os documentos foram escritos com base nos arquivos TypeScript atuais. O `README.md` da raiz continua sendo uma referência operacional útil, mas algumas rotas descritas nele não estão registradas em `app.ts`; por isso, esta documentação separa o que está implementado do que é apenas descrito no README antigo.

## Execução rápida

```bash
npm install
npm run dev
```

Para produção, o script configurado é:

```bash
npm run build
npm start
```

Consulte [`ROOT-FILES.md`](ROOT-FILES.md) para as variáveis de ambiente e as observações sobre o script de produção.

## Observações importantes do estado atual

- O ponto de entrada usado por `npm run dev` é `main.ts`.
- `app.ts` configura CORS e JSON, mas não registra as rotas HTTP citadas no README da raiz.
- O WebSocket externo é criado em `/ws` e autentica por `?token=...`.
- O consumidor RabbitMQ e o worker BullMQ são inicializados por importação/execução dos módulos.
- `socket.consumer.ts` usa `crypto.randomUUID()` sem um import de `crypto` visível no arquivo.
- `socket.requests.ts` tenta ler `scripts/private_key.pem`; a pasta `scripts` não aparece na árvore atual e está listada no `.gitignore`.

