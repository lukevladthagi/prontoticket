import type { Chamado } from "../../shared/types";
import { verificarTodosBadges } from "./badges";
import { getDataHoraBrasil } from "../utils/timezone";

export interface PontuacaoRegra {
  tipo: string;
  pontos: number;
  descricao: string;
}

export const REGRAS_PONTUACAO: Record<string, PontuacaoRegra> = {
  incidente_critico: {
    tipo: 'incidente_critico',
    pontos: 10,
    descricao: 'Incidente crítico assistencial resolvido'
  },
  incidente_normal: {
    tipo: 'incidente_normal',
    pontos: 5,
    descricao: 'Incidente normal resolvido'
  },
  requisicao_no_prazo: {
    tipo: 'requisicao_no_prazo',
    pontos: 3,
    descricao: 'Requisição atendida no prazo'
  },
  ticket_documentado: {
    tipo: 'ticket_documentado',
    pontos: 2,
    descricao: 'Ticket bem documentado'
  },
  feedback_positivo: {
    tipo: 'feedback_positivo',
    pontos: 5,
    descricao: 'Feedback positivo do usuário'
  },
  evitar_reincidencia: {
    tipo: 'evitar_reincidencia',
    pontos: 8,
    descricao: 'Evitar reincidência / causa raiz'
  },
  // Regras de projetos
  projeto_entregue: {
    tipo: 'projeto_entregue',
    pontos: 20,
    descricao: 'Projeto entregue'
  },
  projeto_no_prazo: {
    tipo: 'projeto_no_prazo',
    pontos: 10,
    descricao: 'Entrega dentro do prazo'
  },
  projeto_impacto: {
    tipo: 'projeto_impacto',
    pontos: 15,
    descricao: 'Projeto com impacto assistencial'
  },
  projeto_documentacao: {
    tipo: 'projeto_documentacao',
    pontos: 10,
    descricao: 'Documentação e transição completas'
  },
  projeto_treinamento: {
    tipo: 'projeto_treinamento',
    pontos: 5,
    descricao: 'Treinar a equipe após entrega'
  },
  projeto_reduzir_risco: {
    tipo: 'projeto_reduzir_risco',
    pontos: 10,
    descricao: 'Redução comprovada de risco'
  },
  // Regras de treinamento
  treinamento_concluido: {
    tipo: 'treinamento_concluido',
    pontos: 10,
    descricao: 'Concluir treinamento pago'
  },
  aplicar_trabalho: {
    tipo: 'aplicar_trabalho',
    pontos: 10,
    descricao: 'Aplicar no trabalho'
  },
  resolver_problema: {
    tipo: 'resolver_problema',
    pontos: 15,
    descricao: 'Resolver problema real com o curso'
  },
  criar_melhoria: {
    tipo: 'criar_melhoria',
    pontos: 20,
    descricao: 'Criar melhoria/processo'
  },
  compartilhar_equipe: {
    tipo: 'compartilhar_equipe',
    pontos: 10,
    descricao: 'Compartilhar com a equipe'
  },
  documentar_aprendizado: {
    tipo: 'documentar_aprendizado',
    pontos: 5,
    descricao: 'Documentar aprendizado'
  }
};

// Função para adicionar pontos ao técnico/gerente
export async function adicionarPontos(
  db: D1Database,
  userId: string,
  tipoAcao: string,
  pontos: number,
  descricao: string,
  chamadoId?: number,
  projetoId?: number,
  treinamentoId?: number,
  aplicacaoId?: number
): Promise<void> {
  try {
    console.log(`Adicionando ${pontos} pontos para usuário ${userId}, tipo: ${tipoAcao}`);

    // Registrar pontuação
    await db.prepare(
      `INSERT INTO gamificacao_pontos (user_id, chamado_id, projeto_id, treinamento_id, aplicacao_id, tipo_acao, pontos, descricao, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, chamadoId || null, projetoId || null, treinamentoId || null, aplicacaoId || null, tipoAcao, pontos, descricao, getDataHoraBrasil()).run();

    console.log('Pontos registrados na tabela gamificacao_pontos');

    // Buscar perfil do usuário
    const profile = await db.prepare(
      "SELECT nome FROM user_profiles WHERE user_id = ?"
    ).bind(userId).first<{ nome: string }>();

    if (!profile) {
      console.error(`Perfil não encontrado para userId: ${userId}`);
      return;
    }

    console.log(`Perfil encontrado: ${profile.nome}`);

    // Atualizar ranking
    const ranking = await db.prepare(
      "SELECT * FROM gamificacao_ranking WHERE user_id = ?"
    ).bind(userId).first<any>();

    if (ranking) {
      const novoTotal = (ranking.total_pontos || 0) + pontos;
      const novoMes = (ranking.mes_atual || 0) + pontos;
      const novoNivel = Math.floor(novoTotal / 100) + 1;

      await db.prepare(
        `UPDATE gamificacao_ranking 
         SET total_pontos = ?, mes_atual = ?, nivel = ?, updated_at = ?
         WHERE user_id = ?`
      ).bind(novoTotal, novoMes, novoNivel, getDataHoraBrasil(), userId).run();
      
      console.log(`Ranking atualizado: ${novoTotal} pontos totais`);
    } else {
      const nivel = Math.floor(pontos / 100) + 1;
      await db.prepare(
        `INSERT INTO gamificacao_ranking (user_id, user_nome, total_pontos, mes_atual, nivel, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, profile.nome, pontos, pontos, nivel, getDataHoraBrasil(), getDataHoraBrasil()).run();
      
      console.log(`Novo ranking criado com ${pontos} pontos`);
    }

    // Verificar badges após adicionar pontos
    await verificarTodosBadges(db, userId);
    console.log('Badges verificados');
  } catch (error) {
    console.error('Erro ao adicionar pontos:', error);
    throw error;
  }
}

