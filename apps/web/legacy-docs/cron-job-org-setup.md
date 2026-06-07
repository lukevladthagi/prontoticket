# Configuração do Cron-job.org para TicketHPC

Como o Mocha não permite editar o arquivo wrangler.toml para configurar cron triggers nativos do Cloudflare Workers, você precisa usar o serviço externo Cron-job.org para executar as tarefas agendadas.

## Passo 1: Criar conta no Cron-job.org

1. Acesse https://cron-job.org
2. Crie uma conta gratuita
3. Faça login

## Passo 2: Configurar o token secreto

1. No Mocha, vá em **Settings** → **Secrets**
2. Localize o secret **CRON_SECRET_TOKEN**
3. Gere um token aleatório seguro (exemplo: use https://www.uuidgenerator.net/)
4. Cole o token no campo e salve
5. **Guarde esse token** - você vai precisar dele no próximo passo

## Passo 3: Criar jobs no Cron-job.org

### Job 1: Processar Chamados Recorrentes

1. No Cron-job.org, clique em **Create cronjob**
2. Preencha:
   - **Title**: TicketHPC - Chamados Recorrentes
   - **Address (URL)**: `https://tickethpc.mocha.app/api/cron/processar-recorrentes?token=SEU_TOKEN_AQUI`
     - Substitua `SEU_TOKEN_AQUI` pelo token do CRON_SECRET_TOKEN
   - **Schedule**: 
     - **Every minute** OU **Every 5 minutes** (recomendado)
     - Ou configure um horário específico se preferir
   - **Enabled**: Marque a caixa
3. Clique em **Create cronjob**

### Job 2: Processar Manutenções Preventivas

1. Clique em **Create cronjob** novamente
2. Preencha:
   - **Title**: TicketHPC - Manutenções Preventivas
   - **Address (URL)**: `https://tickethpc.mocha.app/api/cron/processar-manutencoes?token=SEU_TOKEN_AQUI`
     - Substitua `SEU_TOKEN_AQUI` pelo token do CRON_SECRET_TOKEN
   - **Schedule**: 
     - **Once a day** às 00:00 (meia-noite)
     - Ou configure conforme sua necessidade
   - **Enabled**: Marque a caixa
3. Clique em **Create cronjob**

### Job 3 (Opcional): Processar Tudo

Se preferir um único job que processa ambos:

1. Clique em **Create cronjob**
2. Preencha:
   - **Title**: TicketHPC - Processar Tudo
   - **Address (URL)**: `https://tickethpc.mocha.app/api/cron/processar-todos?token=SEU_TOKEN_AQUI`
   - **Schedule**: Configure conforme sua necessidade
   - **Enabled**: Marque a caixa
3. Clique em **Create cronjob**

## Passo 4: Testar

Após criar os jobs, você pode testá-los:

1. No Cron-job.org, clique no job
2. Clique em **Run now** para executar manualmente
3. Verifique o **Execution log** para ver se funcionou
4. No TicketHPC, verifique se os chamados/manutenções foram processados

## Endpoints Disponíveis

- `/api/cron/processar-recorrentes` - Processa apenas chamados recorrentes
- `/api/cron/processar-manutencoes` - Processa apenas manutenções preventivas
- `/api/cron/processar-todos` - Processa ambos

Todos requerem o token de autenticação via:
- Query parameter: `?token=SEU_TOKEN`
- Ou header: `X-Cron-Token: SEU_TOKEN`

## Frequências Recomendadas

- **Chamados Recorrentes**: A cada 5-10 minutos (para maior precisão nos horários agendados)
- **Manutenções Preventivas**: Uma vez por dia (meia-noite ou horário de baixo movimento)

## Segurança

- **NUNCA** compartilhe o token CRON_SECRET_TOKEN
- Se o token for comprometido, gere um novo e atualize nos jobs do Cron-job.org
- Os endpoints rejeitarão qualquer requisição sem token válido

## Troubleshooting

Se algo não funcionar:

1. Verifique se o token está correto nos dois lugares (Mocha e Cron-job.org)
2. Veja os logs de execução no Cron-job.org
3. Teste os endpoints manualmente no navegador: `https://tickethpc.mocha.app/api/cron/processar-todos?token=SEU_TOKEN`
