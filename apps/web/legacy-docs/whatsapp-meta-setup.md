# Configuração WhatsApp Business API (Meta)

Este guia mostra como configurar a integração direta com a Meta WhatsApp Business API no Mocha.

## Pré-requisitos

1. **Conta Meta Business** verificada
2. **Aplicativo Meta for Developers** configurado
3. **Número de telefone WhatsApp Business** aprovado

## Passo 1: Obter credenciais na Meta

### 1.1 Acesse o Meta for Developers

1. Acesse: https://developers.facebook.com/apps
2. Selecione seu aplicativo ou crie um novo
3. Adicione o produto "WhatsApp" ao seu app

### 1.2 Obter o Access Token

1. No painel do seu app, vá em **WhatsApp → Getting Started**
2. Copie o **Temporary Access Token** (ou gere um permanente)
3. Guarde este token - será usado como `META_WHATSAPP_TOKEN`

### 1.3 Obter o Phone Number ID

1. Ainda em **WhatsApp → Getting Started**
2. Na seção "Send and receive messages", copie o **Phone Number ID**
3. Guarde este ID - será usado como `META_WHATSAPP_PHONE_ID`

### 1.4 Criar Verify Token

1. Crie um token aleatório (pode ser qualquer string segura)
2. Exemplo: `meu_token_secreto_12345`
3. Guarde este token - será usado como `META_WHATSAPP_VERIFY_TOKEN`

## Passo 2: Configurar Secrets no Mocha

1. No Mocha, vá em **Settings → Secrets**
2. Adicione os seguintes secrets:

| Nome do Secret | Valor | Onde obter |
|----------------|-------|------------|
| `META_WHATSAPP_TOKEN` | Access Token da Meta | Painel Meta → WhatsApp → Getting Started |
| `META_WHATSAPP_PHONE_ID` | ID do número de telefone | Painel Meta → WhatsApp → Getting Started |
| `META_WHATSAPP_VERIFY_TOKEN` | Token que você criou | Crie uma string aleatória segura |

3. Clique em **Save** para cada secret

## Passo 3: Configurar Webhook na Meta

1. No painel do Meta for Developers, vá em **WhatsApp → Configuration**
2. Na seção **Webhook**, clique em **Edit**
3. Configure:
   - **Callback URL**: `https://tickethpc.mocha.app/api/meta-whatsapp/webhook`
   - **Verify Token**: O mesmo valor que você definiu em `META_WHATSAPP_VERIFY_TOKEN`
4. Clique em **Verify and Save**
5. Se a verificação for bem-sucedida, você verá uma mensagem de sucesso

### 3.1 Subscrever aos eventos

1. Ainda em **WhatsApp → Configuration**
2. Na seção **Webhook fields**, clique em **Manage**
3. Marque a opção **messages** (obrigatório)
4. Clique em **Save**

## Passo 4: Testar a integração

### 4.1 Verificar status

1. Acesse: `https://tickethpc.mocha.app/api/meta-whatsapp/status`
2. Você deve ver uma página confirmando que todos os secrets estão configurados

### 4.2 Enviar mensagem de teste

1. Pelo seu celular, envie uma mensagem para o número WhatsApp Business
2. O bot deve responder automaticamente com uma saudação
3. Digite qualquer problema (ex: "Mouse não funciona")
4. O bot deve iniciar o processo de coleta de informações

### 4.3 Criar um chamado completo

Siga o fluxo completo respondendo às perguntas:

1. **Nome completo**: Seu nome
2. **Seu setor**: Ex: TI
3. **Setor de destino**: Ex: TI
4. **Tipo de problema**: Ex: Hardware
5. **Descrição**: Descreva o problema
6. **Evidências**: Envie fotos ou digite "não"

O chamado será criado automaticamente no sistema.

## Troubleshooting

### Webhook não verifica

**Problema**: Erro ao verificar webhook na Meta

**Solução**:
1. Confirme que o `META_WHATSAPP_VERIFY_TOKEN` está correto
2. Verifique se a URL está correta: `https://tickethpc.mocha.app/api/meta-whatsapp/webhook`
3. Certifique-se de que o app foi publicado no Mocha

### Bot não responde

**Problema**: Mensagens não são processadas

**Solução**:
1. Verifique se o webhook está subscrito ao evento `messages`
2. Confirme que o `META_WHATSAPP_TOKEN` está válido (não expirou)
3. Verifique os logs do Mocha para erros
4. Teste o endpoint de status: `/api/meta-whatsapp/status`

### Erro 403 ao enviar mensagem

**Problema**: Bot não consegue enviar mensagens

**Solução**:
1. Verifique se o Access Token tem as permissões necessárias
2. Confirme que o número de telefone está aprovado pela Meta
3. Verifique se não ultrapassou os limites de envio da Meta

### Arquivos não anexados

**Problema**: Fotos/documentos não aparecem no chamado

**Solução**:
1. Confirme que o R2 Bucket está configurado
2. Verifique se o Access Token tem permissão para download de mídia
3. Teste com arquivos menores (< 5MB)

## Diferenças entre Meta e Twilio

| Aspecto | Meta WhatsApp API | Twilio WhatsApp |
|---------|-------------------|-----------------|
| Configuração | Mais complexo | Mais simples |
| Aprovação | Processo de verificação da Meta | Sandbox ou aprovado |
| Custo | Gratuito (com limites) | Pago por mensagem |
| Formato de número | Apenas número (55119999999) | whatsapp:+55119999999 |
| Webhook | Direto da Meta | Via Twilio |
| Formato de mensagens | JSON da Meta | Form data |

## Links úteis

- Meta for Developers: https://developers.facebook.com/apps
- Documentação WhatsApp API: https://developers.facebook.com/docs/whatsapp
- WhatsApp Business Manager: https://business.facebook.com/
- Mocha Docs: https://docs.getmocha.com

## Próximos passos

Após configurar:

1. Teste o fluxo completo de criação de chamado
2. Configure templates de mensagem na Meta (opcional)
3. Monitore o uso através do Meta Business Manager
4. Configure alertas de quota no dashboard da Meta
