import { Hono } from 'hono';
import { gerarRespostaIA, deveCriarTicket } from '../services/openai';
import { 
  iniciarColeta, 
  processarResposta, 
  formatarResumo,
  type EstadoColeta,
  type DadosTicket 
} from '../services/telegram-coleta';
import { getDataHoraBrasil } from '../utils/timezone';

const telegram = new Hono();

// Enviar mensagem via Telegram
async function enviarMensagemTelegram(chatId: string, texto: string, token: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();
    
    if (!response.ok || !(result as any).ok) {
      console.error('Erro ao enviar mensagem no Telegram:', {
        chatId,
        status: response.status,
        result
      });
    } else {
      console.log('Mensagem enviada com sucesso:', { chatId, texto: texto.substring(0, 50) });
    }
    
    return result;
  } catch (error) {
    console.error('Erro ao enviar mensagem no Telegram:', error);
    throw error;
  }
}

// Baixar arquivo do Telegram e salvar no R2
async function baixarArquivoTelegram(
  env: any,
  fileId: string,
  fileName: string,
  chamadoId: number,
  autorId: string
): Promise<string> {
  try {
    // Obter informações do arquivo
    const fileInfoUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
    const fileInfoResponse = await fetch(fileInfoUrl);
    const fileInfo = await fileInfoResponse.json() as any;

    if (!fileInfo.ok) {
      throw new Error('Erro ao obter informações do arquivo');
    }

    // Baixar arquivo
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      throw new Error('Erro ao baixar arquivo');
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    
    // Determinar tipo do arquivo
    let contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
    
    // Se for foto do Telegram (sem extensão ou .jpg), garantir que é image/jpeg
    if (fileName.startsWith('foto_') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (fileName.endsWith('.png')) {
      contentType = 'image/png';
    } else if (fileName.endsWith('.gif')) {
      contentType = 'image/gif';
    } else if (fileName.endsWith('.webp')) {
      contentType = 'image/webp';
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

    console.log('Arquivo salvo:', { r2Key, fileName, tamanho: fileBuffer.byteLength });
    
    return r2Key;
  } catch (error) {
    console.error('Erro ao processar arquivo:', error);
    throw error;
  }
}

// Webhook do Telegram
telegram.post('/webhook', async (c) => {
  const env = c.env as any;
  
  try {
    const update = await c.req.json();
    
    // Verificar se há mensagem
    if (!update.message) {
      return c.json({ ok: true });
    }

    const chatId = update.message.chat.id.toString();
    const userId = update.message.from.id.toString();
    const username = update.message.from.username || '';
    const firstName = update.message.from.first_name || '';
    
    // Processar foto ou documento
    if (update.message.photo || update.message.document) {
      let attachmentMessage = '';
      
      // Verificar se existe coleta ativa
      const coletaAtiva = await env.DB.prepare(`
        SELECT coleta_ativa, dados_coletados, campo_atual, chamado_id 
        FROM telegram_conversas 
        WHERE chat_id = ? AND coleta_ativa = 1
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(chatId).first();

      if (coletaAtiva && coletaAtiva.campo_atual === 'evidencias') {
        // Está na etapa de coleta de evidências - armazenar file_id
        try {
          let fileId = '';
          let fileName = '';
          
          if (update.message.photo) {
            const photo = update.message.photo[update.message.photo.length - 1];
            fileId = photo.file_id;
            fileName = `foto_${Date.now()}.jpg`;
            attachmentMessage = '📸 Foto recebida! Pode enviar mais fotos ou digite "pronto" quando terminar.';
          } else if (update.message.document) {
            const document = update.message.document;
            fileId = document.file_id;
            fileName = document.file_name || `documento_${Date.now()}`;
            attachmentMessage = `📎 Documento "${fileName}" recebido! Pode enviar mais arquivos ou digite "pronto" quando terminar.`;
          }

          // Atualizar dados coletados com o file_id
          let dadosColetados: DadosTicket = {};
          try {
            dadosColetados = coletaAtiva.dados_coletados ? JSON.parse(coletaAtiva.dados_coletados) : {};
          } catch (error) {
            console.error('Erro ao parsear dados_coletados:', error);
            dadosColetados = {};
          }

          // Adicionar file_id à lista
          if (!dadosColetados.file_ids) {
            dadosColetados.file_ids = [];
          }
          dadosColetados.file_ids.push(JSON.stringify({ file_id: fileId, file_name: fileName }));

          // Atualizar no banco
          await env.DB.prepare(`
            UPDATE telegram_conversas 
            SET dados_coletados = ?
            WHERE chat_id = ? AND coleta_ativa = 1
          `).bind(JSON.stringify(dadosColetados), chatId).run();

          // Enviar confirmação
          await enviarMensagemTelegram(chatId, attachmentMessage, env.TELEGRAM_BOT_TOKEN);
          
          // Salvar na conversa
          await env.DB.prepare(`
            INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
            VALUES (?, ?, ?, ?, ?, 'sistema')
          `).bind(chatId, userId, username, firstName, attachmentMessage).run();
          
        } catch (error) {
          console.error('Erro ao processar anexo durante coleta:', error);
          const errorMsg = 'Desculpe, não consegui processar o arquivo enviado.';
          await enviarMensagemTelegram(chatId, errorMsg, env.TELEGRAM_BOT_TOKEN);
        }
      } else if (coletaAtiva && coletaAtiva.chamado_id) {
        // Coleta já finalizada, há chamado criado - anexar ao chamado
        try {
          if (update.message.photo) {
            const photo = update.message.photo[update.message.photo.length - 1];
            const fileName = `foto_${Date.now()}.jpg`;
            
            await baixarArquivoTelegram(env, photo.file_id, fileName, coletaAtiva.chamado_id, userId);
            attachmentMessage = '📸 Foto anexada ao chamado!';
          } else if (update.message.document) {
            const document = update.message.document;
            const fileName = document.file_name || `documento_${Date.now()}`;
            
            await baixarArquivoTelegram(env, document.file_id, fileName, coletaAtiva.chamado_id, userId);
            attachmentMessage = `📎 Documento "${fileName}" anexado ao chamado!`;
          }

          await enviarMensagemTelegram(chatId, attachmentMessage, env.TELEGRAM_BOT_TOKEN);
          
          await env.DB.prepare(`
            INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
            VALUES (?, ?, ?, ?, ?, 'sistema', ?)
          `).bind(chatId, userId, username, firstName, attachmentMessage, coletaAtiva.chamado_id).run();
          
        } catch (error) {
          console.error('Erro ao processar anexo:', error);
          const errorMsg = 'Desculpe, não consegui processar o arquivo enviado.';
          await enviarMensagemTelegram(chatId, errorMsg, env.TELEGRAM_BOT_TOKEN);
        }
      } else {
        // Não há coleta ativa nem chamado
        const noTicketMsg = 'Por favor, primeiro inicie a criação de um chamado.';
        await enviarMensagemTelegram(chatId, noTicketMsg, env.TELEGRAM_BOT_TOKEN);
      }
      
      return c.json({ ok: true });
    }
    
    // Processar mensagem de texto (código original)
    if (!update.message.text) {
      return c.json({ ok: true });
    }
    
    const mensagem = update.message.text;

    // Verificar se é um código de vinculação (6 dígitos)
    if (/^\d{6}$/.test(mensagem.trim())) {
      const codigo = mensagem.trim();
      
      // Buscar usuário com este código de vinculação
      const userProfile = await env.DB.prepare(`
        SELECT * FROM user_profiles 
        WHERE telegram_link_code = ? 
        AND telegram_link_expires_at > datetime('now')
      `).bind(codigo).first();

      if (userProfile) {
        // Vincular Telegram ao perfil
        await env.DB.prepare(`
          UPDATE user_profiles 
          SET telegram_user_id = ?, 
              telegram_username = ?,
              telegram_link_code = NULL,
              telegram_link_expires_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(userId, username || null, userProfile.id).run();

        const mensagemSucesso = `✅ <b>Conta vinculada com sucesso!</b>\n\nAgora você receberá notificações de chamados aqui no Telegram.\n\nVocê pode continuar usando o sistema web normalmente e também interagir via Telegram.`;
        
        await env.DB.prepare(`
          INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
          VALUES (?, ?, ?, ?, ?, 'assistente')
        `).bind(chatId, userId, username, firstName, mensagemSucesso).run();
        
        await enviarMensagemTelegram(chatId, mensagemSucesso, env.TELEGRAM_BOT_TOKEN);
        
        return c.json({ ok: true });
      } else {
        const mensagemErro = '❌ Código inválido ou expirado.\n\nPor favor, gere um novo código no sistema web em Perfil → Vincular Telegram.';
        
        await env.DB.prepare(`
          INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
          VALUES (?, ?, ?, ?, ?, 'assistente')
        `).bind(chatId, userId, username, firstName, mensagemErro).run();
        
        await enviarMensagemTelegram(chatId, mensagemErro, env.TELEGRAM_BOT_TOKEN);
        
        return c.json({ ok: true });
      }
    }

    // Verificar se há coleta ativa
    const coletaAtual = await env.DB.prepare(`
      SELECT coleta_ativa, dados_coletados, campo_atual, mensagem, chamado_id
      FROM telegram_conversas 
      WHERE chat_id = ? AND coleta_ativa = 1
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(chatId).first();

    if (coletaAtual) {
      console.log('Coleta ativa encontrada:', coletaAtual);

      // Verificar se é coleta de avaliação
      if (coletaAtual.campo_atual?.startsWith('avaliacao_')) {
        console.log('Processando avaliação do chamado:', coletaAtual.chamado_id);
        
        // Salvar mensagem do usuário
        await env.DB.prepare(`
          INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
          VALUES (?, ?, ?, ?, ?, 'usuario', ?)
        `).bind(chatId, userId, username, firstName, mensagem, coletaAtual.chamado_id).run();

        let dadosAvaliacao: any = {};
        try {
          dadosAvaliacao = coletaAtual.dados_coletados ? JSON.parse(coletaAtual.dados_coletados) : {};
        } catch (error) {
          dadosAvaliacao = {};
        }

        if (coletaAtual.campo_atual === 'avaliacao_nota') {
          // Validar nota (1-5 estrelas)
          const nota = parseInt(mensagem.trim());
          if (isNaN(nota) || nota < 1 || nota > 5) {
            const erroMsg = '❌ Por favor, digite apenas um número de 1 a 5.';
            await env.DB.prepare(`
              INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
              VALUES (?, ?, ?, ?, ?, 'assistente', ?)
            `).bind(chatId, userId, username, firstName, erroMsg, coletaAtual.chamado_id).run();
            await enviarMensagemTelegram(chatId, erroMsg, env.TELEGRAM_BOT_TOKEN);
            return c.json({ ok: true });
          }

          dadosAvaliacao.nota = nota;
          
          // Calcular se resolveu baseado na nota (3+ estrelas = resolveu)
          dadosAvaliacao.resolveu = nota >= 3;

          // Próxima pergunta: NPS
          const perguntaNPS = `📊 <b>Pergunta de NPS:</b>\n\n` +
                             `Em uma escala de 0 a 10, o quanto você recomendaria nosso serviço de TI para um colega?\n\n` +
                             `• 0-6: Detratores\n` +
                             `• 7-8: Neutros\n` +
                             `• 9-10: Promotores\n\n` +
                             `Digite apenas o número.`;

          await env.DB.prepare(`
            UPDATE telegram_conversas 
            SET dados_coletados = ?, campo_atual = 'avaliacao_nps'
            WHERE chat_id = ? AND coleta_ativa = 1
          `).bind(JSON.stringify(dadosAvaliacao), chatId).run();

          await env.DB.prepare(`
            INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
            VALUES (?, ?, ?, ?, ?, 'assistente', ?)
          `).bind(chatId, userId, username, firstName, perguntaNPS, coletaAtual.chamado_id).run();

          await enviarMensagemTelegram(chatId, perguntaNPS, env.TELEGRAM_BOT_TOKEN);
          return c.json({ ok: true });

        } else if (coletaAtual.campo_atual === 'avaliacao_nps') {
          // Validar NPS (0-10)
          const nps = parseInt(mensagem.trim());
          if (isNaN(nps) || nps < 0 || nps > 10) {
            const erroMsg = '❌ Por favor, digite apenas um número de 0 a 10.';
            await env.DB.prepare(`
              INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
              VALUES (?, ?, ?, ?, ?, 'assistente', ?)
            `).bind(chatId, userId, username, firstName, erroMsg, coletaAtual.chamado_id).run();
            await enviarMensagemTelegram(chatId, erroMsg, env.TELEGRAM_BOT_TOKEN);
            return c.json({ ok: true });
          }

          dadosAvaliacao.nps = nps;

          // Próxima pergunta: Comentário (opcional)
          const perguntaComentario = `💬 <b>Comentário (opcional):</b>\n\n` +
                                     `Gostaria de deixar algum comentário sobre o atendimento?\n\n` +
                                     `Digite seu comentário ou "pular" para finalizar.`;

          await env.DB.prepare(`
            UPDATE telegram_conversas 
            SET dados_coletados = ?, campo_atual = 'avaliacao_comentario'
            WHERE chat_id = ? AND coleta_ativa = 1
          `).bind(JSON.stringify(dadosAvaliacao), chatId).run();

          await env.DB.prepare(`
            INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
            VALUES (?, ?, ?, ?, ?, 'assistente', ?)
          `).bind(chatId, userId, username, firstName, perguntaComentario, coletaAtual.chamado_id).run();

          await enviarMensagemTelegram(chatId, perguntaComentario, env.TELEGRAM_BOT_TOKEN);
          return c.json({ ok: true });

        } else if (coletaAtual.campo_atual === 'avaliacao_comentario') {
          // Comentário é opcional
          const comentario = mensagem.toLowerCase().trim() === 'pular' ? null : mensagem;
          dadosAvaliacao.comentario = comentario;

          // Salvar avaliação no banco
          await env.DB.prepare(`
            UPDATE chamados 
            SET avaliacao_nota = ?, avaliacao_nps = ?, avaliacao_comentario = ?, 
                avaliacao_resolveu = ?, avaliacao_data = CURRENT_TIMESTAMP, 
                status = 'Fechado', data_fechamento = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(
            dadosAvaliacao.nota,
            dadosAvaliacao.nps,
            comentario,
            dadosAvaliacao.resolveu ? 1 : 0,
            coletaAtual.chamado_id
          ).run();

          // Desativar coleta
          await env.DB.prepare(`
            UPDATE telegram_conversas 
            SET coleta_ativa = 0 
            WHERE chat_id = ? AND coleta_ativa = 1
          `).bind(chatId).run();

          // Mensagem de agradecimento
          const estrelas = '⭐'.repeat(dadosAvaliacao.nota);
          const tipoAvaliacao = dadosAvaliacao.nota >= 4 ? '😊 Excelente!' :
                               dadosAvaliacao.nota === 3 ? '👍 Bom!' :
                               '😐 Vamos melhorar!';
          
          const mensagemFinal = `${tipoAvaliacao}\n\n` +
                               `✅ <b>Avaliação registrada com sucesso!</b>\n\n` +
                               `⭐ Satisfação: ${estrelas} (${dadosAvaliacao.nota}/5)\n` +
                               `📈 NPS: ${dadosAvaliacao.nps}/10\n` +
                               (comentario ? `💬 Comentário: ${comentario}\n\n` : '\n') +
                               `Obrigado pelo seu feedback! Seu chamado foi fechado.\n\n` +
                               `Se precisar de algo mais, é só me chamar! 😊`;

          await env.DB.prepare(`
            INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
            VALUES (?, ?, ?, ?, ?, 'assistente', ?)
          `).bind(chatId, userId, username, firstName, mensagemFinal, coletaAtual.chamado_id).run();

          await enviarMensagemTelegram(chatId, mensagemFinal, env.TELEGRAM_BOT_TOKEN);

          console.log('Avaliação concluída via Telegram:', dadosAvaliacao);
          return c.json({ ok: true });
        }
      }
      
      // Há uma coleta em andamento - processar resposta
      let dadosColetados = {};
      try {
        dadosColetados = coletaAtual.dados_coletados ? JSON.parse(coletaAtual.dados_coletados) : {};
        console.log('Dados coletados parseados:', dadosColetados);
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

      console.log('Processando resposta para campo:', estadoColeta.campo_atual);
      
      // Salvar o campo atual ANTES de processar (para verificar depois)
      const campoAntes = estadoColeta.campo_atual;
      
      const resultado = processarResposta(estadoColeta, mensagem);
      console.log('Resultado do processamento:', { completo: resultado.completo, proximoCampo: resultado.estado.campo_atual });

      // Salvar mensagem do usuário
      await env.DB.prepare(`
        INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
        VALUES (?, ?, ?, ?, ?, 'usuario')
      `).bind(chatId, userId, username, firstName, mensagem).run();

      if (resultado.completo) {
        // Verificar se estávamos no campo de evidências e se o usuário respondeu "não", "nao", "pular" ou "pronto"
        const respostaNormalizada = mensagem.toLowerCase().trim();
        const pularEvidencias = ['não', 'nao', 'pular', 'pronto', 'n', 'skip'].includes(respostaNormalizada);
        
        if (campoAntes === 'evidencias' && pularEvidencias) {
          // Usuário pulou as evidências - criar ticket
          try {
            await criarTicketComDados(env, chatId, userId, username, firstName, resultado.estado.dados, c);
          } catch (error) {
            console.error('Erro ao criar ticket:', error);
            
            const mensagemErro = 'Desculpe, ocorreu um erro ao criar seu chamado. Nossa equipe foi notificada e entrará em contato em breve.';
            await env.DB.prepare(`
              INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
              VALUES (?, ?, ?, ?, ?, 'assistente')
            `).bind(chatId, userId, username, firstName, mensagemErro).run();
            
            await enviarMensagemTelegram(chatId, mensagemErro, env.TELEGRAM_BOT_TOKEN);
          }
          
          // Desativar coleta
          await env.DB.prepare(`
            UPDATE telegram_conversas 
            SET coleta_ativa = 0 
            WHERE chat_id = ? AND coleta_ativa = 1
          `).bind(chatId).run();
          
        } else if (campoAntes === 'evidencias' && resultado.estado.dados.file_ids && resultado.estado.dados.file_ids.length > 0) {
          // Usuário enviou evidências - criar ticket e anexar
          try {
            await criarTicketComDados(env, chatId, userId, username, firstName, resultado.estado.dados, c);
          } catch (error) {
            console.error('Erro ao criar ticket:', error);
            
            const mensagemErro = 'Desculpe, ocorreu um erro ao criar seu chamado. Nossa equipe foi notificada e entrará em contato em breve.';
            await env.DB.prepare(`
              INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
              VALUES (?, ?, ?, ?, ?, 'assistente')
            `).bind(chatId, userId, username, firstName, mensagemErro).run();
            
            await enviarMensagemTelegram(chatId, mensagemErro, env.TELEGRAM_BOT_TOKEN);
          }
          
          // Desativar coleta
          await env.DB.prepare(`
            UPDATE telegram_conversas 
            SET coleta_ativa = 0 
            WHERE chat_id = ? AND coleta_ativa = 1
          `).bind(chatId).run();
        }

      } else {
        // Atualizar estado da coleta e fazer próxima pergunta
        await env.DB.prepare(`
          UPDATE telegram_conversas 
          SET dados_coletados = ?, campo_atual = ?
          WHERE chat_id = ? AND coleta_ativa = 1
        `).bind(
          JSON.stringify(resultado.estado.dados),
          resultado.estado.campo_atual,
          chatId
        ).run();

        // Salvar resposta do bot
        await env.DB.prepare(`
          INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
          VALUES (?, ?, ?, ?, ?, 'assistente')
        `).bind(chatId, userId, username, firstName, resultado.proximaPergunta).run();

        await enviarMensagemTelegram(chatId, resultado.proximaPergunta!, env.TELEGRAM_BOT_TOKEN);
      }

      return c.json({ ok: true });
    }

    // Não há coleta ativa - verificar chamados ativos do usuário primeiro
    // Salvar mensagem do usuário
    await env.DB.prepare(`
      INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
      VALUES (?, ?, ?, ?, ?, 'usuario')
    `).bind(chatId, userId, username, firstName, mensagem).run();

    // Buscar perfil do usuário
    const userProfile = await env.DB.prepare(`
      SELECT * FROM user_profiles WHERE telegram_user_id = ?
    `).bind(userId).first();

    // Verificar se usuário quer forçar criação de novo ticket
    const mensagemLower = mensagem.toLowerCase().trim();
    const forcarNovoTicket = mensagemLower.includes('novo ticket') || 
                            mensagemLower.includes('abrir ticket') || 
                            mensagemLower.includes('criar ticket') ||
                            mensagemLower === 'novo' ||
                            mensagemLower === 'criar';

    let existemTicketsAtivos = false;
    
    if (userProfile && !forcarNovoTicket) {
      // Verificar se usuário tem tickets ativos (só se não forçou novo ticket)
      const ticketsAtivos = await env.DB.prepare(`
        SELECT COUNT(*) as total
        FROM chamados c
        WHERE c.solicitante_id = ?
          AND c.status NOT IN ('Fechado', 'Cancelado')
      `).bind(userProfile.user_id).first();
      
      existemTicketsAtivos = (ticketsAtivos as any)?.total > 0;
      console.log('[TELEGRAM DEBUG] Usuário tem tickets ativos:', existemTicketsAtivos);
    }

    // Se NÃO tem tickets ativos (ou forçou novo), perguntar à IA se deve criar
    let criarTicket = false;
    if (!existemTicketsAtivos || forcarNovoTicket) {
      // Buscar histórico da conversa
      const historico = await env.DB.prepare(`
        SELECT mensagem, tipo 
        FROM telegram_conversas 
        WHERE chat_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
      `).bind(chatId).all();

      const mensagensHistorico = historico.results.reverse().map((m: any) => m.mensagem);
      const todasMensagens = [...mensagensHistorico, mensagem];
      criarTicket = await deveCriarTicket(env, todasMensagens);
      console.log('[TELEGRAM DEBUG] IA decidiu criar ticket:', criarTicket);
    }

    // Se tem tickets ativos E não deve criar ticket, tentar adicionar a ticket existente
    if (existemTicketsAtivos && !criarTicket) {
      console.log('[TELEGRAM DEBUG] Buscando ticket para adicionar mensagem');
      
      if (!userProfile) {
        console.log('[TELEGRAM DEBUG] Perfil não encontrado, gerando resposta IA');
        // Buscar histórico
        const historico = await env.DB.prepare(`
          SELECT mensagem, tipo 
          FROM telegram_conversas 
          WHERE chat_id = ? 
          ORDER BY created_at DESC 
          LIMIT 10
        `).bind(chatId).all();
        const mensagensHistorico = historico.results.reverse().map((m: any) => m.mensagem);
        
        const respostaIA = await gerarRespostaIA(env, mensagem, mensagensHistorico);
        
        await env.DB.prepare(`
          INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
          VALUES (?, ?, ?, ?, ?, 'assistente')
        `).bind(chatId, userId, username, firstName, respostaIA).run();

        await enviarMensagemTelegram(chatId, respostaIA, env.TELEGRAM_BOT_TOKEN);
        return c.json({ ok: true });
      }
      
      // Verificar se a mensagem menciona um número de ticket (formato TKT-XXXXXX)
      const ticketMatch = mensagem.match(/TKT-\d{6}/i);
      let chamadoAtivo = null;
      let mensagemLimpa = mensagem;
      
      if (ticketMatch) {
        // Usuário especificou o ticket - usar esse
        const numeroTicket = ticketMatch[0].toUpperCase();
        console.log('[TELEGRAM DEBUG] Ticket especificado na mensagem:', numeroTicket);
        
        chamadoAtivo = await env.DB.prepare(`
          SELECT c.id as chamado_id, c.status, c.numero
          FROM chamados c
          WHERE c.numero = ? 
            AND c.solicitante_id = ?
            AND c.status NOT IN ('Fechado', 'Cancelado')
        `).bind(numeroTicket, userProfile.user_id).first();
        
        if (!chamadoAtivo) {
          const erro = `❌ Ticket ${numeroTicket} não encontrado ou já está fechado.`;
          await env.DB.prepare(`
            INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
            VALUES (?, ?, ?, ?, ?, 'assistente')
          `).bind(chatId, userId, username, firstName, erro).run();
          await enviarMensagemTelegram(chatId, erro, env.TELEGRAM_BOT_TOKEN);
          return c.json({ ok: true });
        }
        
        // Remover o número do ticket da mensagem para o comentário
        mensagemLimpa = mensagem.replace(ticketMatch[0], '').trim();
        // Se ficou vazio após remover o número, não adicionar comentário vazio
        if (!mensagemLimpa) {
          const aviso = `ℹ️ Ticket <b>${numeroTicket}</b> selecionado. Envie sua mensagem agora.`;
          await env.DB.prepare(`
            INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
            VALUES (?, ?, ?, ?, ?, 'assistente', ?)
          `).bind(chatId, userId, username, firstName, aviso, chamadoAtivo.chamado_id).run();
          await enviarMensagemTelegram(chatId, aviso, env.TELEGRAM_BOT_TOKEN);
          return c.json({ ok: true });
        }
      } else {
        // Buscar todos os tickets ativos do usuário
        const ticketsAtivos = await env.DB.prepare(`
          SELECT c.id as chamado_id, c.status, c.numero, c.titulo
          FROM chamados c
          WHERE c.solicitante_id = ?
            AND c.status NOT IN ('Fechado', 'Cancelado')
          ORDER BY c.created_at DESC
        `).bind(userProfile.user_id).all();
        
        console.log('[TELEGRAM DEBUG] Tickets ativos encontrados:', ticketsAtivos.results.length);
        
        if (ticketsAtivos.results.length === 1) {
          // Só 1 ticket ativo - usar esse
          chamadoAtivo = ticketsAtivos.results[0];
          console.log('[TELEGRAM DEBUG] Usando único ticket ativo:', chamadoAtivo.numero);
        } else {
          // Múltiplos tickets - pedir para escolher
          let listaTickets = '📋 <b>Você tem múltiplos tickets abertos:</b>\n\n';
          for (const ticket of ticketsAtivos.results) {
            const tkt = ticket as any;
            listaTickets += `• <b>${tkt.numero}</b> - ${tkt.titulo}\n  Status: ${tkt.status}\n\n`;
          }
          listaTickets += '💡 Para enviar mensagem para um ticket específico, inclua o número na mensagem:\n\n';
          listaTickets += '<i>Exemplo: "TKT-123456 Oi, o problema persiste"</i>';
          
          await env.DB.prepare(`
            INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
            VALUES (?, ?, ?, ?, ?, 'assistente')
          `).bind(chatId, userId, username, firstName, listaTickets).run();

          await enviarMensagemTelegram(chatId, listaTickets, env.TELEGRAM_BOT_TOKEN);
          return c.json({ ok: true });
        }
      }
      
      console.log('[TELEGRAM DEBUG] Chamado ativo selecionado:', chamadoAtivo);

      if (chamadoAtivo && chamadoAtivo.chamado_id) {
        // Há um chamado ativo e NÃO é um novo problema - adicionar como comentário
        console.log('[TELEGRAM DEBUG] Adicionando mensagem ao chamado:', chamadoAtivo.numero, 'ID:', chamadoAtivo.chamado_id);
        console.log('[TELEGRAM DEBUG] Mensagem:', mensagemLimpa);
        
        if (userProfile) {
          // Buscar dados do chamado
          const chamado = await env.DB.prepare(`
            SELECT * FROM chamados WHERE id = ?
          `).bind(chamadoAtivo.chamado_id).first();

          // Adicionar comentário público ao chamado
          console.log('[TELEGRAM DEBUG] Inserindo comentário - Chamado ID:', chamadoAtivo.chamado_id, 'Autor:', userProfile.nome);
          
          const insertResult = await env.DB.prepare(`
            INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo)
            VALUES (?, ?, ?, 'publico', ?)
          `).bind(
            chamadoAtivo.chamado_id,
            userProfile.user_id,
            userProfile.nome,
            mensagemLimpa
          ).run();
          
          console.log('[TELEGRAM DEBUG] Comentário inserido, ID:', insertResult.meta.last_row_id);

          // Atualizar mensagem já salva com chamado_id
          await env.DB.prepare(`
            UPDATE telegram_conversas 
            SET chamado_id = ?
            WHERE chat_id = ? AND mensagem = ? AND tipo = 'usuario' AND chamado_id IS NULL
            ORDER BY created_at DESC
            LIMIT 1
          `).bind(chamadoAtivo.chamado_id, chatId, mensagem).run();

          // Notificar técnico responsável se houver
          console.log('[TELEGRAM DEBUG] Verificando técnico - Técnico ID:', chamado?.tecnico_responsavel_id);
          
          if (chamado && chamado.tecnico_responsavel_id && chamado.tecnico_responsavel_id !== userProfile.user_id) {
            console.log('[TELEGRAM DEBUG] Há técnico responsável, buscando dados...');
            
            // Buscar email do técnico
            const tecnico = await env.DB.prepare(`
              SELECT email, nome FROM user_profiles WHERE user_id = ?
            `).bind(chamado.tecnico_responsavel_id).first();

            console.log('[TELEGRAM DEBUG] Técnico encontrado:', tecnico ? tecnico.nome : 'Não encontrado');

            if (tecnico) {
              // Criar notificação
              const notifResult = await env.DB.prepare(`
                INSERT INTO notificacoes (destinatario_id, chamado_id, tipo, titulo, mensagem, via_email)
                VALUES (?, ?, 'comentario', ?, ?, TRUE)
              `).bind(
                chamado.tecnico_responsavel_id,
                chamadoAtivo.chamado_id,
                'Nova mensagem via Telegram',
                `${userProfile.nome} comentou no chamado ${chamado.numero}: ${mensagemLimpa.substring(0, 100)}${mensagemLimpa.length > 100 ? '...' : ''}`
              ).run();

              console.log('[TELEGRAM DEBUG] Notificação criada, ID:', notifResult.meta.last_row_id);
            }
          } else {
            console.log('[TELEGRAM DEBUG] Não há técnico ou é o próprio solicitante');
          }

          // Enviar confirmação com o número do ticket
          const confirmacao = `✅ Mensagem enviada para o ticket <b>${chamadoAtivo.numero}</b>!\n\n💡 Suas próximas mensagens irão para este mesmo ticket. Para mudar de ticket, mencione o número (ex: "TKT-123456 mensagem").`;
          await enviarMensagemTelegram(chatId, confirmacao, env.TELEGRAM_BOT_TOKEN);
          
          await env.DB.prepare(`
            INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
            VALUES (?, ?, ?, ?, ?, 'assistente', ?)
          `).bind(chatId, userId, username, firstName, confirmacao, chamadoAtivo.chamado_id).run();

          console.log('[TELEGRAM DEBUG] Comentário adicionado ao chamado com sucesso');
          return c.json({ ok: true });
        }
      }
    }

    // Se chegou aqui: ou é um novo ticket OU não tem chamado ativo
    if (criarTicket) {
      // Iniciar processo de coleta de informações
      const estadoColeta = iniciarColeta(mensagem);
      
      // Salvar estado inicial da coleta
      await env.DB.prepare(`
        INSERT INTO telegram_conversas (
          chat_id, user_id, username, first_name, mensagem, tipo, 
          coleta_ativa, dados_coletados, campo_atual
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(chatId, userId, username, firstName, mensagem, 'sistema', 1, '{}', estadoColeta.campo_atual).run();

      const primeiraPergunta = 'Vou coletar algumas informações para abrir o chamado.\n\n' + 
                              'Qual é o seu nome completo?';

      // Salvar primeira pergunta
      await env.DB.prepare(`
        INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
        VALUES (?, ?, ?, ?, ?, 'assistente')
      `).bind(chatId, userId, username, firstName, primeiraPergunta).run();

      await enviarMensagemTelegram(chatId, primeiraPergunta, env.TELEGRAM_BOT_TOKEN);
    } else {
      // Não deve criar ticket - apenas responder
      // Buscar histórico
      const historico = await env.DB.prepare(`
        SELECT mensagem, tipo 
        FROM telegram_conversas 
        WHERE chat_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
      `).bind(chatId).all();
      const mensagensHistorico = historico.results.reverse().map((m: any) => m.mensagem);
      
      const respostaIA = await gerarRespostaIA(env, mensagem, mensagensHistorico);
      
      // Salvar resposta da IA
      await env.DB.prepare(`
        INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo)
        VALUES (?, ?, ?, ?, ?, 'assistente')
      `).bind(chatId, userId, username, firstName, respostaIA).run();

      await enviarMensagemTelegram(chatId, respostaIA, env.TELEGRAM_BOT_TOKEN);
    }

    return c.json({ ok: true });

  } catch (error) {
    console.error('Erro no webhook do Telegram:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : String(error));
    return c.json({ 
      error: 'Erro ao processar mensagem',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Função auxiliar para criar ticket com dados coletados
async function criarTicketComDados(
  env: any,
  chatId: string,
  userId: string,
  username: string,
  firstName: string,
  dados: DadosTicket,
  c?: any
) {
  console.log('Iniciando criação de ticket com dados:', dados);
  
  // Buscar ou criar perfil do usuário
  let userProfile = await env.DB.prepare(`
    SELECT * FROM user_profiles WHERE telegram_user_id = ?
  `).bind(userId).first();

  if (!userProfile) {
    console.log('Criando novo perfil de usuário para:', userId);
    // Criar perfil básico
    const email = `telegram_${userId}@telegram.user`;
    const nomeUsuario = dados.nome_solicitante || firstName || username || 'Usuário Telegram';
    
    await env.DB.prepare(`
      INSERT INTO user_profiles (user_id, email, nome, perfil, telegram_user_id, telegram_username)
      VALUES (?, ?, ?, 'solicitante', ?, ?)
    `).bind(userId, email, nomeUsuario, userId, username || null).run();

    userProfile = await env.DB.prepare(`
      SELECT * FROM user_profiles WHERE telegram_user_id = ?
    `).bind(userId).first();
  }

  // Encontrar setor de destino (apenas setores ativos)
  const setor = await env.DB.prepare(`
    SELECT id, nome FROM setores WHERE nome LIKE ? AND ativo = 1 LIMIT 1
  `).bind(`%${dados.setor_destino}%`).first();

  console.log('🎯 Busca de setor:', { 
    setor_solicitado: dados.setor_destino, 
    setor_encontrado: setor ? { id: setor.id, nome: setor.nome } : null 
  });

  // Encontrar categoria baseada no tipo do problema e setor
  let categoria = null;
  
  if (setor?.id && dados.tipo_problema) {
    // Primeira tentativa: nome exato
    categoria = await env.DB.prepare(`
      SELECT id, nome FROM categorias WHERE nome = ? AND setor_id = ? LIMIT 1
    `).bind(dados.tipo_problema, setor.id).first();
    
    console.log('🔍 Busca categoria (exata):', {
      tipo_problema: dados.tipo_problema,
      setor_id: setor.id,
      categoria_encontrada: categoria ? { id: categoria.id, nome: categoria.nome } : null
    });
    
    // Segunda tentativa: busca parcial com LIKE
    if (!categoria) {
      const tipoBase = dados.tipo_problema.split('(')[0].split('-')[0].trim();
      categoria = await env.DB.prepare(`
        SELECT id, nome FROM categorias WHERE nome LIKE ? AND setor_id = ? LIMIT 1
      `).bind(`%${tipoBase}%`, setor.id).first();
      
      console.log('🔍 Busca categoria (parcial):', {
        tipo_base: tipoBase,
        setor_id: setor.id,
        categoria_encontrada: categoria ? { id: categoria.id, nome: categoria.nome } : null
      });
    }
    
    // Terceira tentativa: buscar categoria genérica "Outros" ou "Geral" do setor
    if (!categoria) {
      categoria = await env.DB.prepare(`
        SELECT id, nome FROM categorias 
        WHERE (nome LIKE '%Outros%' OR nome LIKE '%Geral%') AND setor_id = ?
        LIMIT 1
      `).bind(setor.id).first();
      
      console.log('🔍 Busca categoria (Outros/Geral):', {
        setor_id: setor.id,
        categoria_encontrada: categoria ? { id: categoria.id, nome: categoria.nome } : null
      });
    }
  }

  // Selecionar SLA baseado na categoria específica ou em afeta_paciente
  let prioridade = 'P3';
  let sla;
  
  if (categoria) {
    // Se encontrou categoria específica, buscar SLA dela
    sla = await env.DB.prepare(`
      SELECT id, nome, prioridade, tempo_resposta_minutos, tempo_solucao_minutos, setor_id 
      FROM slas WHERE categoria_id = ? LIMIT 1
    `).bind(categoria.id).first();
    
    console.log('📊 Busca SLA (por categoria):', {
      categoria_id: categoria.id,
      sla_encontrado: sla ? { 
        id: sla.id, 
        nome: sla.nome, 
        prioridade: sla.prioridade,
        setor_id: sla.setor_id 
      } : null
    });
    
    if (sla) {
      prioridade = sla.prioridade;
    }
  }
  
  if (!sla && dados.afeta_paciente === true) {
    // Problema afeta pacientes (Manutenção Predial) - usar prioridade máxima (P1) com SLA de 4 horas
    prioridade = 'P1';
    sla = await env.DB.prepare(`
      SELECT id, nome, prioridade, tempo_resposta_minutos, tempo_solucao_minutos, setor_id 
      FROM slas 
      WHERE prioridade = 'P1' 
        AND setor_id = ?
        AND tempo_solucao_minutos <= 240
      ORDER BY tempo_solucao_minutos ASC
      LIMIT 1
    `).bind(setor?.id || null).first();
    
    console.log('📊 Busca SLA (afeta paciente, P1, setor específico):', {
      setor_id: setor?.id,
      sla_encontrado: sla ? { id: sla.id, nome: sla.nome, setor_id: sla.setor_id } : null
    });
    
    // Se não encontrou SLA específico do setor, buscar SLA P1 genérico (sem setor específico)
    if (!sla) {
      sla = await env.DB.prepare(`
        SELECT id, nome, prioridade, tempo_resposta_minutos, tempo_solucao_minutos, setor_id 
        FROM slas 
        WHERE prioridade = 'P1' AND (setor_id IS NULL OR setor_id = 'null')
        ORDER BY tempo_solucao_minutos ASC
        LIMIT 1
      `).first();
      
      console.log('📊 Busca SLA (afeta paciente, P1 genérico):', {
        sla_encontrado: sla ? { id: sla.id, nome: sla.nome, setor_id: sla.setor_id } : null
      });
    }
  }
  
  if (!sla) {
    // Fallback: SLA padrão (P3) do setor correto - SEMPRE filtrar por setor
    if (setor?.id) {
      sla = await env.DB.prepare(`
        SELECT id, nome, prioridade, tempo_resposta_minutos, tempo_solucao_minutos, setor_id 
        FROM slas 
        WHERE prioridade = 'P3' AND setor_id = ?
        ORDER BY tempo_solucao_minutos ASC
        LIMIT 1
      `).bind(setor.id).first();
      
      console.log('📊 Busca SLA (fallback P3, setor específico):', {
        setor_id: setor.id,
        sla_encontrado: sla ? { id: sla.id, nome: sla.nome, setor_id: sla.setor_id } : null
      });
    }
  }
  
  console.log('✅ SLA final selecionado:', sla ? {
    id: sla.id,
    nome: sla.nome,
    prioridade: sla.prioridade,
    setor_id: sla.setor_id,
    tempo_resposta: sla.tempo_resposta_minutos,
    tempo_solucao: sla.tempo_solucao_minutos
  } : 'NENHUM SLA ENCONTRADO');

  const grupoAtendimento = await env.DB.prepare(`
    SELECT id FROM grupos_atendimento WHERE ativo = 1 LIMIT 1
  `).first();

  const unidade = await env.DB.prepare(`
    SELECT id FROM unidades WHERE ativo = 1 LIMIT 1
  `).first();

  const numeroTicket = `TKT-${Date.now().toString().slice(-6)}`;

  // Criar título baseado no tipo e descrição
  const descricaoCurta = dados.descricao_problema?.substring(0, 50) || 'Sem descrição';
  const titulo = `${dados.tipo_problema || 'Incidente'} - ${descricaoCurta}`;

  console.log('Criando chamado:', numeroTicket, 'para usuário:', userProfile.id);

  const dataHoraBrasil = getDataHoraBrasil();

  // Extrair tipo_problema base (sem exemplos entre parênteses)
  let tipoProblemaSalvar = dados.tipo_problema || null;
  if (tipoProblemaSalvar) {
    // Remover partes entre parênteses e texto após hífen para obter tipo base
    tipoProblemaSalvar = tipoProblemaSalvar.split('(')[0].trim();
  }

  const ticketResult = await env.DB.prepare(`
    INSERT INTO chamados (
      numero, tipo, titulo, descricao, status, prioridade,
      solicitante_id, solicitante_nome, solicitante_email, solicitante_setor,
      categoria_id, sla_id, grupo_responsavel_id, unidade_id, setor_destino_id,
      telegram_chat_id, origem, afeta_paciente, tipo_problema, data_abertura, created_at, updated_at
    ) VALUES (?, 'Incidente', ?, ?, 'Novo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'telegram', ?, ?, ?, ?, ?)
  `).bind(
    numeroTicket,
    titulo,
    dados.descricao_problema || 'Sem descrição detalhada',
    prioridade,
    userProfile.user_id,
    dados.nome_solicitante || userProfile.nome,
    userProfile.email,
    dados.setor_solicitante || 'Não informado',
    categoria?.id || null,
    sla?.id || null,
    grupoAtendimento?.id || null,
    unidade?.id || null,
    setor?.id || null,
    chatId.toString(),
    dados.afeta_paciente === true ? 1 : 0,
    tipoProblemaSalvar,
    dataHoraBrasil,
    dataHoraBrasil,
    dataHoraBrasil
  ).run();

  const chamadoId = ticketResult.meta.last_row_id;
  
  console.log('✅ Chamado criado com sucesso:', {
    id: chamadoId,
    numero: numeroTicket,
    setor_destino: setor ? `${setor.nome} (ID: ${setor.id})` : 'não definido',
    categoria: categoria ? `${categoria.nome} (ID: ${categoria.id})` : 'não definido',
    sla: sla ? `${sla.nome} (ID: ${sla.id}, Setor: ${sla.setor_id || 'genérico'})` : 'não definido',
    prioridade: prioridade,
    tipo_problema: tipoProblemaSalvar
  });

  // Processar evidências anexadas durante a coleta
  if (dados.file_ids && dados.file_ids.length > 0) {
    console.log('Processando evidências:', dados.file_ids.length);
    for (const fileDataStr of dados.file_ids) {
      try {
        const fileData = JSON.parse(fileDataStr);
        await baixarArquivoTelegram(env, fileData.file_id, fileData.file_name, ticketResult.meta.last_row_id, userId);
        console.log('Evidência anexada:', fileData.file_name);
      } catch (error) {
        console.error('Erro ao anexar evidência:', error);
      }
    }
  }

  // Atualizar conversa com chamado_id
  await env.DB.prepare(`
    UPDATE telegram_conversas 
    SET chamado_id = ? 
    WHERE chat_id = ? AND chamado_id IS NULL
  `).bind(ticketResult.meta.last_row_id, chatId).run();

  // Adicionar histórico
  await env.DB.prepare(`
    INSERT INTO historico (chamado_id, user_id, user_nome, acao, detalhes)
    VALUES (?, ?, ?, 'criado', ?)
  `).bind(
    ticketResult.meta.last_row_id, 
    userProfile.user_id,
    dados.nome_solicitante || userProfile.nome,
    JSON.stringify({ origem: 'telegram', dados_coletados: dados })
  ).run();

  // Enviar confirmação
  const resumo = formatarResumo(dados);
  const numEvidencias = dados.file_ids ? dados.file_ids.length : 0;
  const evidenciasTexto = numEvidencias > 0 ? `\n📎 ${numEvidencias} evidência(s) anexada(s)` : '';
  const afetaPacienteTexto = dados.afeta_paciente === true ? `\n\n🚨 <b>PRIORIDADE MÁXIMA</b> - Afeta pacientes (SLA de 4 horas)` : '';
  
  // Adicionar informação de SLA baseada no setor e categoria
  let slaTexto = '';
  if (dados.setor_destino === 'TI') {
    slaTexto = `\n\n⏱️ <b>Tempo estimado para o primeiro atendimento:</b> até 1 hora.\nA prioridade do chamado será definida após análise da equipe de TI, com base no impacto e na urgência do atendimento.\nVocê será notificado assim que a classificação e o encaminhamento forem realizados.`;
  } else if (sla && sla.tempo_solucao_minutos) {
    const minutos = sla.tempo_solucao_minutos;
    let tempoTexto = '';
    
    if (minutos < 60) {
      tempoTexto = `${minutos} minuto${minutos > 1 ? 's' : ''}`;
    } else {
      const horas = Math.floor(minutos / 60);
      const minutosRestantes = minutos % 60;
      
      if (minutosRestantes > 0) {
        tempoTexto = `${horas} hora${horas > 1 ? 's' : ''} e ${minutosRestantes} minuto${minutosRestantes > 1 ? 's' : ''}`;
      } else {
        tempoTexto = `${horas} hora${horas > 1 ? 's' : ''}`;
      }
    }
    
    slaTexto = `\n\n⏱️ <b>Tempo previsto de atendimento:</b> até ${tempoTexto}.`;
  }
  
  const mensagemFinal = `${resumo}${evidenciasTexto}${afetaPacienteTexto}${slaTexto}\n\n✅ <b>Chamado registrado com sucesso!</b>\n📋 <b>Número:</b> ${numeroTicket}\n\n💡 <b>Dica:</b> Você ainda pode enviar mais fotos ou documentos que serão anexados automaticamente ao chamado.\n\nNossa equipe entrará em contato em breve.`;
  
  // Salvar resposta COM chamado_id
  await env.DB.prepare(`
    INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
    VALUES (?, ?, ?, ?, ?, 'assistente', ?)
  `).bind(chatId, userId, username, firstName, mensagemFinal, ticketResult.meta.last_row_id).run();

  await enviarMensagemTelegram(chatId, mensagemFinal, env.TELEGRAM_BOT_TOKEN);

  // Verificar se o usuário tem conta Google vinculada
  const temGoogleVinculado = userProfile.user_id !== userId; // Se user_id != telegram_user_id, já está vinculado
  
  if (!temGoogleVinculado) {
    // Enviar mensagem com link para vincular conta Google
    const requestUrl = new URL(c.req.url);
    const baseUrl = `https://${requestUrl.host}`;
    const loginUrl = `${baseUrl}/?telegram_user_id=${userId}`;
    
    const mensagemVinculacao = `🔗 <b>Vincule sua conta para mais recursos!</b>\n\nPara acessar o sistema web, acompanhar seus chamados online, avaliar atendimentos e usar o chat interno, faça login com sua conta Google:\n\n<a href="${loginUrl}">👉 Clique aqui para fazer login</a>\n\nIsso vai vincular sua conta do Telegram à sua conta Google automaticamente.`;
    
    await env.DB.prepare(`
      INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id)
      VALUES (?, ?, ?, ?, ?, 'assistente', ?)
    `).bind(chatId, userId, username, firstName, mensagemVinculacao, ticketResult.meta.last_row_id).run();
    
    await enviarMensagemTelegram(chatId, mensagemVinculacao, env.TELEGRAM_BOT_TOKEN);
  }
}

// Configurar webhook
telegram.get('/set-webhook', async (c) => {
  const env = c.env as any;
  
  // Verificar se o token está configurado
  if (!env.TELEGRAM_BOT_TOKEN) {
    return c.html(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Configurar Webhook do Telegram</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
          .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #0088cc; margin-bottom: 20px; }
          .error { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .step { margin: 15px 0; padding-left: 25px; }
          .step strong { color: #0088cc; }
          code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>⚠️ Token não configurado</h1>
          <div class="error">
            <strong>TELEGRAM_BOT_TOKEN não encontrado</strong>
          </div>
          <p>Para ativar o webhook do Telegram, siga estes passos:</p>
          <div class="step"><strong>1.</strong> Clique nos 3 pontinhos (...) no canto superior direito do Mocha</div>
          <div class="step"><strong>2.</strong> Selecione "Settings"</div>
          <div class="step"><strong>3.</strong> Procure por <code>TELEGRAM_BOT_TOKEN</code></div>
          <div class="step"><strong>4.</strong> Cole o token que o @BotFather forneceu</div>
          <div class="step"><strong>5.</strong> Clique em "Save"</div>
          <div class="step"><strong>6.</strong> Recarregue esta página</div>
        </div>
      </body>
      </html>
    `);
  }
  
  try {
    // Usar sempre HTTPS para o webhook (necessário pelo Telegram)
    const requestUrl = new URL(c.req.url);
    const webhookUrl = `https://${requestUrl.host}/api/telegram/webhook`;
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });

    const data = await response.json() as any;
    
    if (!response.ok || !data.ok) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Erro ao Configurar Webhook</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
            .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #dc3545; margin-bottom: 20px; }
            .error { background: #f8d7da; border: 1px solid #dc3545; padding: 15px; border-radius: 4px; margin: 20px 0; color: #721c24; }
            code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; display: block; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>❌ Erro ao Configurar Webhook</h1>
            <div class="error">
              <strong>Erro:</strong> ${data.description || 'Erro desconhecido'}
              <code>${JSON.stringify(data, null, 2)}</code>
            </div>
            <p>Verifique se o token está correto e tente novamente.</p>
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
        <title>Webhook Configurado</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
          .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #28a745; margin-bottom: 20px; }
          .success { background: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 4px; margin: 20px 0; color: #155724; }
          .info { background: #e7f3ff; border: 1px solid #0088cc; padding: 15px; border-radius: 4px; margin: 20px 0; }
          code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
          .step { margin: 10px 0; padding-left: 25px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ Webhook Configurado com Sucesso!</h1>
          <div class="success">
            <strong>Webhook URL:</strong><br>
            <code>${webhookUrl}</code>
          </div>
          <div class="info">
            <h3>🎉 Próximos Passos:</h3>
            <div class="step">1. Abra o Telegram</div>
            <div class="step">2. Procure seu bot</div>
            <div class="step">3. Envie uma mensagem teste</div>
            <div class="step">4. O bot deve responder usando IA!</div>
          </div>
          <p><small>Resposta do Telegram: <code>${JSON.stringify(data)}</code></small></p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    return c.html(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erro de Conexão</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
          .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #dc3545; margin-bottom: 20px; }
          .error { background: #f8d7da; border: 1px solid #dc3545; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>❌ Erro de Conexão</h1>
          <div class="error">
            <strong>Erro:</strong> Não foi possível conectar com o Telegram<br>
            <small>${String(error)}</small>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Verificar webhook
telegram.get('/webhook-info', async (c) => {
  const env = c.env as any;
  
  if (!env.TELEGRAM_BOT_TOKEN) {
    return c.json({ 
      error: 'TELEGRAM_BOT_TOKEN não configurado. Configure o secret primeiro em Settings.' 
    }, 400);
  }
  
  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.text();
      return c.json({ 
        error: 'Erro ao verificar webhook do Telegram', 
        details: error 
      }, 500);
    }
    
    const data = await response.json() as Record<string, unknown>;
    return c.json(data);
  } catch (error) {
    return c.json({ 
      error: 'Erro ao conectar com o Telegram', 
      details: String(error) 
    }, 500);
  }
});

// Debug endpoint - Ver últimas conversas
telegram.get('/debug-conversas', async (c) => {
  const env = c.env as any;
  
  try {
    const conversas = await env.DB.prepare(`
      SELECT * FROM telegram_conversas 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all();
    
    return c.json(conversas.results);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

export default telegram;
