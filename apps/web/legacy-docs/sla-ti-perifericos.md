# SLAs de TI - Periféricos

Este documento define os tempos de SLA para problemas relacionados a periféricos no setor de TI.

## Mapeamento de Prioridades

### Incidentes (Problemas Técnicos)

**P1 - 1 hora (60 minutos)**
Problemas urgentes e operações básicas:
- Periférico travando
- Periférico não funciona
- Periférico danificado
- Configurar periférico
- Instalar periférico
- Devolver periférico
- Projetor não liga
- Configurar webcam
- Instalar webcam
- Devolver webcam

**P2 - 2 horas (120 minutos)**
Operações mais complexas:
- Solicitar troca de periférico
- Configurar projetor
- Remover projetor
- Instalar leitor biométrico
- Configurar leitor biométrico
- Leitor biométrico não funciona
- Trocar leitor biométrico

### Requisições (Solicitações de Serviço)

**P4 - 1 mês (43200 minutos / 30 dias)**
Aquisições de novos equipamentos:
- Solicitar novo periférico

## Configuração no Sistema

Os itens foram cadastrados na subcategoria "Periféricos" (ID: 9) com os tempos de SLA documentados.

Para aplicar estes SLAs:
1. Problemas urgentes (1h): usar tipo "Incidente" com prioridade P1
2. Operações complexas (2h): usar tipo "Incidente" com prioridade P2
3. Novos equipamentos (1 mês): usar tipo "Requisição" com prioridade P4
4. O sistema calculará automaticamente o prazo baseado no tipo e prioridade selecionados