// Função para calcular pontos ao resolver um chamado
export async function calcularPontosResolucao(
  db: D1Database,
  chamado: Chamado
): Promise<void> {
  try {
    if (!chamado.tecnico_responsavel_id) {
      console.log('Ticket sem técnico responsável, pulando gamificação');
      return;
    }

    // Verificar se o técnico resolveu seu próprio chamado (vale 0.5x dos pontos)
    const isAutoAtendimento = chamado.solicitante_id === chamado.tecnico_responsavel_id;
    const multiplicadorAuto = isAutoAtendimento ? 0.5 : 1.0;

    console.log(`Calculando pontos para ticket ${chamado.id}, técnico ${chamado.tecnico_responsavel_id}`);
    if (isAutoAtendimento) {
      console.log('Auto-atendimento detectado - pontos reduzidos a 50%');
    }

    // === SISTEMA DE PONTUAÇÃO JUSTO E BALANCEADO ===
    
    // 1. PONTOS BASE POR PRIORIDADE (complexidade do chamado)
    let pontosBase = 0;
    switch (chamado.prioridade) {
      case 'P1': pontosBase = 20; break; // Crítico - muito complexo
      case 'P2': pontosBase = 15; break; // Alto - complexo
      case 'P3': pontosBase = 10; break; // Médio - normal
      case 'P4': pontosBase = 5; break;  // Baixo - simples
      default: pontosBase = 10; break;
    }

    console.log(`Pontos base (prioridade ${chamado.prioridade}): ${pontosBase}`);

    // 2. MULTIPLICADOR DE COMPLEXIDADE POR CATEGORIA
    let multiplicadorCategoria = 1.0;
    let categoriaNome = 'Outros';
    
    if (chamado.categoria_id) {
      const categoria = await db.prepare(
        "SELECT nome FROM categorias WHERE id = ?"
      ).bind(chamado.categoria_id).first<{ nome: string }>();
      
      if (categoria) {
        categoriaNome = categoria.nome;
        
        // Categorias complexas valem 3x mais
        if (categoria.nome.includes('BI') || 
            categoria.nome.includes('Power BI') ||
            categoria.nome.includes('Infraestrutura') ||
            categoria.nome.includes('Servidor') ||
            categoria.nome.includes('Rede') ||
            categoria.nome.includes('Banco de Dados')) {
          multiplicadorCategoria = 3.0;
        }
        // Categorias médias valem 2x mais
        else if (categoria.nome.includes('Hardware') || 
                 categoria.nome.includes('Software') ||
                 categoria.nome.includes('Sistema') ||
                 categoria.nome.includes('E-MAIL')) {
          multiplicadorCategoria = 2.0;
        }
        // Demais categorias: multiplicador 1.0 (padrão)
        
        console.log(`Categoria: ${categoria.nome}, Multiplicador: ${multiplicadorCategoria}x`);
      }
    }

    // 3. BÔNUS POR ATENDIMENTO NO SLA
    let bonusSLA = 0;
    if (chamado.prazo_solucao && chamado.data_resolucao) {
      const prazo = new Date(chamado.prazo_solucao).getTime();
      const resolucao = new Date(chamado.data_resolucao).getTime();
      
      if (resolucao <= prazo) {
        bonusSLA = 5; // +5 pontos por cumprir o SLA
        console.log('Bônus SLA: +5 pontos (resolvido dentro do prazo)');
      }
    }

    // 4. CALCULAR PONTOS FINAIS
    const pontosAntesMultiplicador = pontosBase * multiplicadorCategoria + bonusSLA;
    const pontosTotais = Math.round(pontosAntesMultiplicador * multiplicadorAuto);

    console.log(`Cálculo: (${pontosBase} × ${multiplicadorCategoria}) + ${bonusSLA} = ${pontosAntesMultiplicador}`);
    console.log(`Multiplicador auto-atendimento: ${multiplicadorAuto}x`);
    console.log(`TOTAL: ${pontosTotais} pontos`);

    // 5. REGISTRAR PONTOS COM DESCRIÇÃO DETALHADA
    const descricaoDetalhada = [
      `Ticket ${chamado.numero} resolvido`,
      `(${chamado.prioridade}`,
      categoriaNome !== 'Outros' ? `- ${categoriaNome}` : '',
      multiplicadorCategoria > 1 ? `×${multiplicadorCategoria}` : '',
      bonusSLA > 0 ? '+ SLA' : '',
      isAutoAtendimento ? '- auto' : '',
      `)`
    ].filter(Boolean).join(' ');

    await adicionarPontos(
      db,
      chamado.tecnico_responsavel_id,
      'resolucao',
      pontosTotais,
      descricaoDetalhada,
      chamado.id!
    );

    console.log(`✓ Pontos calculados e registrados com sucesso!`);
  } catch (error) {
    console.error(`Erro ao calcular pontos para ticket ${chamado.id}:`, error);
    throw error;
  }
}

