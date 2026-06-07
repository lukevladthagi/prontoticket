import { Hono } from 'hono';
import { 
  iniciarColeta, 
  processarResposta, 
  formatarResumo,
  type EstadoColeta,
  type DadosTicket 
} from '../services/telegram-coleta';
import { getDataHoraBrasil } from '../utils/timezone';

const whatsapp = new Hono();

// Enviar mensagem via Twilio WhatsApp
async function enviarMensagemWhatsApp(to: string, mensagem: string, env: any) {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_WHATSAPP_NUMBER;
  
  // Garantir formato correto: whatsapp:+NUMERO (sem espaços, com +)
  let destinatario = to;
  if (!destinatario.startsWith('whatsapp:')) {
    // Se não tem o prefixo whatsapp:, adicionar
    destinatario = 'whatsapp:' + (destinatario.startsWith('+') ? destinatario : '+' + destinatario);
  } else {
    // Já tem whatsapp:, garantir que não tem espaço e tem +
    destinatario = destinatario.replace(/whatsapp:\s*/i, 'whatsapp:');
    if (!destinatario.includes('+')) {
      destinatario = destinatario.replace('whatsapp:', 'whatsapp:+');
    }
  }
  
  console.log('[WhatsApp] Enviando mensagem:', { to: destinatario, from, mensagemLength: mensagem.length });
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  try {
    const auth = btoa(`${accountSid}:${authToken}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: from,
        To: destinatario,
        Body: mensagem
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('[WhatsApp] Erro ao enviar mensagem:', {
        to: destinatario,
        status: response.status,
        result
      });
    } else {
      console.log('[WhatsApp] Mensagem enviada com sucesso:', { to: destinatario, sid: (result as any).sid });
    }
    
    return result;
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar mensagem:', error);
    throw error;
  }
}



// Baixar arquivo do WhatsApp e salvar no R2
async function baixarArquivoWhatsApp(
  env: any,
  mediaUrl: string,
  fileName: string,
  chamadoId: number,
  autorId: string
): Promise<string> {
  try {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const auth = btoa(`${accountSid}:${authToken}`);

    // Baixar arquivo do Twilio
    const fileResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    if (!fileResponse.ok) {
      throw new Error('Erro ao baixar arquivo do WhatsApp');
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    
    // Determinar tipo do arquivo
    let contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
    
    // Ajustar content-type baseado na extensão
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (fileName.endsWith('.png')) {
      contentType = 'image/png';
    } else if (fileName.endsWith('.gif')) {
      contentType = 'image/gif';
    } else if (fileName.endsWith('.webp')) {
      contentType = 'image/webp';
    } else if (fileName.endsWith('.pdf')) {
      contentType = 'application/pdf';
    }
    
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

    console.log('Arquivo WhatsApp salvo:', { r2Key, fileName, tamanho: fileBuffer.byteLength });
    
    return r2Key;
  } catch (error) {
    console.error('Erro ao processar arquivo WhatsApp:', error);
    throw error;
  }
}

// Teste simples do webhook
whatsapp.post('/webhook/test', async (c) => {
  const env = c.env as any;
  return c.json({ 
    status: 'ok', 
    message: 'Webhook funcionando',
    env_check: {
      has_db: !!env.DB,
      has_twilio_sid: !!env.TWILIO_ACCOUNT_SID,
      has_twilio_token: !!env.TWILIO_AUTH_TOKEN,
      has_twilio_number: !!env.TWILIO_WHATSAPP_NUMBER
    }
  });
});

// Webhook do WhatsApp - GET para validação do Twilio
whatsapp.get('/webhook', async (c) => {
  console.log('[WhatsApp] GET /webhook - Validação do Twilio');
  return c.text('OK');
});

// Webhook do WhatsApp
whatsapp.post('/webhook', async (c) => {
  console.log('[WhatsApp] !!!!! INÍCIO DA FUNÇÃO WEBHOOK !!!!!');
  const env = c.env as any;
  console.log('[WhatsApp] env definido:', !!env);
  
  try {
    console.log('[WhatsApp] ========== DENTRO DO TRY ==========');
    const formData = await c.req.formData();
    console.log('[WhatsApp] Form data parseado');
    
    // Extrair dados do webhook do Twilio
    const from = formData.get('From') as string; // whatsapp:+5511999999999
    const body = formData.get('Body') as string || '';
    const numMedia = parseInt(formData.get('NumMedia') as string || '0');
    
    console.log('[WhatsApp] RAW From:', JSON.stringify(from));
    console.log('[WhatsApp] RAW Body:', JSON.stringify(body));
    console.log('[WhatsApp] NumMedia:', numMedia);
    console.log('[WhatsApp] Secrets:', {
      has_sid: !!env.TWILIO_ACCOUNT_SID,
      has_token: !!env.TWILIO_AUTH_TOKEN,
      has_number: !!env.TWILIO_WHATSAPP_NUMBER,
      number: env.TWILIO_WHATSAPP_NUMBER
    });
    
    if (!from) {
      console.log('[WhatsApp] Sem From, ignorando');
      return c.text('OK');
    }

    // Remover prefixo "whatsapp:" do número e todos os espaços
    let phoneNumber = from.replace(/whatsapp:\s*/i, '').trim();
    
    // Garantir que o número tem o prefixo +
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+' + phoneNumber;
    }
    
    const chatId = phoneNumber;
    const userId = phoneNumber;
    
    console.log('[WhatsApp] Phone processado:', JSON.stringify(phoneNumber));
    console.log('[WhatsApp] Chat ID:', JSON.stringify(chatId));

    // Processar mídias anexadas
    if (numMedia > 0) {
      let attachmentMessage = '';
      
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
          const mediaUrls = [];
          
          for (let i = 0; i < numMedia; i++) {
            const mediaUrl = formData.get(`MediaUrl${i}`) as string;
            const mediaContentType = formData.get(`MediaContentType${i}`) as string;
            
            if (mediaUrl) {
              // Determinar nome do arquivo
              let fileName = `arquivo_${Date.now()}_${i}`;
              if (mediaContentType?.startsWith('image/')) {
                const ext = mediaContentType.split('/')[1] || 'jpg';
                fileName = `foto_${Date.now()}_${i}.${ext}`;
              } else if (mediaContentType === 'application/pdf') {
                fileName = `documento_${Date.now()}_${i}.pdf`;
              }
              
              mediaUrls.push(JSON.stringify({ media_url: mediaUrl, file_name: fileName }));
            }
          }

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
          dadosColetados.media_urls.push(...mediaUrls);

          await env.DB.prepare(`
            UPDATE whatsapp_conversas 
            SET dados_coletados = ?
            WHERE chat_id = ? AND coleta_ativa = 1
          `).bind(JSON.stringify(dadosColetados), chatId).run();

          attachmentMessage = `📎 ${numMedia} arquivo(s) recebido(s)! Pode enviar mais ou digite "pronto" quando terminar.`;
          await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, attachmentMessage, env);
          
          await env.DB.prepare(`
            INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
            VALUES (?, ?, ?, ?, 'sistema')
          `).bind(phoneNumber, chatId, phoneNumber, attachmentMessage).run();
          
        } catch (error) {
          console.error('Erro ao processar anexo durante coleta:', error);
          const errorMsg = 'Desculpe, não consegui processar o arquivo enviado.';
          await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, errorMsg, env);
        }
      } else if (coletaAtiva && coletaAtiva.chamado_id) {
        // Coleta já finalizada, há chamado criado
        try {
          for (let i = 0; i < numMedia; i++) {
            const mediaUrl = formData.get(`MediaUrl${i}`) as string;
            const mediaContentType = formData.get(`MediaContentType${i}`) as string;
            
            if (mediaUrl) {
              let fileName = `arquivo_${Date.now()}_${i}`;
              if (mediaContentType?.startsWith('image/')) {
                const ext = mediaContentType.split('/')[1] || 'jpg';
                fileName = `foto_${Date.now()}_${i}.${ext}`;
              } else if (mediaContentType === 'application/pdf') {
                fileName = `documento_${Date.now()}_${i}.pdf`;
              }
              
              await baixarArquivoWhatsApp(env, mediaUrl, fileName, coletaAtiva.chamado_id, userId);
            }
          }

          attachmentMessage = `📎 ${numMedia} arquivo(s) anexado(s) ao chamado!`;
          await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, attachmentMessage, env);
          
          await env.DB.prepare(`
            INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo, chamado_id)
            VALUES (?, ?, ?, ?, 'sistema', ?)
          `).bind(phoneNumber, chatId, phoneNumber, attachmentMessage, coletaAtiva.chamado_id).run();
          
        } catch (error) {
          console.error('Erro ao processar anexo:', error);
          const errorMsg = 'Desculpe, não consegui processar o arquivo enviado.';
          await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, errorMsg, env);
        }
      } else {
        const noTicketMsg = 'Por favor, primeiro inicie a criação de um chamado.';
        await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, noTicketMsg, env);
      }
      
      // Se não há texto, retornar aqui
      if (!body) {
        return c.text('OK');
      }
    }

    // Processar mensagem de texto
    if (!body) {
      return c.text('OK');
    }

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
      const resultado = processarResposta(estadoColeta, body);

      // Salvar mensagem do usuário
      await env.DB.prepare(`
        INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
        VALUES (?, ?, ?, ?, 'usuario')
      `).bind(phoneNumber, chatId, phoneNumber, body).run();

      if (resultado.completo) {
        const respostaNormalizada = body.toLowerCase().trim();
        const pularEvidencias = ['não', 'nao', 'pular', 'pronto', 'n', 'skip'].includes(respostaNormalizada);
        
        if (campoAntes === 'evidencias' && (pularEvidencias || (resultado.estado.dados.media_urls && resultado.estado.dados.media_urls.length > 0))) {
          try {
            await criarTicketComDados(env, chatId, phoneNumber, resultado.estado.dados, c);
          } catch (error) {
            console.error('Erro ao criar ticket:', error);
            const mensagemErro = 'Desculpe, ocorreu um erro ao criar seu chamado. Nossa equipe foi notificada.';
            await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, mensagemErro, env);
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

        // Enviar apenas a próxima pergunta, sem confirmações intermediárias
        await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, resultado.proximaPergunta!, env);
        
        await env.DB.prepare(`
          INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
          VALUES (?, ?, ?, ?, 'assistente')
        `).bind(phoneNumber, chatId, phoneNumber, resultado.proximaPergunta).run();
      }

      return c.text('OK');
    }

    // Não há coleta ativa - verificar se deve iniciar
    await env.DB.prepare(`
      INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
      VALUES (?, ?, ?, ?, 'usuario')
    `).bind(phoneNumber, chatId, phoneNumber, body).run();

    console.log('[WhatsApp] Verificando se deve criar ticket...');
    
    // Verificação simples: criar ticket se não for apenas saudação
    const mensagemLower = body.toLowerCase().trim();
    const ehSaudacao = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'opa', 'e aí', 'e ai'].includes(mensagemLower);
    
    let criarTicket = !ehSaudacao;
    console.log('[WhatsApp] Mensagem:', mensagemLower, '| É saudação?', ehSaudacao, '| Criar ticket?', criarTicket);

    if (criarTicket) {
      console.log('[WhatsApp] Iniciando coleta de dados');
      const estadoColeta = iniciarColeta(body);
      
      try {
        await env.DB.prepare(`
          INSERT INTO whatsapp_conversas (
            telefone, chat_id, phone_number, mensagem, tipo, 
            coleta_ativa, dados_coletados, campo_atual
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(phoneNumber, chatId, phoneNumber, body, 'sistema', 1, '{}', estadoColeta.campo_atual).run();
        console.log('[WhatsApp] Estado de coleta salvo no banco');
      } catch (error) {
        console.error('[WhatsApp] ERRO ao salvar estado de coleta:', error);
        throw error;
      }

      const primeiraPergunta = 'Vou coletar algumas informações para abrir o chamado.\n\nQual é o seu nome completo?';

      // Enviar primeira pergunta
      console.log('[WhatsApp] Enviando primeira pergunta');
      console.log('[WhatsApp] Número de destino:', `whatsapp:${phoneNumber}`);
      console.log('[WhatsApp] Tem TWILIO_ACCOUNT_SID?', !!env.TWILIO_ACCOUNT_SID);
      console.log('[WhatsApp] Tem TWILIO_AUTH_TOKEN?', !!env.TWILIO_AUTH_TOKEN);
      console.log('[WhatsApp] TWILIO_WHATSAPP_NUMBER:', env.TWILIO_WHATSAPP_NUMBER);
      
      try {
        const resultado = await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, primeiraPergunta, env);
        console.log('[WhatsApp] Resultado do envio:', JSON.stringify(resultado));
      } catch (error) {
        console.error('[WhatsApp] ERRO CRÍTICO ao enviar mensagem:', error);
        if (error instanceof Error) {
          console.error('[WhatsApp] Stack:', error.stack);
        }
        throw error;
      }
      
      try {
        await env.DB.prepare(`
          INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
          VALUES (?, ?, ?, ?, 'assistente')
        `).bind(phoneNumber, chatId, phoneNumber, primeiraPergunta).run();
        console.log('[WhatsApp] Primeira pergunta salva no banco');
      } catch (error) {
        console.error('[WhatsApp] ERRO ao salvar pergunta no banco:', error);
      }
    } else {
      console.log('[WhatsApp] ===== APENAS SAUDAÇÃO =====');
      console.log('[WhatsApp] Vai responder de forma simples');
      
      // Resposta simples para saudações
      const respostaSimples = 'Olá! 👋\n\nSou o assistente do TicketHPC. Estou aqui para ajudar!\n\nDescreva seu problema ou dúvida que vou iniciar um chamado para você.';
      
      // Enviar resposta
      try {
        console.log('[WhatsApp] ANTES de enviarMensagemWhatsApp');
        console.log('[WhatsApp] Destino:', `whatsapp:${phoneNumber}`);
        console.log('[WhatsApp] Mensagem length:', respostaSimples.length);
        
        const resultado = await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, respostaSimples, env);
        
        console.log('[WhatsApp] DEPOIS de enviarMensagemWhatsApp');
        console.log('[WhatsApp] Resultado completo:', JSON.stringify(resultado, null, 2));
      } catch (error) {
        console.error('[WhatsApp] ===== ERRO CRÍTICO AO ENVIAR =====');
        console.error('[WhatsApp] Error object:', error);
        console.error('[WhatsApp] Error type:', typeof error);
        if (error instanceof Error) {
          console.error('[WhatsApp] Error name:', error.name);
          console.error('[WhatsApp] Error message:', error.message);
          console.error('[WhatsApp] Error stack:', error.stack);
        }
        throw error;
      }
      
      try {
        await env.DB.prepare(`
          INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
          VALUES (?, ?, ?, ?, 'assistente')
        `).bind(phoneNumber, chatId, phoneNumber, respostaSimples).run();
        console.log('[WhatsApp] Resposta salva no banco');
      } catch (error) {
        console.error('[WhatsApp] ERRO ao salvar resposta no banco:', error);
      }
    }

    return c.text('OK');

  } catch (error) {
    console.error('[WhatsApp] !!!!! ERRO NO CATCH !!!!!');
    console.error('[WhatsApp] ERRO:', error);
    if (error instanceof Error) {
      console.error('[WhatsApp] Stack:', error.stack);
      console.error('[WhatsApp] Message:', error.message);
      console.error('[WhatsApp] Name:', error.name);
    }
    // Retornar 200 OK para não bloquear Twilio, mas com mensagem de erro
    const errorResponse = { error: 'Internal error', details: error instanceof Error ? error.message : String(error) };
    console.error('[WhatsApp] Retornando erro:', errorResponse);
    return c.json(errorResponse, 200);
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
  console.log('Criando ticket WhatsApp com dados:', dados);
  
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
  `).bind(`%${dados.setor_solicitante}%`).first();

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
      origem, data_abertura, created_at, updated_at
    ) VALUES (?, 'Incidente', ?, ?, 'Novo', 'P3', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?)
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
    dataHoraBrasil,
    dataHoraBrasil,
    dataHoraBrasil
  ).run();

  console.log('Chamado WhatsApp criado:', ticketResult.meta.last_row_id);

  // Processar mídias anexadas
  if (dados.media_urls && dados.media_urls.length > 0) {
    for (const mediaDataStr of dados.media_urls) {
      try {
        const mediaData = JSON.parse(mediaDataStr);
        await baixarArquivoWhatsApp(env, mediaData.media_url, mediaData.file_name, ticketResult.meta.last_row_id, userId);
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
    JSON.stringify({ origem: 'whatsapp', dados_coletados: dados })
  ).run();

  const resumo = formatarResumo(dados, 'markdown');
  const numMidias = dados.media_urls ? dados.media_urls.length : 0;
  const midiasTexto = numMidias > 0 ? `\n📎 ${numMidias} arquivo(s) anexado(s)` : '';
  const mensagemFinal = `${resumo}${midiasTexto}\n\n✅ *Chamado registrado com sucesso!*\n📋 *Número:* ${numeroTicket}\n\n💡 *Dica:* Você ainda pode enviar mais fotos ou documentos que serão anexados automaticamente ao chamado.\n\nNossa equipe entrará em contato em breve.`;
  
  await env.DB.prepare(`
    INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo, chamado_id)
    VALUES (?, ?, ?, ?, 'assistente', ?)
  `).bind(phoneNumber, chatId, phoneNumber, mensagemFinal, ticketResult.meta.last_row_id).run();

  await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, mensagemFinal, env);

  // Verificar se o usuário tem conta Google vinculada
  const temGoogleVinculado = userProfile.user_id !== userId; // Se user_id != whatsapp_phone, já está vinculado
  
  if (!temGoogleVinculado && c) {
    // Enviar mensagem com link para vincular conta Google
    const requestUrl = new URL(c.req.url);
    const baseUrl = `https://${requestUrl.host}`;
    const loginUrl = `${baseUrl}/?whatsapp_phone=${encodeURIComponent(phoneNumber)}`;
    
    const mensagemVinculacao = `🔗 *Vincule sua conta para mais recursos!*\n\nPara acessar o sistema web, acompanhar seus chamados online, avaliar atendimentos e usar o chat interno, faça login com sua conta Google:\n\n👉 ${loginUrl}\n\nIsso vai vincular sua conta do WhatsApp à sua conta Google automaticamente.`;
    
    await env.DB.prepare(`
      INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo, chamado_id)
      VALUES (?, ?, ?, ?, 'assistente', ?)
    `).bind(phoneNumber, chatId, phoneNumber, mensagemVinculacao, ticketResult.meta.last_row_id).run();
    
    await enviarMensagemWhatsApp(`whatsapp:${phoneNumber}`, mensagemVinculacao, env);
  }
}

