# SLAs de TI - Power BI

Este documento define os tempos de SLA para o sistema Power BI (Business Intelligence) no setor de TI.

## Mapeamento de Prioridades

### Incidentes (Problemas Técnicos)

**P1 - 1 hora (60 minutos)**
- Power BI - Atualização de Gateway
- Power BI - Liberação de acessos

**P2 - 2 horas (120 minutos)**
- Power BI - Reestabelecer conexão servidor

### Requisições (Solicitações de Serviço)

**P3 - 48 horas (2880 minutos)**
- Power BI - Ajuste BI
- Power BI - Suporte fornecedores terceiros

**P4 - 96 horas (5760 minutos)**
- Power BI - Relatório de banco de dados

## Configuração no Sistema

Os itens foram cadastrados na subcategoria "Power BI" (ID: 183) com os tempos de SLA documentados.

Para aplicar estes SLAs:
1. Problemas críticos de gateway e acesso (1h): usar tipo "Incidente" com prioridade P1
2. Problemas de conexão (2h): usar tipo "Incidente" com prioridade P2
3. Ajustes e suporte terceiros (48h): usar tipo "Requisição" com prioridade P3
4. Desenvolvimento de relatórios (96h): usar tipo "Requisição" com prioridade P4
5. O sistema calculará automaticamente o prazo baseado no tipo e prioridade selecionados
