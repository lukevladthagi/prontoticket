import { getDataHoraBrasil } from './utils/timezone';
import { resetarPontosMensais } from './services/gamificacao';

interface ChamadoRecorrente {
  id: number;
  titulo: string;
  descricao: string;
  tipo: string;
  tipo_problema: string | null;
  categoria_id: number | null;
  subcategoria_id: number | null;
  item_id: number | null;
  setor_destino_id: number | null;
  setor_responsavel_execucao_id: number | null;
  solicitante_setor: string | null;
  impacto: string | null;
  urgencia: string | null;
  grupo_responsavel_id: number | null;
  tecnico_responsavel_id: string | null;
  frequencia: 'Diária' | 'Semanal' | 'Mensal' | 'Anual';
  dias_semana: string | null;
  dia_mes: number | null;
  hora_execucao: string | null;
  ativo: boolean;
  criador_id: string;
  criador_nome: string;
  ultimo_chamado_gerado_em: string | null;
  proximo_chamado_em: string | null;
  created_at: string;
  updated_at: string;
}

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
}

// Converter horário brasileiro (BRT/BRST -03:00) para UTC
function brToUtc(dateBr: Date): Date {
  const utc = new Date(dateBr);
  utc.setHours(utc.getHours() + 3); // BRT é UTC-3
  return utc;
}

// Converter UTC para horário brasileiro (BRT/BRST -03:00)
function utcToBr(dateUtc: Date): Date {
  const br = new Date(dateUtc);
  br.setHours(br.getHours() - 3); // BRT é UTC-3
  return br;
}

// Calcular próximo horário de execução (retorna em UTC mas calcula baseado no horário BR)
function calcularProximoHorario(recorrente: ChamadoRecorrente): Date {
  const agoraBr = utcToBr(new Date());
  const proximoBr = new Date(agoraBr);
  
  // Configurar hora se especificada (usuário digita em horário BR)
  if (recorrente.hora_execucao) {
    const [hora, minuto] = recorrente.hora_execucao.split(':').map(Number);
    proximoBr.setHours(hora, minuto, 0, 0);
  } else {
    // Se não tem hora especificada, executa daqui 1 minuto
    proximoBr.setMinutes(proximoBr.getMinutes() + 1);
    return brToUtc(proximoBr);
  }

  switch (recorrente.frequencia) {
    case 'Diária':
      // Sempre agenda para o próximo dia após a execução
      // Se o horário já passou hoje OU estamos processando após criar um chamado,
      // agenda para amanhã
      if (proximoBr <= agoraBr) {
        proximoBr.setDate(proximoBr.getDate() + 1);
      } else {
        // Mesmo que ainda não tenha chegado o horário de hoje,
        // se estamos calculando após criar um chamado, vai para amanhã
        // (isso acontece quando processamos antes do horário agendado)
        const minutosAteHorario = (proximoBr.getTime() - agoraBr.getTime()) / 60000;
        if (minutosAteHorario < 5) {
          // Se faltam menos de 5 minutos, considera que já processamos e vai para amanhã
          proximoBr.setDate(proximoBr.getDate() + 1);
        }
      }
      break;

    case 'Semanal':
      if (recorrente.dias_semana) {
        const diasSelecionados = recorrente.dias_semana.split(',').map(Number);
        const diaAtualBr = proximoBr.getDay();
        
        // Encontrar próximo dia da semana
        let diasAdicionar = 0;
        for (let i = 0; i < 7; i++) {
          const diaTeste = (diaAtualBr + i) % 7;
          if (diasSelecionados.includes(diaTeste)) {
            if (i === 0 && proximoBr <= agoraBr) {
              continue;
            }
            diasAdicionar = i;
            break;
          }
        }
        
        if (diasAdicionar > 0) {
          proximoBr.setDate(proximoBr.getDate() + diasAdicionar);
        } else if (proximoBr <= agoraBr) {
          proximoBr.setDate(proximoBr.getDate() + 7);
        }
      }
      break;

    case 'Mensal':
      if (recorrente.dia_mes) {
        proximoBr.setDate(recorrente.dia_mes);
        if (proximoBr <= agoraBr) {
          proximoBr.setMonth(proximoBr.getMonth() + 1);
        }
      }
      break;

    case 'Anual':
      if (recorrente.dia_mes) {
        proximoBr.setDate(recorrente.dia_mes);
        if (proximoBr <= agoraBr) {
          proximoBr.setFullYear(proximoBr.getFullYear() + 1);
        }
      }
      break;
  }

  // Retornar em UTC para armazenar no banco
  return brToUtc(proximoBr);
}