// Status do webhook
whatsapp.get('/status', async (c) => {
  const env = c.env as any;
  
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_NUMBER) {
    return c.html(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Configurar WhatsApp</title>
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
          <h1>⚙️ Configuração WhatsApp</h1>
          <div class="error">
            <strong>Secrets não configurados</strong>
          </div>
          <p>Configure os seguintes secrets no Mocha (Settings):</p>
          <div class="step">1. <code>TWILIO_ACCOUNT_SID</code> - Account SID do Twilio</div>
          <div class="step">2. <code>TWILIO_AUTH_TOKEN</code> - Auth Token do Twilio</div>
          <div class="step">3. <code>TWILIO_WHATSAPP_NUMBER</code> - Número WhatsApp (formato: whatsapp:+5511999999999)</div>
          
          <div class="info">
            <h3>📋 Próximos passos:</h3>
            <div class="step">1. Configure os secrets acima</div>
            <div class="step">2. No Twilio Console, configure o webhook:</div>
            <div class="step" style="padding-left: 50px;">URL: <code>${new URL(c.req.url).origin}/api/whatsapp/webhook</code></div>
            <div class="step" style="padding-left: 50px;">Método: POST</div>
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
      <title>WhatsApp Configurado</title>
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
        <h1>✅ WhatsApp Configurado!</h1>
        <div class="success">
          <strong>Secrets configurados:</strong><br>
          ✓ TWILIO_ACCOUNT_SID<br>
          ✓ TWILIO_AUTH_TOKEN<br>
          ✓ TWILIO_WHATSAPP_NUMBER
        </div>
        <div class="info">
          <h3>🔗 Configure o Webhook no Twilio:</h3>
          <div class="step">1. Acesse: <a href="https://console.twilio.com/" target="_blank">Twilio Console</a></div>
          <div class="step">2. Vá em Messaging → WhatsApp Senders</div>
          <div class="step">3. Selecione seu número WhatsApp</div>
          <div class="step">4. Configure o webhook:</div>
          <code>${new URL(c.req.url).origin}/api/whatsapp/webhook</code>
          <div class="step">5. Método: POST</div>
          <div class="step">6. Salve as configurações</div>
        </div>
        <div class="info">
          <h3>📱 Teste a Integração:</h3>
          <div class="step">1. Envie uma mensagem para ${env.TWILIO_WHATSAPP_NUMBER.replace('whatsapp:', '')}</div>
          <div class="step">2. O bot deve responder automaticamente</div>
          <div class="step">3. Siga as instruções para criar um chamado</div>
        </div>
      </div>
    </body>
    </html>
  `);
});

export default whatsapp;
