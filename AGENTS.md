# Regras do projeto para agentes

## Arquivos `functions.md`

Cada pasta com código tem um `functions.md` que descreve a responsabilidade da pasta e as funções de cada arquivo. Ele é a referência para entender o código e decidir onde cada função deve ficar.

1. **Ler antes de mexer:** sempre que for alterar um arquivo ou uma pasta, leia antes o `functions.md` dessa pasta (e o da pasta pai, se houver).
2. **Manter atualizado:** sempre que criar uma pasta, um arquivo ou uma função — ou renomear, mover ou remover algum deles —, crie ou atualize os `functions.md` correspondentes na mesma alteração. Pastas pai também devem citar as subpastas, com link para o `functions.md` de cada uma.
3. **Decidir o local e evitar repetição:** antes de criar uma função nova:
   - use os `functions.md` para definir em qual pasta e arquivo ela deve ficar, de acordo com a responsabilidade de cada pasta;
   - verifique se já existe uma função que faz a mesma coisa (ou quase). Se existir, reutilize-a ou adapte-a em vez de criar outra.
4. **Funções legíveis e pequenas:** escreva funções o mais legíveis e curtas possível. A **legibilidade é a primeira prioridade** e o **tamanho, a segunda**: não sacrifique a clareza só para reduzir linhas.

## Requests à Binance

A Binance limita o peso das requests por IP, as ordens por conta (por 10 segundos e por dia) e as conexões. Quem passa do limite recebe `429`; quem continua insistindo recebe `418`, um banimento do IP que fica mais longo a cada reincidência. Todo código deve fazer o **mínimo de requests possível**.

1. **Dado local primeiro:** antes de consultar a Binance, use o que já está no banco ou no Redis (saldo em `brl`, status das ordens, configuração do símbolo). Só consulte quando o dado local não basta para decidir. Exemplo: `hasBalanceForOrder` só chama `account.status` quando o `brl` local não cobre a compra.
2. **Eventos em vez de consultas:** o user data stream já envia `executionReport`, `outboundAccountPosition` e `balanceUpdate`. Mantenha o estado local com esses eventos em vez de perguntar de tempos em tempos (`order.status`, `account.status`).
3. **Validar antes de enviar:** confira localmente saldo, precisão, valor mínimo e se a ordem já existe. Ordem recusada também conta no limite de ordens: nas recusas `-2010` gravadas em `websocketdatas`, o contador diário `ORDERS` subiu a cada `order.place` recusado.
4. **Não repetir o que falhou pelo mesmo motivo:** trate o erro e encerre o fluxo (exemplo: `-2010` atualiza o saldo e para). Retry só para erro transitório (timeout, desconexão), com backoff exponencial e limite de tentativas.
5. **Respeitar `429`/`418`:** ao receber um deles, pare de enviar requests até o tempo indicado na resposta (`Retry-After` no REST, `retryAfter` na WebSocket API). Nunca insista.
6. **Preferir a request mais barata:** confira o peso na documentação, use parâmetros que reduzem a resposta (como `omitZeroBalances`) e prefira `order.cancelReplace` a `order.cancel` + `order.place`. Dados que mudam pouco (klines, offset do relógio) ficam em cache com TTL.
7. **Reaproveitar conexões:** use o socket já autenticado da sessão (`getBinanceSocket`); não abra conexões novas em loop.
8. **Contar as requests de jobs e loops:** ao criar um job periódico ou um reenfileiramento, estime quantas requests por minuto ele gera por bot e por conta (os bots da mesma sessão dividem os limites da conta) e evite disparos concorrentes para o mesmo bot.
9. **Testar o volume:** nos testes e2e, a Binance falsa registra os comandos recebidos (`getCommands`). Em fluxo novo, verifique também quantas requests ele envia.