// Função para adicionar pontos por feedback positivo
export async function calcularPontosFeedback(
  db: D1Database,
  chamado: Chamado
): Promise<void> {
  if (!chamado.tecnico_responsavel_id || !chamado.avaliacao_nota) return;

  // Não contabilizar se o técnico avaliou seu próprio chamado
  if (chamado.solicitante_id === chamado.tecnico_responsavel_id) {
    console.log(`Ignorando avaliação - técnico ${chamado.tecnico_responsavel_id} avaliou próprio chamado ${chamado.id}`);
    return;
  }

  // Calcular pontos baseado na nota da avaliação
  let pontosFeedback = 0;
  switch (chamado.avaliacao_nota) {
    case 5: pontosFeedback = 10; break; // Excelente
    case 4: pontosFeedback = 5; break;  // Bom
    case 3: pontosFeedback = 2; break;  // Regular
    default: pontosFeedback = 0; break; // Ruim (sem pontos)
  }

  if (pontosFeedback > 0) {
    await adicionarPontos(
      db,
      chamado.tecnico_responsavel_id,
      'feedback',
      pontosFeedback,
      `Avaliação ${chamado.avaliacao_nota}⭐ no ticket ${chamado.numero}`,
      chamado.id!
    );
    console.log(`Feedback registrado: ${pontosFeedback} pontos por avaliação ${chamado.avaliacao_nota}⭐`);
  }
}

// Função para obter ranking de usuários
export async function obterRanking(
  db: D1Database,
  periodo: 'total' | 'mes' = 'total',
  limite: number = 10
): Promise<any[]> {
  const campo = periodo === 'mes' ? 'mes_atual' : 'total_pontos';
  
  // Filtrar apenas técnicos do setor TI (setor_id = 1)
  const { results } = await db.prepare(
    `SELECT gr.* FROM gamificacao_ranking gr
     INNER JOIN user_profiles up ON gr.user_id = up.user_id
     WHERE up.setor_id = 1
     ORDER BY gr.${campo} DESC 
     LIMIT ?`
  ).bind(limite).all();

  return results;
}

// Função para resetar pontos mensais (executar no início de cada mês)
export async function resetarPontosMensais(db: D1Database): Promise<void> {
  try {
    // Obter data do mês anterior no formato YYYY-MM
    const agora = new Date();
    const mesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const mesAno = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`;

    console.log(`Salvando histórico do mês ${mesAno}`);

    // Buscar todos os usuários do ranking que têm pontos no mês
    const { results: ranking } = await db.prepare(
      `SELECT gr.*, up.setor_id 
       FROM gamificacao_ranking gr
       INNER JOIN user_profiles up ON gr.user_id = up.user_id
       WHERE gr.mes_atual > 0 AND up.setor_id = 1
       ORDER BY gr.mes_atual DESC`
    ).all();

    // Salvar histórico mensal com posição no ranking
    let posicao = 1;
    for (const user of ranking) {
      await db.prepare(
        `INSERT INTO gamificacao_historico_mensal (user_id, user_nome, mes_ano, pontos, nivel, posicao_ranking, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        user.user_id,
        user.user_nome,
        mesAno,
        user.mes_atual,
        user.nivel,
        posicao,
        getDataHoraBrasil(),
        getDataHoraBrasil()
      ).run();
      
      posicao++;
    }

    console.log(`Histórico salvo para ${ranking.length} usuários`);

    // Resetar pontos mensais
    await db.prepare(
      "UPDATE gamificacao_ranking SET mes_atual = 0, updated_at = ?"
    ).bind(getDataHoraBrasil()).run();

    console.log('Pontos mensais resetados com sucesso');
  } catch (error) {
    console.error('Erro ao resetar pontos mensais:', error);
    throw error;
  }
}

// Função para obter histórico mensal
export async function obterHistoricoMensal(
  db: D1Database,
  mesAno: string,
  limite: number = 10
): Promise<any[]> {
  const { results } = await db.prepare(
    `SELECT * FROM gamificacao_historico_mensal
     WHERE mes_ano = ?
     ORDER BY posicao_ranking ASC
     LIMIT ?`
  ).bind(mesAno, limite).all();

  return results;
}

// Função para listar meses disponíveis no histórico
export async function listarMesesDisponiveis(db: D1Database): Promise<string[]> {
  const { results } = await db.prepare(
    `SELECT DISTINCT mes_ano FROM gamificacao_historico_mensal
     ORDER BY mes_ano DESC`
  ).all();

  return results.map((r: any) => r.mes_ano);
}
