# Instruções: Configurar Reset Automático da Gamificação

## O Problema
A gamificação não está resetando automaticamente no dia 1º de cada mês, fazendo com que os pontos continuem acumulando.

## Solução Imediata (Agora - Manual)

1. Acesse: https://tickethpc.mocha.app/gamificacao
2. Clique no botão **"Resetar Mês"** (canto superior direito)
3. Confirme a ação
4. O sistema irá:
   - Salvar o ranking de maio no histórico
   - Zerar os pontos mensais de todos
   - Manter os pontos totais acumulados

## Solução Definitiva (Automático Todo Mês)

### Passo 1: Acessar Cron-job.org

1. Entre em: **https://cron-job.org**
2. Faça login com sua conta (ou crie uma se não tiver)

### Passo 2: Copiar o Token Secreto

1. No sistema ProntoTicket, vá em: **Configurações** → aba **Secrets**
2. Procure por: **CRON_SECRET_TOKEN**
3. Clique em "Mostrar" e copie o valor
4. **Guarde esse valor** - você vai precisar dele no próximo passo

### Passo 3: Criar o Cronjob

1. No Cron-job.org, clique em **"Create cronjob"**

2. Preencha os campos:

   **Título:**
   ```
   Reset Gamificação Mensal - ProntoTicket
   ```

   **URL:**
   ```
   https://tickethpc.mocha.app/api/cron/resetar-gamificacao
   ```

   **Agendar:**
   - Schedule type: **Monthly** (Mensal)
   - Day of month: **1** (dia 1)
   - Time: **00:05** (5 minutos após meia-noite)
   - Timezone: **(UTC-03:00) Fortaleza, Brazil** (ou horário de Brasília)

   **Request method:** **GET**

   **Request Headers:**
   Clique em "Add header" e adicione:
   - Header name: `X-Cron-Token`
   - Header value: [cole aqui o valor do CRON_SECRET_TOKEN que você copiou]

   **Enabled:** ✅ Marque para ativar

3. Clique em **"Create"** para salvar

### Passo 4: Testar (Opcional)

Você pode testar se está funcionando clicando em "Execute now" no cronjob criado. O sistema só vai resetar de verdade se for dia 1º do mês, mas você verá se a autenticação está funcionando.

## Como Funciona

Todo dia 1º do mês às 00:05 (horário de Brasília):
1. O Cron-job.org vai chamar automaticamente a URL do sistema
2. O sistema verifica se é dia 1º
3. Se sim, salva o ranking atual no histórico
4. Zera os pontos mensais de todos os técnicos
5. Os pontos totais acumulados são mantidos
6. Os níveis e badges são recalculados

## Verificar se Funcionou

No dia 1º de junho (ou do próximo mês), você pode verificar:

1. Acesse a **Gamificação**
2. Os pontos do "Mês Atual" devem estar zerados
3. Na aba **"Conquistas do Mês"**, você pode ver o histórico
4. Clique em um mês anterior para ver o ranking salvo

## Precisa de Ajuda?

Se tiver dúvidas ou problemas:
- Email: support@getmocha.com
- Discord da Mocha

---

**Última atualização:** Maio 2025
