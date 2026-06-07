import { Hono } from 'hono';
import { 
  iniciarColeta, 
  processarResposta, 
  formatarResumo,
  type EstadoColeta,
  type DadosTicket 
} from '../services/telegram-coleta';
import { getDataHoraBrasil } from '../utils/timezone';

const metaWhatsapp = new Hono();

// Enviar mensagem via Meta WhatsApp Business API
async function enviarMensagemMeta(to: string, mensagem: string, env: any) {
  const accessToken = env.META_WHATSAPP_TOKEN;
  const phoneNumberId = env.META_WHATSAPP_PHONE_ID;
  
  console.log('[Meta WhatsApp] Enviando mensagem:', { to, mensagemLength: mensagem.length });
  
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: mensagem
        }
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('[Meta WhatsApp] Erro ao enviar mensagem:', {
        to,
        status: response.status,
        result
      });
    } else {
      console.log('[Meta WhatsApp] Mensagem enviada com sucesso:', { to, messageId: (result as any).messages?.[0]?.id });
    }
    
    return result;
  } catch (error) {
    console.error('[Meta WhatsApp] Erro ao enviar mensagem:', error);
    throw error;
  }
}

// Baixar arquivo do WhatsApp Meta e salvar no R2
async function baixarArquivoMeta(
  env: any,
  mediaId: string,
  fileName: string,
  chamadoId: number,
  autorId: string
): Promise<string> {
  try {
    const accessToken = env.META_WHATSAPP_TOKEN;

    // Primeiro, obter URL do arquivo
    const mediaInfoResponse = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!mediaInfoResponse.ok) {
      throw new Error('Erro ao obter informações do arquivo');
    }

    const mediaInfo: any = await mediaInfoResponse.json();
    const mediaUrl = mediaInfo.url;

    // Baixar arquivo
    const fileResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!fileResponse.ok) {
      throw new Error('Erro ao baixar arquivo');
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    
    // Determinar tipo do arquivo
    let contentType = mediaInfo.mime_type || 'application/octet-stream';
    
    // Gerar chave única no R2
    const timestamp = Date.now();
    const r2Key = `chamados/${chamadoId}/${timestamp}_${fileName}`;

    // Upload para R2
    await env.R2_BUCKET.put(r2Key, fileBuffer, {
      httpMetadata: {
        contentType: contentType,
      },
    });

    // Salvar no banco de dados
    await env.DB.prepare(`
      INSERT INTO anexos (chamado_id, nome_arquivo, url, tipo_arquivo, tamanho, autor_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      chamadoId,
      fileName,
      r2Key,
      contentType,
      fileBuffer.byteLength,
      autorId
    ).run();

    console.log('Arquivo Meta WhatsApp salvo:', { r2Key, fileName, tamanho: fileBuffer.byteLength });
    
    return r2Key;
  } catch (error) {
    console.error('Erro ao processar arquivo Meta WhatsApp:', error);
    throw error;
  }
}

// Webhook verification (GET)
metaWhatsapp.get('/webhook', async (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  
  const env = c.env as any;
  const verifyToken = env.META_WHATSAPP_VERIFY_TOKEN;
  
  console.log('[Meta WhatsApp] Verificação webhook:', { mode, token, challenge });
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Meta WhatsApp] Webhook verificado com sucesso');
    return c.text(challenge || '');
  } else {
    console.log('[Meta WhatsApp] Falha na verificação do webhook');
    return c.text('Forbidden', 403);
  }
});

// Webhook para receber mensagens (POST)
metaWhatsapp.post('/webhook', async (c) => {
  console.log('[Meta WhatsApp] Webhook recebido');
  const env = c.env as any;
  
  try {
    const body = await c.req.json();
    console.log('[Meta WhatsApp] Body:', JSON.stringify(body, null, 2));
    
    // Verificar se há mensagens
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    
    if (!messages || messages.length === 0) {
      console.log('[Meta WhatsApp] Sem mensagens, ignorando');
      return c.json({ status: 'ok' });
    }
    
    const message = messages[0];
    const from = message.from; // Número do telefone do remetente
    const messageType = message.type;
    const messageId = message.id;
    
    console.log('[Meta WhatsApp] Mensagem:', { from, type: messageType, id: messageId });
    
    const chatId = from;
    const userId = from;
    
    // Processar mensagem de texto
    if (messageType === 'text') {
      const text = message.text.body;
      console.log('[Meta WhatsApp] Texto:', text);
      
      // Verificar se há coleta ativa
      const coletaAtual = await env.DB.prepare(`
        SELECT coleta_ativa, dados_coletados, campo_atual, mensagem
        FROM whatsapp_conversas 
        WHERE chat_id = ? AND coleta_ativa = 1
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(chatId).first();

      if (coletaAtual) {
        // Há uma coleta em andamento
        let dadosColetados = {};
        try {
          dadosColetados = coletaAtual.dados_coletados ? JSON.parse(coletaAtual.dados_coletados) : {};
        } catch (error) {
          console.error('Erro ao parsear dados_coletados:', error);
          dadosColetados = {};
        }
        
        const estadoColeta: EstadoColeta = {
          ativa: true,
          dados: dadosColetados,
          campo_atual: coletaAtual.campo_atual,
          mensagem_inicial: coletaAtual.mensagem
        };

        const campoAntes = estadoColeta.campo_atual;
        const resultado = processarResposta(estadoColeta, text);

        // Salvar mensagem do usuário
        await env.DB.prepare(`
          INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
          VALUES (?, ?, ?, ?, 'usuario')
        `).bind(from, chatId, from, text).run();

        if (resultado.completo) {
          const respostaNormalizada = text.toLowerCase().trim();
          const pularEvidencias = ['não', 'nao', 'pular', 'pronto', 'n', 'skip'].includes(respostaNormalizada);
          
          if (campoAntes === 'evidencias' && (pularEvidencias || (resultado.estado.dados.media_urls && resultado.estado.dados.media_urls.length > 0))) {
            try {
              await criarTicketComDados(env, chatId, from, resultado.estado.dados, c);
            } catch (error) {
              console.error('Erro ao criar ticket:', error);
              const mensagemErro = 'Desculpe, ocorreu um erro ao criar seu chamado. Nossa equipe foi notificada.';
              await enviarMensagemMeta(from, mensagemErro, env);
            }
            
            await env.DB.prepare(`
              UPDATE whatsapp_conversas 
              SET coleta_ativa = 0 
              WHERE chat_id = ? AND coleta_ativa = 1
            `).bind(chatId).run();
          }

        } else {
          // Atualizar estado e enviar próxima pergunta
          await env.DB.prepare(`
            UPDATE whatsapp_conversas 
            SET dados_coletados = ?, campo_atual = ?
            WHERE chat_id = ? AND coleta_ativa = 1
          `).bind(
            JSON.stringify(resultado.estado.dados),
            resultado.estado.campo_atual,
            chatId
          ).run();

          await enviarMensagemMeta(from, resultado.proximaPergunta!, env);
          
          await env.DB.prepare(`
            INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
            VALUES (?, ?, ?, ?, 'assistente')
          `).bind(from, chatId, from, resultado.proximaPergunta).run();
        }

        return c.json({ status: 'ok' });
      }

      // Não há coleta ativa - verificar se deve iniciar
      await env.DB.prepare(`
        INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
        VALUES (?, ?, ?, ?, 'usuario')
      `).bind(from, chatId, from, text).run();

      console.log('[Meta WhatsApp] Verificando se deve criar ticket...');
      
      const mensagemLower = text.toLowerCase().trim();
      const ehSaudacao = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'opa', 'e aí', 'e ai'].includes(mensagemLower);
      
      let criarTicket = !ehSaudacao;
      console.log('[Meta WhatsApp] Mensagem:', mensagemLower, '| É saudação?', ehSaudacao, '| Criar ticket?', criarTicket);

      if (criarTicket) {
        console.log('[Meta WhatsApp] Iniciando coleta de dados');
        const estadoColeta = iniciarColeta(text);
        
        await env.DB.prepare(`
          INSERT INTO whatsapp_conversas (
            telefone, chat_id, phone_number, mensagem, tipo, 
            coleta_ativa, dados_coletados, campo_atual
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(from, chatId, from, text, 'sistema', 1, '{}', estadoColeta.campo_atual).run();

        const primeiraPergunta = 'Vou coletar algumas informações para abrir o chamado.\n\nQual é o seu nome completo?';

        await enviarMensagemMeta(from, primeiraPergunta, env);
        
        await env.DB.prepare(`
          INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
          VALUES (?, ?, ?, ?, 'assistente')
        `).bind(from, chatId, from, primeiraPergunta).run();
      } else {
        console.log('[Meta WhatsApp] Apenas saudação');
        
        const respostaSimples = 'Olá! 👋\n\nSou o assistente do TicketHPC. Estou aqui para ajudar!\n\nDescreva seu problema ou dúvida que vou iniciar um chamado para você.';
        
        await enviarMensagemMeta(from, respostaSimples, env);
        
        await env.DB.prepare(`
          INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
          VALUES (?, ?, ?, ?, 'assistente')
        `).bind(from, chatId, from, respostaSimples).run();
      }

      return c.json({ status: 'ok' });
      
    } else if (messageType === 'image' || messageType === 'document' || messageType === 'video' || messageType === 'audio') {
      // Processar mídia
      console.log('[Meta WhatsApp] Processando mídia:', messageType);
      
      const media = message[messageType];
      const mediaId = media.id;
      const mimeType = media.mime_type;
      
      // Verificar se existe coleta ativa
      const coletaAtiva = await env.DB.prepare(`
        SELECT coleta_ativa, dados_coletados, campo_atual, chamado_id 
        FROM whatsapp_conversas 
        WHERE chat_id = ? AND coleta_ativa = 1
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(chatId).first();

      if (coletaAtiva && coletaAtiva.campo_atual === 'evidencias') {
        // Está na etapa de coleta de evidências
        try {
          let fileName = `arquivo_${Date.now()}`;
          if (messageType === 'image') {
            const ext = mimeType?.split('/')[1] || 'jpg';
            fileName = `foto_${Date.now()}.${ext}`;
          } else if (messageType === 'document') {
            fileName = media.filename || `documento_${Date.now()}.pdf`;
          } else if (messageType === 'video') {
            fileName = `video_${Date.now()}.mp4`;
          } else if (messageType === 'audio') {
            fileName = `audio_${Date.now()}.ogg`;
          }
          
          const mediaData = JSON.stringify({ media_id: mediaId, file_name: fileName, mime_type: mimeType });

          // Atualizar dados coletados
          let dadosColetados: DadosTicket = {};
          try {
            dadosColetados = coletaAtiva.dados_coletados ? JSON.parse(coletaAtiva.dados_coletados) : {};
          } catch (error) {
            console.error('Erro ao parsear dados_coletados:', error);
            dadosColetados = {};
          }

          if (!dadosColetados.media_urls) {
            dadosColetados.media_urls = [];
          }
          dadosColetados.media_urls.push(mediaData);

          await env.DB.prepare(`
            UPDATE whatsapp_conversas 
            SET dados_coletados = ?
            WHERE chat_id = ? AND coleta_ativa = 1
          `).bind(JSON.stringify(dadosColetados), chatId).run();

          const attachmentMessage = '📎 Arquivo recebido! Pode enviar mais ou digite "pronto" quando terminar.';
          await enviarMensagemMeta(from, attachmentMessage, env);
          
          await env.DB.prepare(`
            INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
            VALUES (?, ?, ?, ?, 'sistema')
          `).bind(from, chatId, from, attachmentMessage).run();
          
        } catch (error) {
          console.error('Erro ao processar anexo durante coleta:', error);
          const errorMsg = 'Desculpe, não consegui processar o arquivo enviado.';
          await enviarMensagemMeta(from, errorMsg, env);
        }
      } else if (coletaAtiva && coletaAtiva.chamado_id) {
        // Coleta já finalizada, há chamado criado
        try {
          let fileName = `arquivo_${Date.now()}`;
          if (messageType === 'image') {
            const ext = mimeType?.split('/')[1] || 'jpg';
            fileName = `foto_${Date.now()}.${ext}`;
          } else if (messageType === 'document') {
            fileName = media.filename || `documento_${Date.now()}.pdf`;
          }
          
          await baixarArquivoMeta(env, mediaId, fileName, coletaAtiva.chamado_id, userId);

          const attachmentMessage = '📎 Arquivo anexado ao chamado!';
          await enviarMensagemMeta(from, attachmentMessage, env);
          
          await env.DB.prepare(`
            INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo, chamado_id)
            VALUES (?, ?, ?, ?, 'sistema', ?)
          `).bind(from, chatId, from, attachmentMessage, coletaAtiva.chamado_id).run();
          
        } catch (error) {
          console.error('Erro ao processar anexo:', error);
          const errorMsg = 'Desculpe, não consegui processar o arquivo enviado.';
          await enviarMensagemMeta(from, errorMsg, env);
        }
      } else {
        const noTicketMsg = 'Por favor, primeiro inicie a criação de um chamado.';
        await enviarMensagemMeta(from, noTicketMsg, env);
      }

      return c.json({ status: 'ok' });
    }
    
    return c.json({ status: 'ok' });

  } catch (error) {
    console.error('[Meta WhatsApp] Erro no webhook:', error);
    return c.json({ error: 'Internal error' }, 200);
  }
});

