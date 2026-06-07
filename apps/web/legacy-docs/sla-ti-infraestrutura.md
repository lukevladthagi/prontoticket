# SLAs de TI - Infraestrutura

Este documento define os tempos de SLA para infraestrutura de rede e conectividade no setor de TI.

## Mapeamento de Prioridades

### Incidentes (Problemas Técnicos)

**P2 - 4 horas (240 minutos)**
- Infraestrutura - Sem internet

**P2 - 5 horas (300 minutos)**
- Infraestrutura - Alterar VLAN
- Infraestrutura - WiFi não funciona
- Infraestrutura - Configuração de Access Point

### Requisições (Solicitações de Serviço)

**P3 - 24 horas (1440 minutos)**
- Infraestrutura - Ativar novo ponto de rede
- Infraestrutura - Retirada de Access Point

**P3 - 48 horas (2880 minutos)**
- Infraestrutura - Novo cabeamento de rede
- Infraestrutura - Novo ponto de rede
- Infraestrutura - Ponto sem link
- Infraestrutura - Novo Access Point

## Configuração no Sistema

Os itens foram cadastrados na subcategoria "Infraestrutura" (ID: 190) com os tempos de SLA documentados.

Para aplicar estes SLAs:
1. Problemas críticos de conectividade (4h): usar tipo "Incidente" com prioridade P2
2. Configurações e problemas de WiFi (5h): usar tipo "Incidente" com prioridade P2
3. Ativação e remoção de pontos (24h): usar tipo "Requisição" com prioridade P3
4. Novos cabeamentos e pontos (48h): usar tipo "Requisição" com prioridade P3
5. O sistema calculará automaticamente o prazo baseado no tipo e prioridade selecionados
