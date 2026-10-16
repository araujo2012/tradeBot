# BotTrade API

API para gerenciamento de WebSockets da Binance para trading automatizado.

## Documentação técnica

O mapa hierárquico da arquitetura, das funções e dos modelos está em [`PROJECT-MAP.md`](PROJECT-MAP.md). Comece por esse índice para navegar da visão geral até a documentação específica de cada pasta.

## Instalação

```bash
npm install
# ou
yarn install
```

## Executando o projeto

### Desenvolvimento

```bash
npm run dev
# ou
yarn dev
```

### Produção

```bash
npm run build
npm start
# ou
yarn build
yarn start
```

### Teste E2E local

O teste E2E sobe uma instância isolada de MongoDB, RabbitMQ e Redis com Docker
Compose. A maioria dos cenários usa uma Binance fake local; os arquivos
`*.testnet.e2e.test.ts` falam com o [Spot Testnet da Binance](https://testnet.binance.vision).
O primeiro comando sobe a infraestrutura; o comando principal também faz o teardown automaticamente.

```bash
npm run test:e2e:infra:up
npm run test:e2e
npm run test:e2e:infra:down
```

As portas do ambiente E2E são MongoDB `37017`, RabbitMQ `37672` (painel `37673`) e Redis `37379`.
Os valores de conexão podem ser copiados de [`.env.e2e.example`](.env.e2e.example) para um `.env.e2e`
(fora do git), que a suíte carrega automaticamente.

#### Chave do Spot Testnet

1. Gere um par de chaves Ed25519 na pasta `scripts/` (fora do git):
   `openssl genpkey -algorithm ed25519 -out scripts/testnet_private_key.pem` e
   `openssl pkey -in scripts/testnet_private_key.pem -pubout -out scripts/testnet_public_key.pem`.
2. Entre em https://testnet.binance.vision (login com GitHub), registre a chave pública
   (`testnet_public_key.pem`) como API key do tipo Ed25519 e copie a API key gerada.
3. No `.env.e2e`, preencha `BINANCE_TESTNET_API_KEY` (e `BINANCE_TESTNET_PRIVATE_KEY_PATH`, se a
   chave privada estiver em outro lugar).

A conta do testnet recebe saldo virtual e é zerada pela Binance cerca de uma vez por mês. Os testes
cancelam as ordens abertas do símbolo antes e depois de cada cenário, então use uma conta só para eles.

## Rotas da API

### Health Check

```
GET /health
```

### Rotas de Socket

#### Iniciar Socket para um Usuário

```
POST /api/socket/start/:userId
```

**Exemplo:**

```bash
curl -X POST http://localhost:3000/api/socket/start/64f8a1b2c3d4e5f6a7b8c9d0
```

**Resposta de sucesso:**

```json
{
  "success": true,
  "message": "Socket iniciado com sucesso",
  "listenKey": "abc123def456ghi789"
}
```

#### Parar Socket de um Usuário

```
POST /api/socket/stop/:userId
```

**Exemplo:**

```bash
curl -X POST http://localhost:3000/api/socket/stop/64f8a1b2c3d4e5f6a7b8c9d0
```

**Resposta de sucesso:**

```json
{
  "success": true,
  "message": "Socket parado com sucesso"
}
```

#### Verificar Status do Socket

```
GET /api/socket/status/:userId
```

**Exemplo:**

```bash
curl http://localhost:3000/api/socket/status/64f8a1b2c3d4e5f6a7b8c9d0
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "active": true,
    "listenKey": "abc123def456ghi789"
  }
}
```

#### Parar Todos os Sockets

```
POST /api/socket/stop-all
```

**Exemplo:**

```bash
curl -X POST http://localhost:3000/api/socket/stop-all
```

## Como Funciona

1. **Iniciar Socket**:

   - Busca o usuário no banco de dados
   - Verifica se o usuário tem API Key configurada
   - Busca as configurações do usuário
   - Chama a API da Binance para obter um listen key
   - Inicia uma conexão WebSocket com a Binance usando o listen key
   - Monitora os dados do stream em tempo real

2. **Parar Socket**:

   - Fecha a conexão WebSocket
   - Remove a conexão da lista de conexões ativas

3. **Status**:
   - Verifica se existe uma conexão ativa para o usuário
   - Retorna o status e o listen key se ativo

## Estrutura do Projeto

```
botTrade/
├── app/
│   ├── binance/          # Serviços da Binance
│   ├── socket/           # Serviços de WebSocket
│   ├── lib/              # Utilitários
│   └── limits/           # Serviços de limites
├── models/               # Modelos do MongoDB
├── scripts/              # Scripts utilitários
├── server.ts             # Servidor principal
└── package.json
```

## Configuração

Certifique-se de que o usuário tenha:

- API Key da Binance configurada
- API Secret da Binance configurada
- Configurações de trading definidas

## Logs

O sistema registra logs para:

- Conexões WebSocket estabelecidas
- Dados recebidos do stream
- Erros de conexão
- Operações de start/stop de socket

## Tratamento de Erros

O sistema trata automaticamente:

- Usuários não encontrados
- API Keys não configuradas
- Configurações ausentes
- Erros de conexão com a Binance
- Reconexão automática em caso de falha
