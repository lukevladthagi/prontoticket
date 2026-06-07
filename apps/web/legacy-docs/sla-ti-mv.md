# SLAs de TI - Sistema MV

Este documento define os tempos de SLA para o sistema MV (Prontuário Eletrônico e Gestão Hospitalar) no setor de TI.

## Mapeamento de Prioridades

### Incidentes (Problemas Técnicos)

**P1 - 1 hora (60 minutos)**
- MV - Instalar
- MV - Reset senha de usuário

**P2 - 2 horas (120 minutos)**
- MV - Configurar
- MV - Configuração de acessos
- MV - Não funciona
- MV - PEP não funciona
- MV - Verificar erro

**P2 - 4 horas (240 minutos)**
- MV - Alteração de informações
- MV - Configuração de atendimento
- MV - Sem acesso
- MV - Criar documento
- MV - Treinamento
- MV - Apoio

### Requisições (Solicitações de Serviço)

**P3 - 24 horas (1440 minutos)**
- MV - Ajustar usuário

**P3 - 36 horas (2160 minutos)**
- MV - Criar usuário

## Configuração no Sistema

Os itens foram cadastrados na subcategoria "MV" (ID: 144) com os tempos de SLA documentados.

Para aplicar estes SLAs:
1. Problemas urgentes (1h): usar tipo "Incidente" com prioridade P1
2. Problemas moderados (2h): usar tipo "Incidente" com prioridade P2
3. Configurações e suporte (4h): usar tipo "Incidente" com prioridade P2
4. Solicitações de usuário (24h/36h): usar tipo "Requisição" com prioridade P3
5. O sistema calculará automaticamente o prazo baseado no tipo e prioridade selecionados