// Gerar número do ticket
async function gerarNumeroTicket(db: D1Database): Promise<string> {
  // Buscar o maior número de ticket existente para evitar colisões
  const result = await db.prepare(
    `SELECT numero FROM chamados 
     WHERE numero LIKE 'TKT-%' 
     ORDER BY CAST(SUBSTR(numero, 5) AS INTEGER) DESC 
     LIMIT 1`
  ).first<{ numero: string }>();
  
  let proximo = 1;
  if (result?.numero) {
    const match = result.numero.match(/TKT-(\d+)/);
    if (match) {
      proximo = parseInt(match[1], 10) + 1;
    }
  }
  
  return `TKT-${proximo.toString().padStart(6, '0')}`;
}

// Calcular prioridade
function calcularPrioridade(impacto: string | null, urgencia: string | null): string {
  if (!impacto || !urgencia) return 'P4';
  
  if (impacto === 'Alto' && urgencia === 'Alta') return 'P1';
  if ((impacto === 'Alto' && urgencia === 'Média') || (impacto === 'Médio' && urgencia === 'Alta')) return 'P2';
  if ((impacto === 'Alto' && urgencia === 'Baixa') || (impacto === 'Médio' && urgencia === 'Média') || (impacto === 'Baixo' && urgencia === 'Alta')) return 'P3';
  return 'P4';
}

