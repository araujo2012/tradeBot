# BotTrade API

API para gerenciamento de WebSockets da Binance para trading automatizado.

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
