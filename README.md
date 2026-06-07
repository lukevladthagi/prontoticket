# ProntoTicket

ProntoTicket é uma plataforma web para gestão de chamados, solicitações internas e rotinas de atendimento da TI do Hospital Prontocardio. O sistema centraliza abertura, acompanhamento, filas, SLAs, recorrências, contratos, ativos, base de conhecimento, relatórios e indicadores operacionais.

## Principais Recursos

- Abertura e acompanhamento de chamados.
- Dashboard operacional com visão de filas, status e indicadores.
- Gestão de SLAs e análise de desempenho.
- Chamados recorrentes e processamento manual de recorrências.
- Base de conhecimento para artigos e orientações.
- Controle de ativos, contratos, estoque e manutenções.
- Relatórios de chamados, setores, avaliações, gamificação e classificação.
- Módulos de configuração para filas, setores, permissões e integrações.
- Autenticação com Better Auth e persistência em PostgreSQL.

## Tecnologias

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Better Auth
- Neon PostgreSQL
- Yarn 4 com workspaces

## Estrutura do Projeto

```text
apps/
  web/       Aplicação web principal em Next.js
  mobile/    Estrutura mobile gerada pelo template
config/      Configurações compartilhadas
publisher/   Ferramentas do template de publicação
```

## Configuração Local

Crie o arquivo `apps/web/.env.local` com as variáveis necessárias:

```env
DATABASE_URL=postgresql://usuario:senha@host/banco?sslmode=require
AUTH_SECRET=sua-chave-secreta
BETTER_AUTH_SECRET=sua-chave-secreta
AUTH_URL=http://localhost:4004
BETTER_AUTH_URL=http://localhost:4004
NEXT_PUBLIC_AUTH_URL=http://localhost:4004
NEXT_PUBLIC_CREATE_BASE_URL=http://localhost:4004
NEXT_PUBLIC_CREATE_HOST=localhost:4004
NEXT_PUBLIC_PROJECT_GROUP_ID=prontoticket-local
```

Não versionar arquivos `.env`, `.env.local` ou qualquer arquivo com credenciais reais.

## Instalação

```bash
corepack yarn install
```

## Rodando Localmente

```bash
corepack yarn workspace web next dev --port 4004
```

Acesse:

```text
http://localhost:4004
```

## Verificações

```bash
corepack yarn workspace web typecheck
corepack yarn workspace web build
```

## Produção

Para produção, configure as variáveis de ambiente no servidor ou no orquestrador de containers. O banco e chaves de autenticação devem ser fornecidos por variáveis seguras, nunca diretamente no repositório.

## Observações

- O banco PostgreSQL precisa estar previamente criado e com as tabelas esperadas pela aplicação.
- Integrações externas, como notificações ou mensageria, dependem das credenciais correspondentes no ambiente.
- Este repositório não deve conter IPs internos, senhas, tokens, strings de conexão reais ou dados sensíveis.
