# Todo

- #1: Completar refatoração do Configuracoes.tsx - remover código antigo do debug-sla (linhas 3195-3510 aproximadamente), remover interfaces TicketDebug/DebugData (linhas 15-48), remover estados debugSLAData/debugSLALoading (linhas 109-110), remover função loadDebugSLA (linhas 282-296), adicionar import do DebugSLATab. Isso reduzirá o bundle de 3.8MB permitindo publicação.
- #2: Implementar estrutura completa de categorias TI com 13 tipos de problema e subcategorias detalhadas (solicitado mas nunca implementado - ver histórico bloco 6637).
- #3: Configurar job no Cron-job.org para chamar endpoint /api/cron/processar-todos diariamente - o sistema já reseta gamificação automaticamente no dia 1º de cada mês se o cronjob estiver ativo. Instruções completas em docs/instrucoes-cron-gamificacao.md. Solução temporária: usar botão "Resetar Mês" na página de Gamificação.
