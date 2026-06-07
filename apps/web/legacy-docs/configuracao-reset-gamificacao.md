# Configuração do Reset Automático da Gamificação

## Problema
Os pontos da gamificação não estão resetando automaticamente no início de cada mês, causando acúmulo contínuo de pontos.

## Solução Imediata (Reset Manual)

Para resetar os pontos agora:

1. Acesse a página de **Gamificação** no sistema
2. Clique no botão **"Resetar Mês"** (disponível apenas para gestores e admins do TI)
3. O sistema irá:
   - Salvar o histórico de maio na tabela `gamificacao_historico_mensal`
   - Zerar os pontos mensais de todos os técnicos
   - Manter os pontos totais acumulados

## Solução Definitiva (Reset Automático)

Para que o reset aconteça automaticamente todo dia 1º do mês, configure um job no Cron-job.org:

### Passo 1: Acesse o Cron-job.org
1. Entre em https://cron-job.org
2. Faça login na sua conta

### Passo 2: Crie um novo Cronjob
1. Clique em "Create cronjob"
2. Configure:
   - **Title**: Reset Gamificação Mensal
   - **Address**: `https://tickethpc.mocha.app/api/cron/resetar-gamificacao`
   - **Schedule**: 
     - Type: **Monthly**
     - Day of month: **1**
     - Hour: **00**
     - Minute: **05**
   - **Request method**: POST
   - **Headers**: 
     ```
     x-cron-secret: [CRON_SECRET_GAMIFICACAO]
     ```

### Passo 3: Verificar o Secret
1. Acesse **Configurações** → **Secrets** no sistema
2. Procure por `CRON_SECRET_GAMIFICACAO`
3. Se não existir, crie um novo secret com esse nome e um valor aleatório
4. Use esse valor no header do cronjob

## Como Funciona

Quando o job é executado todo dia 1º do mês às 00:05:
1. O endpoint `/api/cron/resetar-gamificacao` é chamado
2. O sistema verifica se é o primeiro dia do mês
3. Se sim, executa a função `resetarPontosMensais()`:
   - Busca o ranking atual
   - Salva na tabela de histórico mensal
   - Zera os pontos mensais (mantém pontos totais)
   - Recalcula níveis e badges

## Verificação

Para verificar se está funcionando:
1. Após configurar o cronjob, aguarde até o dia 1º do próximo mês
2. No dia 1º, acesse a gamificação e veja se os pontos mensais foram zerados
3. Acesse a aba "Conquistas do Mês" → histórico para ver o mês anterior salvo
