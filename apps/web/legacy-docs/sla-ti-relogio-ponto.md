# SLAs de TI - Relógio de Ponto

Este documento define os tempos de SLA para o sistema de ponto eletrônico no setor de TI.

## Mapeamento de Prioridades

### Incidentes (Problemas Técnicos)

**P1 - 2 horas (120 minutos)**
- Relógio de Ponto - Reset do relógio
- Relógio de Ponto - Travado

**P2 - 3 horas (180 minutos)**
- Relógio de Ponto - Configurar

**P2 - 5 horas (300 minutos)**
- Relógio de Ponto - Não funciona
- Relógio de Ponto - Falha na conexão

## Configuração no Sistema

Os itens foram cadastrados na subcategoria "Relógio de Ponto" (ID: 201) com os tempos de SLA documentados.

Para aplicar estes SLAs:
1. Problemas urgentes (reset, travamento) (2h): usar tipo "Incidente" com prioridade P1
2. Configuração (3h): usar tipo "Incidente" com prioridade P2
3. Problemas de funcionamento e conexão (5h): usar tipo "Incidente" com prioridade P2
4. O sistema calculará automaticamente o prazo baseado no tipo e prioridade selecionados