// Função auxiliar para criar ticket
async function criarTicketComDados(
  env: any,
  chatId: string,
  phoneNumber: string,
  dados: DadosTicket,
  c?: any
) {
  console.log('Criando ticket Meta WhatsApp com dados:', dados);
  
  const userId = phoneNumber;
  
  let userProfile = await env.DB.prepare(`
    SELECT * FROM user_profiles WHERE whatsapp_phone = ?
  `).bind(phoneNumber).first();

  if (!userProfile) {
    console.log('Criando novo perfil para WhatsApp:', phoneNumber);
    const email = `whatsapp_${phoneNumber.replace(/[^0-9]/g, '')}@whatsapp.user`;
    const nomeUsuario = dados.nome_solicitante || 'Usuário WhatsApp';
    
    await env.DB.prepare(`
      INSERT INTO user_profiles (user_id, email, nome, perfil, whatsapp_phone)
      VALUES (?, ?, ?, 'solicitante', ?)
    `).bind(userId, email, nomeUsuario, phoneNumber).run();

    userProfile = await env.DB.prepare(`
      SELECT * FROM user_profiles WHERE whatsapp_phone = ?
    `).bind(phoneNumber).first();
  }

  const categoria = await env.DB.prepare(`
    SELECT id FROM categorias WHERE nome LIKE ? LIMIT 1
  `).bind(`%${dados.tipo_problema}%`).first();

  const setor = await env.DB.prepare(`
    SELECT id FROM setores WHERE nome LIKE ? LIMIT 1
  `).bind(`%${dados.setor_destino}%`).first();

  const sla = await env.DB.prepare(`
    SELECT id FROM slas WHERE prioridade = 'P3' LIMIT 1
  `).first();

  const grupoAtendimento = await env.DB.prepare(`
    SELECT id FROM grupos_atendimento WHERE ativo = 1 LIMIT 1
  `).first();

  const unidade = await env.DB.prepare(`
    SELECT id FROM unidades WHERE ativo = 1 LIMIT 1
  `).first();

  const numeroTicket = `TKT-${Date.now().toString().slice(-6)}`;
  const descricaoCurta = dados.descricao_problema?.substring(0, 50) || 'Sem descrição';
  const titulo = `${dados.tipo_problema || 'Incidente'} - ${descricaoCurta}`;

  const dataHoraBrasil = getDataHoraBrasil();
  
  const ticketResult = await env.DB.prepare(`
    INSERT INTO chamados (
      numero, tipo, titulo, descricao, status, prioridade,
      solicitante_id, solicitante_nome, solicitante_email, solicitante_setor,
      categoria_id, sla_id, grupo_responsavel_id, unidade_id, setor_destino_id,
      telegram_chat_id, origem, data_abertura, created_at, updated_at
    ) VALUES (?, 'Incidente', ?, ?, 'Novo', 'P3', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?)
  `).bind(
    numeroTicket,
    titulo,
    dados.descricao_problema || 'Sem descrição detalhada',
    userProfile.id,
    dados.nome_solicitante || userProfile.nome,
    userProfile.email,
    dados.setor_solicitante || 'Não informado',
    categoria?.id || null,
    sla?.id || null,
    grupoAtendimento?.id || null,
    unidade?.id || null,
    setor?.id || null,
    chatId,
    dataHoraBrasil,
    dataHoraBrasil,
    dataHoraBrasil
  ).run();

  console.log('Chamado Meta WhatsApp criado:', ticketResult.meta.last_row_id);

  // Processar mídias anexadas
  if (dados.media_urls && dados.media_urls.length > 0) {
    for (const mediaDataStr of dados.media_urls) {
      try {
        const mediaData = JSON.parse(mediaDataStr);
        await baixarArquivoMeta(env, mediaData.media_id, mediaData.file_name, ticketResult.meta.last_row_id, userId);
      } catch (error) {
        console.error('Erro ao anexar mídia:', error);
      }
    }
  }

  await env.DB.prepare(`
    UPDATE whatsapp_conversas 
    SET chamado_id = ? 
    WHERE chat_id = ? AND chamado_id IS NULL
  `).bind(ticketResult.meta.last_row_id, chatId).run();

  await env.DB.prepare(`
    INSERT INTO historico (chamado_id, user_id, user_nome, acao, detalhes)
    VALUES (?, ?, ?, 'criado', ?)
  `).bind(
    ticketResult.meta.last_row_id, 
    userProfile.id,
    dados.nome_solicitante,
    JSON.stringify({ origem: 'whatsapp_meta', dados_coletados: dados })
  ).run();

  const resumo = formatarResumo(dados, 'markdown');
  const numMidias = dados.media_urls ? dados.media_urls.length : 0;
  const midiasTexto = numMidias > 0 ? `\n📎 ${numMidias} arquivo(s) anexado(s)` : '';
  const mensagemFinal = `${resumo}${midiasTexto}\n\n✅ *Chamado registrado com sucesso!*\n📋 *Número:* ${numeroTicket}\n\n💡 *Dica:* Você ainda pode enviar mais fotos ou documentos que serão anexados automaticamente ao chamado.\n\nNossa equipe entrará em contato em breve.`;
  
  await env.DB.prepare(`
    INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo, chamado_id)
    VALUES (?, ?, ?, ?, 'assistente', ?)
  `).bind(phoneNumber, chatId, phoneNumber, mensagemFinal, ticketResult.meta.last_row_id).run();

  await enviarMensagemMeta(phoneNumber, mensagemFinal, env);

  // Verificar se o usuário tem conta Google vinculada
  const temGoogleVinculado = userProfile.user_id !== userId;
  
  if (!temGoogleVinculado && c) {
    const requestUrl = new URL(c.req.url);
    const baseUrl = `https://${requestUrl.host}`;
    const loginUrl = `${baseUrl}/?whatsapp_phone=${encodeURIComponent(phoneNumber)}`;
    
    const mensagemVinculacao = `🔗 *Vincule sua conta para mais recursos!*\n\nPara acessar o sistema web, acompanhar seus chamados online, avaliar atendimentos e usar o chat interno, faça login com sua conta Google:\n\n👉 ${loginUrl}\n\nIsso vai vincular sua conta do WhatsApp à sua conta Google automaticamente.`;
    
    await env.DB.prepare(`
      INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo, chamado_id)
      VALUES (?, ?, ?, ?, 'assistente', ?)
    `).bind(phoneNumber, chatId, phoneNumber, mensagemVinculacao, ticketResult.meta.last_row_id).run();
    
    await enviarMensagemMeta(phoneNumber, mensagemVinculacao, env);
  }
}

