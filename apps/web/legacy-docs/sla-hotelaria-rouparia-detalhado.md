# SLA Detalhado - Hotelaria e Rouparia

## Hotelaria

### Prioridade P1 (PRIORIDADE)
- **Higienização terminal de leito** - 80 minutos
- **Higienização concorrente de leito** - 60 minutos
- **Abertura de enfermaria/apto** - 30 minutos
- **Check in enfermaria/apto** - 30 minutos

### Prioridade P2
- **Limpeza de máquina/equipamentos** - 40 minutos
- **Higienização de setor/ambiente** - 90 minutos
- **Retirar de Poltrona/cadeira** - 30 minutos
- **Solicitação de poltrona/cadeira** - 30 minutos
- **Check out enfermaria/apto** - 30 minutos

### Prioridade P3
- **Outros** - 120 minutos

## Rouparia

### Prioridade P1 (PRIORIDADE)
- **Organização de acomodação** - 40 minutos
- **Solicitação enxoval** - 30 minutos

### Prioridade P2
- **Solicitação de fardamento** - 30 minutos

### Prioridade P3
- **Outros** - 120 minutos

## Integração com Telegram

Quando um usuário do Telegram solicita atendimento para Hotelaria ou Rouparia:

1. O sistema coleta o tipo de problema através do fluxo de conversa
2. O nome do tipo de problema é mapeado para a categoria exata no banco de dados
3. O sistema busca o SLA específico associado àquela categoria
4. A prioridade (P1, P2 ou P3) é aplicada automaticamente conforme o SLA
5. O tempo previsto de atendimento é informado ao usuário na confirmação do chamado

### Exemplo de Fluxo

**Usuário:** Preciso de higienização terminal de leito
1. Sistema identifica: Setor = Hotelaria
2. Sistema identifica: Tipo = "Higienização terminal de leito"
3. Sistema busca categoria com nome exato + setor_id = 9
4. Sistema encontra SLA com prioridade P1 e tempo de 80 minutos
5. Chamado é criado com prioridade P1
6. Confirmação ao usuário: "Tempo previsto de atendimento: até 1 hora e 20 minutos"
