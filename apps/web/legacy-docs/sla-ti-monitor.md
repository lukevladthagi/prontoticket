# SLAs de TI - Monitor

Este documento define os tempos de SLA para problemas relacionados a monitores no setor de TI.

## Mapeamento de Prioridades

### Incidentes (Problemas Técnicos)

**P1 - 1 hora (60 minutos)**
Problemas urgentes:
- Configurar monitor
- Monitor não liga

**P2 - 2 horas (120 minutos)**
Instalações:
- Instalar monitor

**P2 - 4 horas (240 minutos)**
Problemas e realocações:
- Solicitar troca de monitor
- Realocar monitor
- Monitor sem imagem
- Monitor imagem fora do padrão

### Requisições (Solicitações de Serviço)

**P3 - 48 horas (2880 minutos / 2 dias)**
Aquisições e devoluções:
- Solicitar novo monitor
- Devolver monitor

## Configuração no Sistema

Os itens foram cadastrados na subcategoria "Monitor" (ID: 120) com os tempos de SLA documentados.

Para aplicar estes SLAs:
1. Problemas urgentes (1h): usar tipo "Incidente" com prioridade P1
2. Instalação (2h): usar tipo "Incidente" com prioridade P2
3. Problemas e realocações (4h): usar tipo "Incidente" com prioridade P2
4. Novos monitores e devoluções (48h): usar tipo "Requisição" com prioridade P3
5. O sistema calculará automaticamente o prazo baseado no tipo e prioridade selecionados
