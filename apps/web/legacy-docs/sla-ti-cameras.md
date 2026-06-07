# SLAs de TI - Câmeras

Este documento define os tempos de SLA para problemas relacionados a câmeras de segurança e CFTV no setor de TI.

## Mapeamento de Prioridades

### Incidentes (Problemas Técnicos)

**P1 - 1 hora (60 minutos)**
Solicitações urgentes de acesso:
- Solicitação de imagens

**P2 - 2 horas (120 minutos)**
Solicitações de acesso:
- Solicitação de acesso (câmeras)

**P2 - 4 horas (240 minutos)**
Problemas técnicos e configurações:
- Câmera travando
- Configurar câmera
- Devolver câmera

### Requisições (Solicitações de Serviço)

**P3 - 24 horas (1440 minutos / 1 dia)**
Solicitações de médio prazo:
- Solicitar nova câmera
- Solicitar troca de câmera

**P4 - 48 horas (2880 minutos / 2 dias)**
Solicitações e instalações de longo prazo:
- Realocar câmera
- Reposicionar câmera
- Instalar câmera
- Câmera não funciona

## Configuração no Sistema

Os itens foram cadastrados na subcategoria "Câmeras" (ID: 74) com os tempos de SLA documentados.

Para aplicar estes SLAs:
1. Solicitações urgentes (imagens, acesso): usar tipo "Incidente" com prioridade P1 ou P2
2. Problemas técnicos (travando, configurar): usar tipo "Incidente" com prioridade P2
3. Solicitações (nova, troca, instalar, realocar): usar tipo "Requisição" com prioridade P3 ou P4
4. O sistema calculará automaticamente o prazo baseado no tipo e prioridade selecionados