export async function processarManutencoesPreventivas(env: Env) {
  const agoraUtc = new Date();
  const agoraBr = utcToBr(agoraUtc);
  console.log(`[Cron] Processando manutenções preventivas`);
  console.log(`[Cron] Horário UTC: ${agoraUtc.toISOString()}`);
  console.log(`[Cron] Horário BR: ${agoraBr.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

  try {
    // Atualizar status de todas as manutenções
    const { results: manutencoes } = await env.DB.prepare(`
      SELECT id, proxima_manutencao_data, dias_aviso_antecipado
      FROM manutencoes_preventivas
      WHERE ativo = 1
    `).all<any>();

    console.log(`[Cron] Verificando status de ${manutencoes.length} manutenções`);

    const hoje = new Date(agoraBr.toISOString().split('T')[0]);

    for (const manutencao of manutencoes) {
      const dataProxima = new Date(manutencao.proxima_manutencao_data);
      const diasParaVencimento = Math.floor((dataProxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      let novoStatus = 'Em dia';
      if (diasParaVencimento < 0) {
        novoStatus = 'Atrasado';
      } else if (diasParaVencimento <= manutencao.dias_aviso_antecipado) {
        novoStatus = 'Próximo do vencimento';
      }

      await env.DB.prepare(`
        UPDATE manutencoes_preventivas 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(novoStatus, manutencao.id).run();
    }

    // Buscar manutenções que precisam gerar chamado
    const { results: manutencoesParaChamado } = await env.DB.prepare(`
      SELECT 
        mp.*,
        s.nome as setor_nome,
        u.nome as unidade_nome
      FROM manutencoes_preventivas mp
      LEFT JOIN setores s ON mp.setor_id = s.id
      LEFT JOIN unidades u ON mp.unidade_id = u.id
      WHERE mp.ativo = 1 
      AND mp.gerar_chamado_automatico = 1
      AND mp.chamado_gerado_id IS NULL
      AND mp.status IN ('Próximo do vencimento', 'Atrasado')
    `).all<any>();

    console.log(`[Cron] Encontradas ${manutencoesParaChamado.length} manutenções para gerar chamados`);

    for (const manutencao of manutencoesParaChamado) {
      try {
        // Gerar número do ticket
        const numero = await gerarNumeroTicket(env.DB);

        const titulo = `Manutenção Preventiva - ${manutencao.nome_equipamento}`;
        const descricao = `
Manutenção preventiva programada para o equipamento:
- Equipamento: ${manutencao.nome_equipamento}
- Tipo: ${manutencao.tipo_equipamento}
- Patrimônio: ${manutencao.patrimonio || 'N/A'}
- Modelo: ${manutencao.modelo || 'N/A'}
- Localização: ${manutencao.local}
- Setor: ${manutencao.setor_nome || 'N/A'}
- Unidade: ${manutencao.unidade_nome || 'N/A'}

Data programada: ${new Date(manutencao.proxima_manutencao_data).toLocaleDateString('pt-BR')}
Periodicidade: A cada ${manutencao.periodicidade_dias} dias

${manutencao.checklist ? `\nChecklist:\n${manutencao.checklist}` : ''}
${manutencao.observacoes ? `\nObservações:\n${manutencao.observacoes}` : ''}
        `.trim();

        // Determinar prioridade baseada no status
        const urgencia = manutencao.status === 'Atrasado' ? 'Alta' : 'Média';
        const impacto = 'Médio';
        const prioridade = calcularPrioridade(impacto, urgencia);

        // Buscar SLA
        const sla = await env.DB.prepare(
          "SELECT * FROM slas WHERE tipo_chamado = ? AND prioridade = ? AND ativo = TRUE LIMIT 1"
        ).bind('Requisição', prioridade).first<any>();

        const prazoResposta = sla ? new Date(Date.now() + sla.tempo_resposta_minutos * 60000).toISOString() : null;
        const prazoSolucao = sla ? new Date(Date.now() + sla.tempo_solucao_minutos * 60000).toISOString() : null;

        const dataHoraBrasil = getDataHoraBrasil();

        // Criar chamado
        const chamadoResult = await env.DB.prepare(`
          INSERT INTO chamados (
            numero, tipo, solicitante_id, solicitante_nome, solicitante_email,
            titulo, descricao, impacto, urgencia, prioridade, status,
            setor_destino_id, setor_responsavel_execucao_id,
            grupo_responsavel_id, tecnico_responsavel_id,
            sla_id, prazo_resposta, prazo_solucao, origem, data_abertura, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          numero,
          'Requisição',
          'sistema',
          'Sistema de Manutenção',
          'manutencao@tickethpc.com',
          titulo,
          descricao,
          impacto,
          urgencia,
          prioridade,
          'Novo',
          manutencao.setor_id,
          manutencao.setor_id,
          manutencao.grupo_responsavel_id,
          manutencao.responsavel_id,
          sla?.id || null,
          prazoResposta,
          prazoSolucao,
          'Manutenção Preventiva',
          dataHoraBrasil,
          dataHoraBrasil,
          dataHoraBrasil
        ).run();

        const chamadoId = chamadoResult.meta.last_row_id as number;

        // Atualizar manutenção com ID do chamado
        await env.DB.prepare(`
          UPDATE manutencoes_preventivas 
          SET chamado_gerado_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(chamadoId, manutencao.id).run();

        // Adicionar comentário no chamado
        await env.DB.prepare(`
          INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          chamadoId,
          'sistema',
          'Sistema',
          'sistema',
          `Chamado criado automaticamente pelo sistema de manutenção preventiva (ID: ${manutencao.id})`,
          dataHoraBrasil
        ).run();

        // Registrar histórico
        await env.DB.prepare(`
          INSERT INTO historico (chamado_id, user_id, user_nome, tipo, acao, detalhes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          chamadoId,
          'sistema',
          'Sistema',
          'acao_tecnica',
          'Chamado criado automaticamente',
          JSON.stringify({
            manutencao_preventiva_id: manutencao.id,
            equipamento: manutencao.nome_equipamento,
            data_programada: manutencao.proxima_manutencao_data,
            resumo: 'Gerado por manutenção preventiva'
          }),
          dataHoraBrasil
        ).run();

        console.log(`[Cron] ✅ Chamado ${numero} criado para manutenção #${manutencao.id}`);

        // Criar notificação se houver técnico
        if (manutencao.responsavel_id) {
          await env.DB.prepare(`
            INSERT INTO notificacoes (destinatario_id, chamado_id, tipo, titulo, mensagem, via_email)
            VALUES (?, ?, ?, ?, ?, TRUE)
          `).bind(
            manutencao.responsavel_id,
            chamadoId,
            'atribuicao',
            'Manutenção preventiva programada',
            `Chamado ${numero} criado para manutenção preventiva de ${manutencao.nome_equipamento}`
          ).run();
        }

      } catch (error) {
        console.error(`[Cron] ❌ Erro ao criar chamado para manutenção #${manutencao.id}:`, error);
      }
    }

    console.log(`[Cron] Processamento de manutenções preventivas concluído`);
  } catch (error) {
    console.error('[Cron] Erro no processamento de manutenções preventivas:', error);
  }
}

export async function fecharTicketsAutomaticamente(env: Env) {
  const agoraUtc = new Date();
  const agoraBr = utcToBr(agoraUtc);
  console.log(`[Cron] Processando fechamento automático de tickets`);
  console.log(`[Cron] Horário UTC: ${agoraUtc.toISOString()}`);
  console.log(`[Cron] Horário BR: ${agoraBr.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

  try {
    // Fechar tickets sem avaliação após 2 horas
    // Calcular timestamp de 2 horas atrás em UTC
    const duasHorasAtrasUtc = new Date(agoraUtc.getTime() - 2 * 60 * 60 * 1000);

    const { results: ticketsSemAvaliacao } = await env.DB.prepare(`
      SELECT id, numero, titulo, data_resolucao, tecnico_responsavel_id, solicitante_id
      FROM chamados
      WHERE status = 'Aguardando Avaliação'
      AND avaliacao_nota IS NULL
      AND data_resolucao IS NOT NULL
      AND data_resolucao <= ?
    `).bind(duasHorasAtrasUtc.toISOString()).all<any>();

    console.log(`[Cron] Encontrados ${ticketsSemAvaliacao.length} tickets sem avaliação há mais de 2 horas`);

    for (const ticket of ticketsSemAvaliacao) {
      try {
        // Atualizar status para Fechado
        await env.DB.prepare(`
          UPDATE chamados
          SET status = 'Fechado', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(ticket.id).run();

        // Registrar no histórico
        await env.DB.prepare(`
          INSERT INTO historico (chamado_id, user_id, user_nome, tipo, acao, detalhes)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          ticket.id,
          'sistema',
          'Sistema',
          'mudanca_status',
          'Status alterado: Aguardando Avaliação → Fechado',
          JSON.stringify({
            status_anterior: 'Aguardando Avaliação',
            status_novo: 'Fechado',
            motivo: 'Ticket fechado automaticamente após 2 horas sem avaliação',
            data_resolucao: ticket.data_resolucao,
            automático: true
          })
        ).run();

        console.log(`[Cron] ✅ Ticket ${ticket.numero} fechado automaticamente (sem avaliação)`);

      } catch (error) {
        console.error(`[Cron] ❌ Erro ao fechar ticket ${ticket.numero}:`, error);
      }
    }

    console.log(`[Cron] Processamento concluído. Total de tickets fechados: ${ticketsSemAvaliacao.length}`);

  } catch (error) {
    console.error('[Cron] Erro no processamento de fechamento automático:', error);
  }
}

export async function resetarGamificacaoMensal(env: Env) {
  const agoraUtc = new Date();
  const agoraBr = utcToBr(agoraUtc);
  console.log(`[Cron] Verificando reset de gamificação mensal`);
  console.log(`[Cron] Horário UTC: ${agoraUtc.toISOString()}`);
  console.log(`[Cron] Horário BR: ${agoraBr.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

  try {
    // Verificar se é o dia 1º do mês (horário brasileiro)
    const diaMes = agoraBr.getDate();
    
    if (diaMes === 1) {
      console.log(`[Cron] É dia 1º do mês - iniciando reset de gamificação`);
      await resetarPontosMensais(env.DB);
      console.log(`[Cron] ✅ Reset de gamificação mensal concluído com sucesso`);
    } else {
      console.log(`[Cron] Dia ${diaMes} - reset de gamificação só ocorre no dia 1º do mês`);
    }
  } catch (error) {
    console.error('[Cron] Erro no reset de gamificação mensal:', error);
  }
}

export async function processarChamadosRecorrentes(env: Env) {
  const agoraUtc = new Date();
  const agoraBr = utcToBr(agoraUtc);
  console.log(`[Cron] Processando chamados recorrentes`);
  console.log(`[Cron] Horário UTC: ${agoraUtc.toISOString()}`);
  console.log(`[Cron] Horário BR: ${agoraBr.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

  try {
    // Buscar chamados recorrentes ativos que precisam ser executados
    // Compara com horário UTC armazenado no banco
    const { results: recorrentes } = await env.DB.prepare(`
      SELECT * FROM chamados_recorrentes 
      WHERE ativo = 1 
      AND (proximo_chamado_em IS NULL OR proximo_chamado_em <= ?)
    `).bind(agoraUtc.toISOString()).all<ChamadoRecorrente>();

    console.log(`[Cron] Encontrados ${recorrentes.length} chamados recorrentes para processar`);

    for (const recorrente of recorrentes) {
      console.log(`[Cron] Processando recorrente #${recorrente.id}: ${recorrente.titulo}`);

      try {
        // Gerar número do ticket
        const numero = await gerarNumeroTicket(env.DB);
        const prioridade = calcularPrioridade(recorrente.impacto, recorrente.urgencia);

        // Buscar SLA apropriado - ordem de prioridade:
        // 1. SLA específico do item (categoria_id = item_id) - validando setor
        // 2. SLA específico da subcategoria (categoria_id = subcategoria_id) - validando setor
        // 3. SLA específico da categoria (categoria_id = categoria_id) - validando setor
        // 4. SLA genérico por tipo + prioridade + setor
        let sla: any = null;

        // 1. Tentar buscar SLA pelo item_id, validando que seja do setor correto
        if (recorrente.item_id) {
          sla = await env.DB.prepare(
            `SELECT * FROM slas 
             WHERE categoria_id = ? 
             AND (setor_id = ? OR setor_id IS NULL)
             AND ativo = TRUE 
             ORDER BY setor_id DESC
             LIMIT 1`
          ).bind(recorrente.item_id, recorrente.setor_destino_id).first<any>();
        }

        // 2. Se não encontrou, tentar pela subcategoria_id, validando que seja do setor correto
        if (!sla && recorrente.subcategoria_id) {
          sla = await env.DB.prepare(
            `SELECT * FROM slas 
             WHERE categoria_id = ? 
             AND (setor_id = ? OR setor_id IS NULL)
             AND ativo = TRUE 
             ORDER BY setor_id DESC
             LIMIT 1`
          ).bind(recorrente.subcategoria_id, recorrente.setor_destino_id).first<any>();
        }

        // 3. Se não encontrou, tentar pela categoria_id, validando que seja do setor correto
        if (!sla && recorrente.categoria_id) {
          sla = await env.DB.prepare(
            `SELECT * FROM slas 
             WHERE categoria_id = ? 
             AND (setor_id = ? OR setor_id IS NULL)
             AND ativo = TRUE 
             ORDER BY setor_id DESC
             LIMIT 1`
          ).bind(recorrente.categoria_id, recorrente.setor_destino_id).first<any>();
        }

        // 4. Se não encontrou, buscar SLA genérico por tipo + prioridade + setor
        if (!sla) {
          sla = await env.DB.prepare(
            `SELECT * FROM slas 
             WHERE tipo_chamado = ? 
             AND prioridade = ? 
             AND (setor_id = ? OR setor_id IS NULL)
             AND ativo = TRUE 
             ORDER BY setor_id DESC
             LIMIT 1`
          ).bind(recorrente.tipo, prioridade, recorrente.setor_destino_id).first<any>();
        }

        // Apenas calcular prazo de resposta se o SLA tiver tempo_resposta_minutos > 0
        const prazoResposta = (sla && sla.tempo_resposta_minutos > 0)
          ? new Date(Date.now() + sla.tempo_resposta_minutos * 60000).toISOString()
          : null;
        
        const prazoSolucao = sla 
          ? new Date(Date.now() + sla.tempo_solucao_minutos * 60000).toISOString()
          : null;

        const dataHoraBrasil = getDataHoraBrasil();

        // Buscar dados do criador para o chamado
        const criadorProfile = await env.DB.prepare(
          "SELECT email FROM user_profiles WHERE user_id = ?"
        ).bind(recorrente.criador_id).first<{ email: string }>();

        // Criar o chamado
        const chamadoResult = await env.DB.prepare(`
          INSERT INTO chamados (
            numero, tipo, solicitante_id, solicitante_nome, solicitante_email,
            tipo_problema, categoria_id, subcategoria_id, item_id, titulo, descricao,
            impacto, urgencia, prioridade, status, sla_id, prazo_resposta, prazo_solucao,
            setor_destino_id, setor_responsavel_execucao_id, solicitante_setor, grupo_responsavel_id, tecnico_responsavel_id,
            origem_recorrente_id, data_abertura, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          numero,
          recorrente.tipo,
          recorrente.criador_id,
          recorrente.criador_nome,
          criadorProfile?.email || 'sistema@tickethpc.com',
          recorrente.tipo_problema || null,
          recorrente.categoria_id || null,
          recorrente.subcategoria_id || null,
          recorrente.item_id || null,
          recorrente.titulo,
          recorrente.descricao,
          recorrente.impacto || null,
          recorrente.urgencia || null,
          prioridade,
          'Novo',
          sla?.id || null,
          prazoResposta,
          prazoSolucao,
          recorrente.setor_destino_id || null,
          recorrente.setor_responsavel_execucao_id || null,
          recorrente.solicitante_setor || null,
          recorrente.grupo_responsavel_id || null,
          recorrente.tecnico_responsavel_id || null,
          recorrente.id,
          dataHoraBrasil,
          dataHoraBrasil,
          dataHoraBrasil
        ).run();

        const chamadoId = chamadoResult.meta.last_row_id as number;

        // Adicionar comentário explicando que é recorrente
        await env.DB.prepare(`
          INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          chamadoId,
          'sistema',
          'Sistema',
          'sistema',
          `Chamado criado automaticamente por regra de recorrência "${recorrente.titulo}" (ID: ${recorrente.id})`,
          dataHoraBrasil
        ).run();

        // Registrar histórico
        await env.DB.prepare(`
          INSERT INTO historico (chamado_id, user_id, user_nome, tipo, acao, detalhes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          chamadoId,
          'sistema',
          'Sistema',
          'acao_tecnica',
          'Chamado criado automaticamente',
          JSON.stringify({
            recorrente_id: recorrente.id,
            frequencia: recorrente.frequencia,
            resumo: 'Gerado por chamado recorrente'
          }),
          dataHoraBrasil
        ).run();

        // Calcular próximo horário (em UTC)
        const proximoHorarioUtc = calcularProximoHorario(recorrente);
        const proximoHorarioBr = utcToBr(proximoHorarioUtc);

        // Atualizar o recorrente
        await env.DB.prepare(`
          UPDATE chamados_recorrentes 
          SET ultimo_chamado_gerado_em = CURRENT_TIMESTAMP,
              proximo_chamado_em = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(proximoHorarioUtc.toISOString(), recorrente.id).run();

        console.log(`[Cron] ✅ Chamado ${numero} criado com sucesso`);
        console.log(`[Cron] Próxima execução UTC: ${proximoHorarioUtc.toISOString()}`);
        console.log(`[Cron] Próxima execução BR: ${proximoHorarioBr.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

        // Criar notificação se houver técnico atribuído
        if (recorrente.tecnico_responsavel_id) {
          await env.DB.prepare(`
            INSERT INTO notificacoes (destinatario_id, chamado_id, tipo, titulo, mensagem, via_email)
            VALUES (?, ?, ?, ?, ?, FALSE)
          `).bind(
            recorrente.tecnico_responsavel_id,
            chamadoId,
            'atribuicao',
            'Novo chamado recorrente',
            `Chamado recorrente ${numero} foi criado automaticamente e atribuído a você`
          ).run();
        }

      } catch (error) {
        console.error(`[Cron] ❌ Erro ao processar recorrente #${recorrente.id}:`, error);
      }
    }

    console.log(`[Cron] Processamento concluído`);
  } catch (error) {
    console.error('[Cron] Erro no processamento de chamados recorrentes:', error);
  }
}
