# SLAs de TI - Computadores

Este documento define os tempos de SLA para problemas relacionados a computadores no setor de TI.

## Mapeamento de Prioridades

### Incidentes (Problemas Técnicos)

**P1 - 1 hora (60 minutos)**
Problemas críticos que impedem o trabalho:
- Computador travando
- Computador não liga

**P2 - 2 horas (120 minutos)**
Problemas importantes:
- Realocar computador

### Requisições (Solicitações de Serviço)

**P2 - 4 horas (240 minutos)**
Solicitações urgentes:
- Devolver computador

**P3 - 24 horas (1440 minutos / 1 dia)**
Solicitações de médio prazo:
- Solicitar troca de computador
- Manutenção preventiva

**P4 - 48 horas (2880 minutos / 2 dias)**
Solicitações de longo prazo:
- Solicitar novo computador
- Manutenção corretiva

## Configuração no Sistema

Os itens foram cadastrados na subcategoria "Computadores" (ID: 8) com os tempos de SLA documentados.

Para aplicar estes SLAs:
1. Problemas técnicos (travando, não liga, realocar): usar tipo "Incidente" com prioridade P1 ou P2
2. Solicitações (novo, troca, devolução, manutenção): usar tipo "Requisição" com prioridade P2, P3 ou P4
3. O sistema calculará automaticamente o prazo baseado no tipo e prioridade selecionados
