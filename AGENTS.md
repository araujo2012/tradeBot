# Regras do projeto para agentes

## Arquivos `functions.md`

Cada pasta com código tem um `functions.md` que descreve a responsabilidade da pasta e as funções de cada arquivo. Ele é a referência para entender o código e decidir onde cada função deve ficar.

1. **Ler antes de mexer:** sempre que for alterar um arquivo ou uma pasta, leia antes o `functions.md` dessa pasta (e o da pasta pai, se houver).
2. **Manter atualizado:** sempre que criar uma pasta, um arquivo ou uma função — ou renomear, mover ou remover algum deles —, crie ou atualize os `functions.md` correspondentes na mesma alteração. Pastas pai também devem citar as subpastas, com link para o `functions.md` de cada uma.
3. **Decidir o local e evitar repetição:** antes de criar uma função nova:
   - use os `functions.md` para definir em qual pasta e arquivo ela deve ficar, de acordo com a responsabilidade de cada pasta;
   - verifique se já existe uma função que faz a mesma coisa (ou quase). Se existir, reutilize-a ou adapte-a em vez de criar outra.
4. **Funções legíveis e pequenas:** escreva funções o mais legíveis e curtas possível. A **legibilidade é a primeira prioridade** e o **tamanho, a segunda**: não sacrifique a clareza só para reduzir linhas.