// Status do webhook
metaWhatsapp.get('/status', async (c) => {
  const env = c.env as any;
  
  if (!env.META_WHATSAPP_TOKEN || !env.META_WHATSAPP_PHONE_ID || !env.META_WHATSAPP_VERIFY_TOKEN) {
    return c.html(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Configurar WhatsApp Meta</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 700px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
          .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #25D366; margin-bottom: 20px; }
          .error { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .step { margin: 15px 0; padding-left: 25px; }
          code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
          .info { background: #e7f3ff; border: 1px solid #0088cc; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>⚙️ Configuração WhatsApp Meta</h1>
          <div class="error">
            <strong>Secrets não configurados</strong>
          </div>
          <p>Configure os seguintes secrets no Mocha (Settings):</p>
          <div class="step">1. <code>META_WHATSAPP_TOKEN</code> - Access Token da Meta</div>
          <div class="step">2. <code>META_WHATSAPP_PHONE_ID</code> - ID do número de telefone</div>
          <div class="step">3. <code>META_WHATSAPP_VERIFY_TOKEN</code> - Token de verificação (crie um aleatório)</div>
          
          <div class="info">
            <h3>📋 Próximos passos:</h3>
            <div class="step">1. Configure os secrets acima</div>
            <div class="step">2. No Meta Business Suite, configure o webhook:</div>
            <div class="step" style="padding-left: 50px;">URL: <code>${new URL(c.req.url).origin}/api/meta-whatsapp/webhook</code></div>
            <div class="step" style="padding-left: 50px;">Verify Token: O mesmo que você definiu em META_WHATSAPP_VERIFY_TOKEN</div>
            <div class="step">3. Recarregue esta página para verificar</div>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  return c.html(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WhatsApp Meta Configurado</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 700px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #25D366; margin-bottom: 20px; }
        .success { background: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .info { background: #e7f3ff; border: 1px solid #0088cc; padding: 15px; border-radius: 4px; margin: 20px 0; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; display: block; margin: 10px 0; }
        .step { margin: 10px 0; padding-left: 25px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>✅ WhatsApp Meta Configurado!</h1>
        <div class="success">
          <strong>Secrets configurados:</strong><br>
          ✓ META_WHATSAPP_TOKEN<br>
          ✓ META_WHATSAPP_PHONE_ID<br>
          ✓ META_WHATSAPP_VERIFY_TOKEN
        </div>
        <div class="info">
          <h3>🔗 Configure o Webhook na Meta:</h3>
          <div class="step">1. Acesse: <a href="https://developers.facebook.com/apps" target="_blank">Meta for Developers</a></div>
          <div class="step">2. Selecione seu App</div>
          <div class="step">3. Vá em WhatsApp → Configuration</div>
          <div class="step">4. Configure o webhook:</div>
          <code>${new URL(c.req.url).origin}/api/meta-whatsapp/webhook</code>
          <div class="step">5. Verify Token: ${env.META_WHATSAPP_VERIFY_TOKEN}</div>
          <div class="step">6. Subscribe aos eventos: messages</div>
        </div>
        <div class="info">
          <h3>📱 Teste a Integração:</h3>
          <div class="step">1. Envie uma mensagem para seu número WhatsApp Business</div>
          <div class="step">2. O bot deve responder automaticamente</div>
          <div class="step">3. Siga as instruções para criar um chamado</div>
        </div>
      </div>
    </body>
    </html>
  `);
});

export default metaWhatsapp;
