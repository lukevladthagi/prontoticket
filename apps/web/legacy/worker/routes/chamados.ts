import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { 
  Chamado, 
  CreateChamadoDTO, 
  UpdateChamadoDTO, 
  AvaliacaoChamadoDTO,
  Comentario,
  CreateComentarioDTO,
  Historico,
  UserProfile,
  Prioridade,
  Impacto,
  Urgencia,
  TipoHistorico,
  HistoricoDetalhes
} from "../../shared/types";
import { calcularPontosResolucao, calcularPontosFeedback } from "../services/gamificacao";
import { calcularPrazoSLA } from "../utils/sla-calculator";
import { enviarNotificacaoTelegram, enviarNotificacaoChatTelegram } from "../utils/telegram-notifier";
import { getDataHoraBrasil } from "../utils/timezone";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Função para calcular prioridade baseada em impacto e urgência
function calcularPrioridade(impacto: Impacto | null, urgencia: Urgencia | null): Prioridade {
  if (!impacto || !urgencia) return 'P4';
  
  if (impacto === 'Alto' && urgencia === 'Alta') return 'P1';
  if ((impacto === 'Alto' && urgencia === 'Média') || (impacto === 'Médio' && urgencia === 'Alta')) return 'P2';
  if ((impacto === 'Alto' && urgencia === 'Baixa') || (impacto === 'Médio' && urgencia === 'Média') || (impacto === 'Baixo' && urgencia === 'Alta')) return 'P3';
  return 'P4';
}

// Função para gerar número do ticket
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

// Função para criar notificação
async function criarNotificacao(
  env: Env,
  destinatarioId: string,
  chamadoId: number,
  tipo: string,
  titulo: string,
  mensagem: string
) {
  const db = env.DB;
  
  // Inserir notificação
  await db.prepare(
    `INSERT INTO notificacoes (destinatario_id, chamado_id, tipo, titulo, mensagem, via_email, created_at)
     VALUES (?, ?, ?, ?, ?, FALSE, ?)`
  ).bind(destinatarioId, chamadoId, tipo, titulo, mensagem, getDataHoraBrasil()).run();
}

// Função para registrar histórico
async function registrarHistorico(
  db: D1Database,
  chamadoId: number,
  userId: string,
  userNome: string,
  tipo: TipoHistorico,
  acao: string,
  detalhes?: HistoricoDetalhes,
  campo?: string,
  valorAnterior?: string,
  valorNovo?: string
) {
  const detalhesJson = detalhes ? JSON.stringify(detalhes) : null;
  
  await db.prepare(
    `INSERT INTO historico (chamado_id, user_id, user_nome, tipo, acao, campo_alterado, valor_anterior, valor_novo, detalhes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    chamadoId, 
    userId, 
    userNome, 
    tipo,
    acao, 
    campo || null, 
    valorAnterior || null, 
    valorNovo || null,
    detalhesJson,
    getDataHoraBrasil()
  ).run();
}

// Listar chamados
router.get("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  const status = c.req.query("status");
  const prioridade = c.req.query("prioridade");
  const unidade = c.req.query("unidade_id");
  const setorDestino = c.req.query("setor_destino_id");
  const setorSolicitante = c.req.query("setor_solicitante");
  const tipoProblema = c.req.query("tipo_problema");
  const dataInicio = c.req.query("data_inicio");
  const dataFim = c.req.query("data_fim");
  const busca = c.req.query("busca");
  const view = c.req.query("view") || "todos"; // todos, meus, novos, em_atendimento, resolvido, fechado
  const alertaGlobal = c.req.query("alerta_global") === "true"; // Para alertas: ignora filtros de setor
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  let query = `SELECT 
    chamados.*,
    user_profiles.nome as tecnico_responsavel_nome
  FROM chamados 
  LEFT JOIN user_profiles ON chamados.tecnico_responsavel_id = user_profiles.user_id
  WHERE 1=1`;
  const params: any[] = [];

  // Aplicar filtros de visualização
  if (view === "meus") {
    // Meus Chamados = chamados que EU criei (incluindo os que viraram projeto)
    query += " AND solicitante_id = ?";
    params.push(user.id);
  } else if (profile.perfil === 'solicitante') {
    // Solicitantes sempre veem apenas seus próprios chamados (incluindo os que viraram projeto)
    query += " AND solicitante_id = ?";
    params.push(user.id);
  } else {
    // Técnicos, gestores e admins NÃO veem tickets marcados como projeto
    query += " AND (chamados.is_projeto IS NULL OR chamados.is_projeto = 0)";
  }
  
  // APENAS Técnicos veem apenas seu setor (gestores e admins veem tudo)
  // Aplicar este filtro DEPOIS do filtro de "meus" para que ele se aplique a todas as outras views
  // EXCETO quando alerta_global=true (para sistema de alertas de novos tickets)
  if (profile.perfil === 'tecnico' && profile.setor_id && view !== "meus" && !alertaGlobal) {
    // Buscar setores adicionais que o usuário tem acesso
    const setoresAdicionais = await c.env.DB.prepare(
      `SELECT setor_id FROM user_setores_acesso WHERE user_profile_id = ?`
    ).bind(profile.id).all<{ setor_id: number }>();
    
    const setoresPermitidos = [profile.setor_id];
    if (setoresAdicionais.results && setoresAdicionais.results.length > 0) {
      setoresAdicionais.results.forEach(s => setoresPermitidos.push(s.setor_id));
    }
    
    const filaTecnico = await c.env.DB.prepare(
      `SELECT id FROM filas_atendimento 
       WHERE setor_id = ? AND responsavel_id = ? AND tipo = 'tecnico' AND ativo = TRUE 
       LIMIT 1`
    ).bind(profile.setor_id, user.id).first<{ id: number }>();
    
    if (filaTecnico) {
      query += " AND fila_id = ?";
      params.push(filaTecnico.id);
    } else {
      // Filtrar por múltiplos setores se o usuário tiver acesso adicional
      if (setoresPermitidos.length === 1) {
        query += " AND setor_destino_id = ?";
        params.push(profile.setor_id);
      } else {
        const placeholders = setoresPermitidos.map(() => '?').join(',');
        query += ` AND setor_destino_id IN (${placeholders})`;
        setoresPermitidos.forEach(sid => params.push(sid));
      }
    }
  }

  // Filtros por aba de status
  if (view === "novos") {
    query += " AND status = 'Novo' AND tecnico_responsavel_id IS NULL";
  } else if (view === "atribuidos") {
    query += " AND tecnico_responsavel_id = ? AND sla_pausado_em IS NULL";
    params.push(user.id);
  } else if (view === "pausados") {
    query += " AND sla_pausado_em IS NOT NULL";
  } else if (view === "em_atendimento") {
    query += " AND status IN ('Em triagem', 'Em atendimento', 'Pausado - Usuário', 'Pausado - Fornecedor')";
  } else if (view === "resolvido") {
    query += " AND status = 'Resolvido'";
  } else if (view === "fechado") {
    query += " AND status IN ('Fechado', 'Cancelado')";
  }

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  if (prioridade) {
    query += " AND prioridade = ?";
    params.push(prioridade);
  }

  if (unidade) {
    query += " AND unidade_id = ?";
    params.push(parseInt(unidade));
  }

  if (setorDestino) {
    query += " AND setor_destino_id = ?";
    params.push(parseInt(setorDestino));
  }

  if (setorSolicitante) {
    if (setorSolicitante === 'Não especificado') {
      query += " AND solicitante_setor IS NULL";
    } else {
      query += " AND solicitante_setor = ?";
      params.push(setorSolicitante);
    }
  }

  if (tipoProblema) {
    query += " AND tipo_problema = ?";
    params.push(tipoProblema);
  }

  if (dataInicio) {
    query += " AND DATE(data_abertura) >= DATE(?)";
    params.push(dataInicio);
  }

  if (dataFim) {
    query += " AND DATE(data_abertura) <= DATE(?)";
    params.push(dataFim);
  }

  if (busca) {
    query += " AND (chamados.numero LIKE ? OR chamados.titulo LIKE ? OR chamados.descricao LIKE ?)";
    const buscaTermo = `%${busca}%`;
    params.push(buscaTermo, buscaTermo, buscaTermo);
  }

  // Contar total de registros antes de aplicar LIMIT/OFFSET
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, "SELECT COUNT(*) as total FROM");
  const countResult = await c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countResult?.total || 0;
  const totalPaginas = Math.ceil(total / limit);

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...params).all<Chamado>();

  return c.json({
    chamados: results,
    paginacao: {
      pagina_atual: page,
      total_paginas: totalPaginas,
      total_registros: total,
      registros_por_pagina: limit
    }
  });
});

// Criar chamado
router.post("/", authMiddleware, async (c) => {
  try {
  const user = c.get("user")!;
  let profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  // Criar perfil automaticamente se não existir
  if (!profile) {
    const result = await c.env.DB.prepare(
      `INSERT INTO user_profiles (user_id, nome, email, perfil, ativo)
       VALUES (?, ?, ?, ?, TRUE)`
    ).bind(
      user.id,
      user.google_user_data?.name || user.email,
      user.email,
      "solicitante"
    ).run();

    profile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE id = ?"
    ).bind(result.meta.last_row_id).first<UserProfile>();
  }

  if (!profile) {
    return c.json({ error: "Erro ao criar perfil do usuário" }, 500);
  }

  const body: CreateChamadoDTO = await c.req.json();

  const numero = await gerarNumeroTicket(c.env.DB);
  
  // Verificar se alguma categoria tem prioridade automática
  let prioridadeAutomatica: Prioridade | null = null;
  
  // Verificar na ordem: item > subcategoria > categoria
  if (body.item_id) {
    const itemInfo = await c.env.DB.prepare(
      "SELECT prioridade_automatica FROM categorias WHERE id = ?"
    ).bind(body.item_id).first<{ prioridade_automatica: string | null }>();
    
    if (itemInfo?.prioridade_automatica) {
      prioridadeAutomatica = itemInfo.prioridade_automatica as Prioridade;
    }
  }
  
  if (!prioridadeAutomatica && body.subcategoria_id) {
    const subcategoriaInfo = await c.env.DB.prepare(
      "SELECT prioridade_automatica FROM categorias WHERE id = ?"
    ).bind(body.subcategoria_id).first<{ prioridade_automatica: string | null }>();
    
    if (subcategoriaInfo?.prioridade_automatica) {
      prioridadeAutomatica = subcategoriaInfo.prioridade_automatica as Prioridade;
    }
  }
  
  if (!prioridadeAutomatica && body.categoria_id) {
    const categoriaInfo = await c.env.DB.prepare(
      "SELECT prioridade_automatica FROM categorias WHERE id = ?"
    ).bind(body.categoria_id).first<{ prioridade_automatica: string | null }>();
    
    if (categoriaInfo?.prioridade_automatica) {
      prioridadeAutomatica = categoriaInfo.prioridade_automatica as Prioridade;
    }
  }
  
  // Usar prioridade automática se existir, senão calcular por impacto x urgência
  const prioridade = prioridadeAutomatica || calcularPrioridade(body.impacto || null, body.urgencia || null);

  // Buscar nome do setor do solicitante via JOIN se não foi fornecido no body
  let setorSolicitante = body.setor_solicitante || null;
  if (!setorSolicitante && profile.setor_id) {
    const setorInfo = await c.env.DB.prepare(
      "SELECT nome FROM setores WHERE id = ?"
    ).bind(profile.setor_id).first<{ nome: string }>();
    
    if (setorInfo) {
      setorSolicitante = setorInfo.nome;
    }
  }

  // Buscar SLA apropriado - ordem de prioridade:
  // 1. SLA específico do item (categoria_id = item_id)
  // 2. SLA específico da subcategoria (categoria_id = subcategoria_id)
  // 3. SLA específico da categoria (categoria_id = categoria_id)
  // 4. SLA genérico por tipo + prioridade + setor
  const setorId = body.setor_destino_id || null;
  let sla = null;

  // 1. Tentar buscar SLA pelo item_id
  if (body.item_id) {
    sla = await c.env.DB.prepare(
      `SELECT * FROM slas 
       WHERE categoria_id = ? 
       AND ativo = TRUE 
       LIMIT 1`
    ).bind(body.item_id).first<any>();
  }

  // 2. Se não encontrou, tentar pela subcategoria_id
  if (!sla && body.subcategoria_id) {
    sla = await c.env.DB.prepare(
      `SELECT * FROM slas 
       WHERE categoria_id = ? 
       AND ativo = TRUE 
       LIMIT 1`
    ).bind(body.subcategoria_id).first<any>();
  }

  // 3. Se não encontrou, tentar pela categoria_id
  if (!sla && body.categoria_id) {
    sla = await c.env.DB.prepare(
      `SELECT * FROM slas 
       WHERE categoria_id = ? 
       AND ativo = TRUE 
       LIMIT 1`
    ).bind(body.categoria_id).first<any>();
  }

  // 3.5. Para setores não-TI (Hotelaria, Rouparia, etc): buscar categoria pelo nome do tipo_problema
  // e usar o SLA dessa categoria
  let categoriaIdParaSalvar = body.categoria_id || null;
  if (!sla && body.tipo_problema && setorId) {
    const categoriaPorNome = await c.env.DB.prepare(
      `SELECT id FROM categorias 
       WHERE nome = ? 
       AND setor_id = ? 
       AND ativo = 1 
       LIMIT 1`
    ).bind(body.tipo_problema, setorId).first<{ id: number }>();
    
    if (categoriaPorNome) {
      categoriaIdParaSalvar = categoriaPorNome.id;
      sla = await c.env.DB.prepare(
        `SELECT * FROM slas 
         WHERE categoria_id = ? 
         AND ativo = TRUE 
         LIMIT 1`
      ).bind(categoriaPorNome.id).first<any>();
    }
  }

  // 4. Se não encontrou, buscar SLA genérico por tipo + prioridade + setor
  if (!sla) {
    // Mapear "Problema" para "Incidente" para compatibilidade com SLAs cadastrados
    const tipoChamadoParaSLA = body.tipo === 'Problema' ? 'Incidente' : body.tipo;
    
    sla = await c.env.DB.prepare(
      `SELECT * FROM slas 
       WHERE tipo_chamado = ? 
       AND prioridade = ? 
       AND (setor_id = ? OR setor_id IS NULL)
       AND ativo = TRUE 
       ORDER BY setor_id DESC
       LIMIT 1`
    ).bind(tipoChamadoParaSLA, prioridade, setorId).first<any>();
  }

  // Buscar nome do setor para verificações baseadas em nome (não ID)
  const setorDestino = setorId ? await c.env.DB.prepare(
    "SELECT nome FROM setores WHERE id = ?"
  ).bind(setorId).first<{ nome: string }>() : null;

  // Para Manutenção, Hotelaria e Rouparia: se afeta paciente, reduzir SLA de 6h para 4h
  if (sla && ['Manutenção', 'Hotelaria', 'Rouparia'].includes(setorDestino?.nome || '') && body.afeta_paciente === true) {
    // Reduzir tempo de solução de 360 min (6h) para 240 min (4h)
    if (sla.tempo_solucao_minutos === 360) {
      sla = { ...sla, tempo_solucao_minutos: 240 };
    }
  }

  // Calcular prazos considerando horários de atendimento do setor
  // Usar data/hora atual UTC para calcular os prazos
  const dataInicio = new Date();
  const dataAberturaBrasil = getDataHoraBrasil();
  
  // Apenas calcular prazo de resposta se o SLA tiver tempo_resposta_minutos > 0
  const prazoResposta = (sla && sla.tempo_resposta_minutos > 0)
    ? (await calcularPrazoSLA(c.env.DB, setorId, dataInicio, sla.tempo_resposta_minutos)).toISOString()
    : null;
  
  const prazoSolucao = sla 
    ? (await calcularPrazoSLA(c.env.DB, setorId, dataInicio, sla.tempo_solucao_minutos)).toISOString()
    : null;

  // Para TI, buscar fila Helpdesk automaticamente
  let filaId = null;
  if (setorId && setorDestino?.nome === 'TI') {
    const filaHelpdesk = await c.env.DB.prepare(
      `SELECT id FROM filas_atendimento 
       WHERE setor_id = ? AND tipo = 'helpdesk' AND ativo = TRUE 
       LIMIT 1`
    ).bind(setorId).first<{ id: number }>();
    
    filaId = filaHelpdesk?.id || null;
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO chamados (
      numero, tipo, solicitante_id, solicitante_nome, solicitante_email, 
      solicitante_telefone, solicitante_setor, unidade_id, categoria_id, 
      subcategoria_id, item_id, titulo, descricao, impacto, urgencia, 
      prioridade, status, ambiente, passos_reproduzir, sla_id, 
      prazo_resposta, prazo_solucao, setor_destino_id, afeta_paciente, fila_id, data_abertura, tipo_problema, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    numero,
    body.tipo,
    user.id,
    profile.nome,
    profile.email,
    profile.telefone || null,
    setorSolicitante,
    body.unidade_id || profile.unidade_id || null,
    categoriaIdParaSalvar,
    body.subcategoria_id || null,
    body.item_id || null,
    body.titulo,
    body.descricao,
    body.impacto || null,
    body.urgencia || null,
    prioridade,
    'Novo',
    body.ambiente || null,
    body.passos_reproduzir || null,
    sla?.id || null,
    prazoResposta,
    prazoSolucao,
    body.setor_destino_id || null,
    body.afeta_paciente || false,
    filaId,
    dataAberturaBrasil,
    body.tipo_problema || null,
    dataAberturaBrasil,
    dataAberturaBrasil
  ).run();

  const chamadoId = result.meta.last_row_id as number;

  // Registrar histórico
  await registrarHistorico(
    c.env.DB,
    chamadoId,
    user.id,
    profile.nome,
    'acao_tecnica',
    'Chamado criado',
    {
      local: profile.setor || 'Não especificado',
      resumo: `Chamado aberto pelo usuário ${profile.nome}`
    }
  );

  // Criar notificação para o solicitante
  await criarNotificacao(
    c.env,
    user.id,
    chamadoId,
    'abertura',
    'Chamado criado',
    `Seu chamado ${numero} foi criado com sucesso.`
  );

  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(chamadoId).first<Chamado>();

  return c.json(chamado, 201);
  } catch (error: any) {
    console.error('Erro ao criar chamado:', error);
    return c.json({ 
      error: "Erro ao criar chamado", 
      details: error?.message || String(error),
      stack: error?.stack 
    }, 500);
  }
});

// Obter chamado por ID
router.get("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  if (!chamado) {
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  // Solicitante só pode ver seus próprios chamados
  if (profile?.perfil === 'solicitante' && chamado.solicitante_id !== user.id) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  return c.json(chamado);
});

// Atualizar chamado
router.put("/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const body: UpdateChamadoDTO = await c.req.json();

    console.log(`[ATUALIZAR CHAMADO] ID: ${id}, User: ${user.id}, Body:`, JSON.stringify(body));

    const profile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first<UserProfile>();

    if (!profile || profile.perfil === 'solicitante') {
      console.log(`[ATUALIZAR CHAMADO] Acesso negado - perfil:`, profile?.perfil);
      return c.json({ error: "Acesso negado" }, 403);
    }

    const chamadoAnterior = await c.env.DB.prepare(
      "SELECT * FROM chamados WHERE id = ?"
    ).bind(id).first<Chamado>();

    if (!chamadoAnterior) {
      console.log(`[ATUALIZAR CHAMADO] Chamado não encontrado - ID: ${id}`);
      return c.json({ error: "Chamado não encontrado" }, 404);
    }

  console.log(`[ATUALIZAR CHAMADO] Status atual: "${chamadoAnterior.status}", Novo status: "${body.status}"`);

  const updates: string[] = [];
  const params: any[] = [];

  if (body.status) {
    updates.push("status = ?");
    params.push(body.status);
    console.log(`[ATUALIZAR CHAMADO] Adicionando mudança de status: "${chamadoAnterior.status}" -> "${body.status}"`);

    // Lógica de pausa de SLA - Pausar quando entra em "Aguardando"
    const statusAguardando = ['Aguardando usuário', 'Aguardando fornecedor', 'Pausado - Usuário', 'Pausado - Fornecedor'];
    const eraAguardando = statusAguardando.includes(chamadoAnterior.status);
    const ficouAguardando = statusAguardando.includes(body.status);

    if (ficouAguardando && !eraAguardando) {
      // Começou a aguardar - pausar o SLA
      console.log(`[ATUALIZAR CHAMADO] Pausando SLA - entrando em status "${body.status}"`);
      updates.push("sla_pausado_em = ?");
      params.push(getDataHoraBrasil());
      updates.push("sla_pausado_motivo = ?");
      params.push(body.sla_pausado_motivo || `Aguardando: ${body.status}`);
    } else if (eraAguardando && !ficouAguardando) {
      // Saiu do aguardando - retomar o SLA e acumular tempo pausado
      console.log(`[ATUALIZAR CHAMADO] Retomando SLA - saindo de status "${chamadoAnterior.status}"`);
      
      if (chamadoAnterior.sla_pausado_em) {
        const pausadoEm = new Date(chamadoAnterior.sla_pausado_em);
        const agora = new Date(getDataHoraBrasil());
        const minutosPassados = Math.floor((agora.getTime() - pausadoEm.getTime()) / (1000 * 60));
        const novoTempoPausado = (chamadoAnterior.tempo_pausado_minutos || 0) + minutosPassados;
        
        console.log(`[ATUALIZAR CHAMADO] Tempo pausado: ${minutosPassados} minutos. Total acumulado: ${novoTempoPausado}`);
        
        updates.push("tempo_pausado_minutos = ?");
        params.push(novoTempoPausado);
        updates.push("sla_pausado_em = ?");
        params.push(null);
        updates.push("sla_pausado_motivo = ?");
        params.push(null);
        
        // ITIL: Estender os prazos de SLA descontando o tempo pausado
        if (chamadoAnterior.prazo_resposta) {
          const prazoRespostaAtual = new Date(chamadoAnterior.prazo_resposta);
          const novoPrazoResposta = new Date(prazoRespostaAtual.getTime() + minutosPassados * 60000);
          updates.push("prazo_resposta = ?");
          params.push(novoPrazoResposta.toISOString());
          console.log(`[ATUALIZAR CHAMADO] Estendendo prazo_resposta em ${minutosPassados} minutos: ${chamadoAnterior.prazo_resposta} -> ${novoPrazoResposta.toISOString()}`);
        }
        
        if (chamadoAnterior.prazo_solucao) {
          const prazoSolucaoAtual = new Date(chamadoAnterior.prazo_solucao);
          const novoPrazoSolucao = new Date(prazoSolucaoAtual.getTime() + minutosPassados * 60000);
          updates.push("prazo_solucao = ?");
          params.push(novoPrazoSolucao.toISOString());
          console.log(`[ATUALIZAR CHAMADO] Estendendo prazo_solucao em ${minutosPassados} minutos: ${chamadoAnterior.prazo_solucao} -> ${novoPrazoSolucao.toISOString()}`);
        }
      }
    }

    // Atualizar datas específicas conforme o status
    if (body.status === 'Resolvido' && !chamadoAnterior.data_resolucao) {
      console.log(`[ATUALIZAR CHAMADO] Definindo data_resolucao`);
      updates.push("data_resolucao = ?");
      params.push(getDataHoraBrasil());
    }
    if (body.status === 'Fechado' && !chamadoAnterior.data_fechamento) {
      console.log(`[ATUALIZAR CHAMADO] Definindo data_fechamento`);
      updates.push("data_fechamento = ?");
      params.push(getDataHoraBrasil());
    }

    console.log(`[ATUALIZAR CHAMADO] Registrando histórico de mudança de status`);
    // Registrar mudança de status
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'mudanca_status',
      `Status alterado de "${chamadoAnterior.status}" para "${body.status}"`,
      {
        motivo: body.status === 'Resolvido' ? 'Solução aplicada' : 
                body.status === 'Aguardando usuário' ? 'Aguardando resposta do usuário' :
                body.status === 'Aguardando fornecedor' ? 'Dependência de fornecedor' : undefined
      },
      'status',
      chamadoAnterior.status,
      body.status
    );

    console.log(`[ATUALIZAR CHAMADO] Criando comentário do sistema`);
    // Criar comentário do sistema sobre mudança de status
    await c.env.DB.prepare(
      `INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      parseInt(id),
      user.id,
      'Sistema',
      'sistema',
      `${profile.nome} alterou o status do chamado de "${chamadoAnterior.status}" para "${body.status}"`,
      getDataHoraBrasil()
    ).run();

    console.log(`[ATUALIZAR CHAMADO] Notificando solicitante`);
    // Notificar solicitante
    await criarNotificacao(
      c.env,
      chamadoAnterior.solicitante_id,
      parseInt(id),
      'mudanca_status',
      'Status do chamado alterado',
      `Seu chamado ${chamadoAnterior.numero} mudou para: ${body.status}`
    );

    // Notificar técnico responsável se houver e não for ele próprio que mudou
    if (chamadoAnterior.tecnico_responsavel_id && chamadoAnterior.tecnico_responsavel_id !== user.id) {
      await criarNotificacao(
        c.env,
        chamadoAnterior.tecnico_responsavel_id,
        parseInt(id),
        'mudanca_status',
        'Status do chamado alterado',
        `${profile.nome} alterou o status do chamado ${chamadoAnterior.numero} para: ${body.status}`
      );
    }

    // Enviar notificação via Telegram
    await enviarNotificacaoTelegram(
      c.env,
      chamadoAnterior.solicitante_id,
      `📋 <b>Status Atualizado - Chamado ${chamadoAnterior.numero}</b>\n\n` +
      `Novo status: <b>${body.status}</b>`
    );

    // Enviar notificação no chat do Telegram onde o chamado foi criado
    await enviarNotificacaoChatTelegram(
      c.env,
      parseInt(id),
      `📋 <b>Status Atualizado - Chamado ${chamadoAnterior.numero}</b>\n\n` +
      `Novo status: <b>${body.status}</b>\n` +
      `Atualizado por: ${profile.nome}`
    );

    // Se mudou para Resolvido, enviar mensagem no Telegram solicitando avaliação
    if (body.status === 'Resolvido') {
      const solicitanteProfile = await c.env.DB.prepare(
        "SELECT telegram_user_id FROM user_profiles WHERE user_id = ?"
      ).bind(chamadoAnterior.solicitante_id).first<{ telegram_user_id: string | null }>();

      if (solicitanteProfile?.telegram_user_id && c.env.TELEGRAM_BOT_TOKEN) {
        try {
          const mensagemResolucao = `✅ <b>Chamado ${chamadoAnterior.numero} RESOLVIDO!</b>\n\n` +
                                    `Seu chamado foi marcado como resolvido pelo técnico.\n\n` +
                                    `⭐ <b>Avalie o atendimento:</b>\n\n` +
                                    `De 1 a 5 estrelas, como você avalia o atendimento?\n` +
                                    `• 1-2 ⭐: Insatisfeito\n` +
                                    `• 3 ⭐⭐⭐: Neutro\n` +
                                    `• 4-5 ⭐⭐⭐⭐⭐: Satisfeito\n\n` +
                                    `Digite apenas o número de 1 a 5.`;
          
          const url = `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: solicitanteProfile.telegram_user_id,
              text: mensagemResolucao,
              parse_mode: 'HTML'
            })
          });

          // Marcar que estamos aguardando avaliação
          await c.env.DB.prepare(`
            INSERT INTO telegram_conversas (chat_id, user_id, username, first_name, mensagem, tipo, chamado_id, coleta_ativa, campo_atual)
            VALUES (?, ?, ?, ?, ?, 'assistente', ?, 1, 'avaliacao_nota')
          `).bind(
            solicitanteProfile.telegram_user_id,
            chamadoAnterior.solicitante_id,
            '',
            '',
            mensagemResolucao,
            parseInt(id)
          ).run();

          console.log('Mensagem de resolução e solicitação de avaliação enviada para o Telegram');
        } catch (error) {
          console.error('Erro ao enviar mensagem de resolução para o Telegram:', error);
        }
      }
    }

    // Atualizar datas específicas
    if (body.status === 'Resolvido' && !chamadoAnterior.data_resolucao) {
      updates.push("data_resolucao = ?");
      params.push(getDataHoraBrasil());
    }
    if (body.status === 'Fechado' && !chamadoAnterior.data_fechamento) {
      updates.push("data_fechamento = ?");
      params.push(getDataHoraBrasil());
    }

    // Se mudou para Resolvido, calcular pontos de gamificação
    if (body.status === 'Resolvido' && chamadoAnterior.status !== 'Resolvido') {
      const dataResolucaoBrasil = getDataHoraBrasil();
      const chamadoAtualizado = { ...chamadoAnterior, status: 'Resolvido', data_resolucao: dataResolucaoBrasil };
      await calcularPontosResolucao(c.env.DB, chamadoAtualizado as Chamado);
    }
  }

  if (body.grupo_responsavel_id !== undefined) {
    updates.push("grupo_responsavel_id = ?");
    params.push(body.grupo_responsavel_id);

    if (body.grupo_responsavel_id) {
      // Buscar nome do grupo
      const grupo = await c.env.DB.prepare(
        "SELECT nome FROM grupos_atendimento WHERE id = ?"
      ).bind(body.grupo_responsavel_id).first<{ nome: string }>();

      if (grupo) {
        await c.env.DB.prepare(
          `INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          parseInt(id),
          user.id,
          'Sistema',
          'sistema',
          `${profile.nome} atribuiu o chamado ao grupo "${grupo.nome}"`,
          getDataHoraBrasil()
        ).run();
      }
    }
  }

  if (body.tecnico_responsavel_id !== undefined) {
    updates.push("tecnico_responsavel_id = ?");
    params.push(body.tecnico_responsavel_id);

    // Se está atribuindo um técnico pela primeira vez, registrar data_primeira_resposta
    // (isso marca o momento em que o chamado foi "atendido" para efeitos de SLA)
    if (body.tecnico_responsavel_id && !chamadoAnterior.tecnico_responsavel_id && !chamadoAnterior.data_primeira_resposta) {
      updates.push("data_primeira_resposta = ?");
      params.push(getDataHoraBrasil());
    }

    // Se o chamado está em "Novo" e está recebendo um técnico, mudar para "Em atendimento"
    // (somente se o status não foi explicitamente definido no body)
    if (chamadoAnterior.status === 'Novo' && body.tecnico_responsavel_id && !body.status) {
      updates.push("status = ?");
      params.push('Em atendimento');

      // Registrar mudança de status no histórico
      await registrarHistorico(
        c.env.DB,
        parseInt(id),
        user.id,
        profile.nome,
        'mudanca_status',
        'Status alterado',
        undefined,
        'status',
        'Novo',
        'Em atendimento'
      );
    }

    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'acao_tecnica',
      'Técnico atribuído ao chamado'
    );

    if (body.tecnico_responsavel_id) {
      // Buscar nome do técnico
      const tecnico = await c.env.DB.prepare(
        "SELECT nome FROM user_profiles WHERE user_id = ?"
      ).bind(body.tecnico_responsavel_id).first<{ nome: string }>();

      if (tecnico) {
        await c.env.DB.prepare(
          `INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          parseInt(id),
          user.id,
          'Sistema',
          'sistema',
          `${tecnico.nome} assumiu o atendimento do chamado`,
          getDataHoraBrasil()
        ).run();

        // Notificar o técnico atribuído
        await criarNotificacao(
          c.env,
          body.tecnico_responsavel_id,
          parseInt(id),
          'atribuicao',
          'Novo chamado atribuído',
          `Você foi atribuído ao chamado ${chamadoAnterior.numero}`
        );

        // Notificar solicitante
        await criarNotificacao(
          c.env,
          chamadoAnterior.solicitante_id,
          parseInt(id),
          'atribuicao',
          'Técnico atribuído',
          `${tecnico.nome} foi atribuído ao seu chamado ${chamadoAnterior.numero}`
        );

        // Enviar notificação via Telegram
        await enviarNotificacaoTelegram(
          c.env,
          chamadoAnterior.solicitante_id,
          `👤 <b>Técnico Atribuído - Chamado ${chamadoAnterior.numero}</b>\n\n` +
          `<b>${tecnico.nome}</b> foi atribuído ao seu chamado e iniciará o atendimento em breve.`
        );

        // Enviar notificação no chat do Telegram onde o chamado foi criado
        await enviarNotificacaoChatTelegram(
          c.env,
          parseInt(id),
          `👤 <b>Técnico Atribuído - Chamado ${chamadoAnterior.numero}</b>\n\n` +
          `<b>${tecnico.nome}</b> assumiu o atendimento do seu chamado.`
        );
      }
    }
  }

  if (body.solucao) {
    updates.push("solucao = ?");
    params.push(body.solucao);
  }

  // Campos de reclassificação
  if (body.tipo !== undefined) {
    updates.push("tipo = ?");
    params.push(body.tipo);
    
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'acao_tecnica',
      `Tipo alterado de "${chamadoAnterior.tipo}" para "${body.tipo}"`
    );
  }

  if (body.tipo_problema !== undefined) {
    updates.push("tipo_problema = ?");
    params.push(body.tipo_problema);
    
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'acao_tecnica',
      `Tipo de problema alterado para "${body.tipo_problema}"`
    );
  }

  if (body.categoria_id !== undefined) {
    updates.push("categoria_id = ?");
    params.push(body.categoria_id);
    
    const categoriaAnteriorNome = chamadoAnterior.categoria_id ? 
      (await c.env.DB.prepare("SELECT nome FROM categorias WHERE id = ?").bind(chamadoAnterior.categoria_id).first<{ nome: string }>())?.nome : null;
    const categoriaNovaNome = body.categoria_id ? 
      (await c.env.DB.prepare("SELECT nome FROM categorias WHERE id = ?").bind(body.categoria_id).first<{ nome: string }>())?.nome : null;
    
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'acao_tecnica',
      `Categoria alterada${categoriaAnteriorNome ? ` de "${categoriaAnteriorNome}"` : ''} para "${categoriaNovaNome}"`
    );
  }

  if (body.subcategoria_id !== undefined) {
    updates.push("subcategoria_id = ?");
    params.push(body.subcategoria_id);
    
    const subcategoriaAnteriorNome = chamadoAnterior.subcategoria_id ? 
      (await c.env.DB.prepare("SELECT nome FROM categorias WHERE id = ?").bind(chamadoAnterior.subcategoria_id).first<{ nome: string }>())?.nome : null;
    const subcategoriaNovaNome = body.subcategoria_id ? 
      (await c.env.DB.prepare("SELECT nome FROM categorias WHERE id = ?").bind(body.subcategoria_id).first<{ nome: string }>())?.nome : null;
    
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'acao_tecnica',
      `Subcategoria alterada${subcategoriaAnteriorNome ? ` de "${subcategoriaAnteriorNome}"` : ''} para "${subcategoriaNovaNome}"`
    );
  }

  if (body.item_id !== undefined) {
    updates.push("item_id = ?");
    params.push(body.item_id);
    
    const itemAnteriorNome = chamadoAnterior.item_id ? 
      (await c.env.DB.prepare("SELECT nome FROM categorias WHERE id = ?").bind(chamadoAnterior.item_id).first<{ nome: string }>())?.nome : null;
    const itemNovoNome = body.item_id ? 
      (await c.env.DB.prepare("SELECT nome FROM categorias WHERE id = ?").bind(body.item_id).first<{ nome: string }>())?.nome : null;
    
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'acao_tecnica',
      `Item alterado${itemAnteriorNome ? ` de "${itemAnteriorNome}"` : ''} para "${itemNovoNome}"`
    );
  }

  if (body.impacto !== undefined) {
    updates.push("impacto = ?");
    params.push(body.impacto);
    
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'acao_tecnica',
      `Impacto alterado de "${chamadoAnterior.impacto}" para "${body.impacto}"`
    );
  }

  if (body.urgencia !== undefined) {
    updates.push("urgencia = ?");
    params.push(body.urgencia);
    
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'acao_tecnica',
      `Urgência alterada de "${chamadoAnterior.urgencia}" para "${body.urgencia}"`
    );
  }

  // Se categoria mudou, verificar se tem prioridade automática
  let prioridadeAutomatica: Prioridade | null = null;
  
  if (body.item_id !== undefined || body.subcategoria_id !== undefined || body.categoria_id !== undefined) {
    // Verificar na ordem: item > subcategoria > categoria
    const itemIdFinal = body.item_id !== undefined ? body.item_id : chamadoAnterior.item_id;
    const subcategoriaIdFinal = body.subcategoria_id !== undefined ? body.subcategoria_id : chamadoAnterior.subcategoria_id;
    const categoriaIdFinal = body.categoria_id !== undefined ? body.categoria_id : chamadoAnterior.categoria_id;
    
    if (itemIdFinal) {
      const itemInfo = await c.env.DB.prepare(
        "SELECT prioridade_automatica FROM categorias WHERE id = ?"
      ).bind(itemIdFinal).first<{ prioridade_automatica: string | null }>();
      
      if (itemInfo?.prioridade_automatica) {
        prioridadeAutomatica = itemInfo.prioridade_automatica as Prioridade;
      }
    }
    
    if (!prioridadeAutomatica && subcategoriaIdFinal) {
      const subcategoriaInfo = await c.env.DB.prepare(
        "SELECT prioridade_automatica FROM categorias WHERE id = ?"
      ).bind(subcategoriaIdFinal).first<{ prioridade_automatica: string | null }>();
      
      if (subcategoriaInfo?.prioridade_automatica) {
        prioridadeAutomatica = subcategoriaInfo.prioridade_automatica as Prioridade;
      }
    }
    
    if (!prioridadeAutomatica && categoriaIdFinal) {
      const categoriaInfo = await c.env.DB.prepare(
        "SELECT prioridade_automatica FROM categorias WHERE id = ?"
      ).bind(categoriaIdFinal).first<{ prioridade_automatica: string | null }>();
      
      if (categoriaInfo?.prioridade_automatica) {
        prioridadeAutomatica = categoriaInfo.prioridade_automatica as Prioridade;
      }
    }
  }
  
  // Se impacto ou urgência mudaram, recalcular prioridade (mas apenas se não houver prioridade automática)
  if ((body.impacto !== undefined || body.urgencia !== undefined) && !prioridadeAutomatica) {
    const novoImpacto = body.impacto || chamadoAnterior.impacto;
    const novaUrgencia = body.urgencia || chamadoAnterior.urgencia;
    const novaPrioridade = calcularPrioridade(novoImpacto, novaUrgencia);
    
    if (novaPrioridade !== chamadoAnterior.prioridade) {
      updates.push("prioridade = ?");
      params.push(novaPrioridade);
      
      await registrarHistorico(
        c.env.DB,
        parseInt(id),
        user.id,
        profile.nome,
        'acao_tecnica',
        `Prioridade alterada de "${chamadoAnterior.prioridade || 'N/A'}" para "${novaPrioridade}" (calculada por Impacto × Urgência)`,
        undefined,
        'prioridade',
        chamadoAnterior.prioridade || 'N/A',
        novaPrioridade
      );
    }
  }
  
  // Se há prioridade automática, aplicar ela independentemente de impacto/urgência
  if (prioridadeAutomatica && prioridadeAutomatica !== chamadoAnterior.prioridade) {
    updates.push("prioridade = ?");
    params.push(prioridadeAutomatica);
    
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'acao_tecnica',
      `Prioridade alterada de "${chamadoAnterior.prioridade || 'N/A'}" para "${prioridadeAutomatica}" (prioridade automática da categoria)`,
      undefined,
      'prioridade',
      chamadoAnterior.prioridade || 'N/A',
      prioridadeAutomatica
    );
  }

  // Se categoria, subcategoria, item ou prioridade mudaram, recalcular SLA
  const mudouClassificacao = body.categoria_id !== undefined || 
                              body.subcategoria_id !== undefined || 
                              body.item_id !== undefined || 
                              body.impacto !== undefined || 
                              body.urgencia !== undefined;

  if (mudouClassificacao) {
    // Criar comentário do sistema sobre reclassificação
    await c.env.DB.prepare(
      `INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      parseInt(id),
      user.id,
      'Sistema',
      'sistema',
      `${profile.nome} reclassificou o chamado`,
      getDataHoraBrasil()
    ).run();
    // Buscar valores atualizados
    const categoriaId = body.categoria_id !== undefined ? body.categoria_id : chamadoAnterior.categoria_id;
    const subcategoriaId = body.subcategoria_id !== undefined ? body.subcategoria_id : chamadoAnterior.subcategoria_id;
    const itemId = body.item_id !== undefined ? body.item_id : chamadoAnterior.item_id;
    const novoImpacto = body.impacto || chamadoAnterior.impacto;
    const novaUrgencia = body.urgencia || chamadoAnterior.urgencia;
    
    // Verificar prioridade final (automática ou calculada)
    let novaPrioridade: Prioridade;
    
    // Se houve mudança de categoria, a prioridade automática já foi aplicada acima
    if (prioridadeAutomatica) {
      novaPrioridade = prioridadeAutomatica;
    } else {
      // Se não tem prioridade automática, calcular por impacto x urgência
      novaPrioridade = calcularPrioridade(novoImpacto, novaUrgencia);
    }
    
    const tipoChamado = chamadoAnterior.tipo;

    // Recalcular SLA após reclassificação
    let slaInfo: any = null;
    
    // Priorizar por item_id
    if (itemId) {
      slaInfo = await c.env.DB.prepare(
        `SELECT * FROM slas 
         WHERE categoria_id = ? 
         AND ativo = TRUE 
         LIMIT 1`
      ).bind(itemId).first<any>();
    }
    
    // Se não encontrou, tentar por subcategoria_id
    if (!slaInfo && subcategoriaId) {
      slaInfo = await c.env.DB.prepare(
        `SELECT * FROM slas 
         WHERE categoria_id = ? 
         AND ativo = TRUE 
         LIMIT 1`
      ).bind(subcategoriaId).first<any>();
    }
    
    // Se não encontrou, tentar por categoria_id
    if (!slaInfo && categoriaId) {
      slaInfo = await c.env.DB.prepare(
        `SELECT * FROM slas 
         WHERE categoria_id = ? 
         AND ativo = TRUE 
         LIMIT 1`
      ).bind(categoriaId).first<any>();
    }
    
    // Se ainda não encontrou, buscar SLA genérico por tipo e prioridade
    if (!slaInfo) {
      // Mapear "Problema" para "Incidente" para compatibilidade com SLAs cadastrados
      const tipoChamadoParaSLA = tipoChamado === 'Problema' ? 'Incidente' : tipoChamado;
      
      slaInfo = await c.env.DB.prepare(
        `SELECT * FROM slas 
         WHERE tipo_chamado = ? 
         AND prioridade = ? 
         AND (setor_id = ? OR setor_id IS NULL)
         AND ativo = TRUE 
         ORDER BY setor_id DESC
         LIMIT 1`
      ).bind(tipoChamadoParaSLA, novaPrioridade, chamadoAnterior.setor_destino_id).first<any>();
    }

    if (slaInfo) {
      // Usar o momento ATUAL (agora) como base para recalcular SLA, não a data de abertura
      // Isso garante que os prazos sempre sejam no futuro, nunca no passado
      const dataReclassificacao = new Date();
      const setorId = chamadoAnterior.setor_destino_id;
      
      if (slaInfo.tempo_resposta_minutos > 0) {
        const novoPrazoResposta = await calcularPrazoSLA(c.env.DB, setorId, dataReclassificacao, slaInfo.tempo_resposta_minutos);
        updates.push("prazo_resposta = ?");
        params.push(novoPrazoResposta.toISOString());
      }
      
      if (slaInfo.tempo_solucao_minutos > 0) {
        const novoPrazoSolucao = await calcularPrazoSLA(c.env.DB, setorId, dataReclassificacao, slaInfo.tempo_solucao_minutos);
        updates.push("prazo_solucao = ?");
        params.push(novoPrazoSolucao.toISOString());
      }
      
      console.log(`[ATUALIZAR CHAMADO] SLA recalculado após reclassificação - Resposta: ${slaInfo.tempo_resposta_minutos}min, Solução: ${slaInfo.tempo_solucao_minutos}min`);
      
      await registrarHistorico(
        c.env.DB,
        parseInt(id),
        user.id,
        profile.nome,
        'acao_tecnica',
        `SLA recalculado: ${slaInfo.tempo_resposta_minutos > 0 ? `${slaInfo.tempo_resposta_minutos}min para resposta` : ''} ${slaInfo.tempo_solucao_minutos > 0 ? `${slaInfo.tempo_solucao_minutos}min para solução` : ''}`
      );
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = ?");
    params.push(getDataHoraBrasil());
    params.push(id);

    const updateQuery = `UPDATE chamados SET ${updates.join(", ")} WHERE id = ?`;
    console.log(`[ATUALIZAR CHAMADO] Executando UPDATE - Query:`, updateQuery);
    console.log(`[ATUALIZAR CHAMADO] Parâmetros:`, JSON.stringify(params));
    
    try {
      const result = await c.env.DB.prepare(updateQuery).bind(...params).run();
      console.log(`[ATUALIZAR CHAMADO] UPDATE executado com sucesso - Linhas afetadas:`, result.meta.changes);
      console.log(`[ATUALIZAR CHAMADO] Meta completa:`, JSON.stringify(result.meta));
    } catch (error) {
      console.error(`[ATUALIZAR CHAMADO] ERRO ao executar UPDATE:`, error);
      throw error;
    }
  } else {
    console.log(`[ATUALIZAR CHAMADO] Nenhuma atualização a fazer (updates.length = 0)`);
  }

  console.log(`[ATUALIZAR CHAMADO] Buscando chamado atualizado`);
  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

    console.log(`[ATUALIZAR CHAMADO] Chamado atualizado:`, JSON.stringify(chamado));
    console.log(`[ATUALIZAR CHAMADO] ========== FIM ==========`);
    return c.json(chamado);
  } catch (error) {
    console.error(`[ATUALIZAR CHAMADO] ERRO CRÍTICO:`, error);
    return c.json({ error: "Erro ao atualizar chamado: " + (error instanceof Error ? error.message : String(error)) }, 500);
  }
});

// Adicionar comentário
router.post("/:id/comentarios", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body: CreateComentarioDTO = await c.req.json();

  let profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  // Criar perfil automaticamente se não existir
  if (!profile) {
    const result = await c.env.DB.prepare(
      `INSERT INTO user_profiles (user_id, nome, email, perfil, ativo)
       VALUES (?, ?, ?, ?, TRUE)`
    ).bind(
      user.id,
      user.google_user_data?.name || user.email,
      user.email,
      "solicitante"
    ).run();

    profile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE id = ?"
    ).bind(result.meta.last_row_id).first<UserProfile>();
  }

  if (!profile) {
    return c.json({ error: "Erro ao criar perfil do usuário" }, 500);
  }

  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  if (!chamado) {
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  // Solicitante só pode adicionar comentários públicos em seus chamados
  if (profile.perfil === 'solicitante' && chamado.solicitante_id !== user.id) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, is_evidencia, tag_evidencia, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    user.id,
    profile.nome,
    body.tipo,
    body.conteudo,
    body.is_evidencia || false,
    body.tag_evidencia || null,
    getDataHoraBrasil()
  ).run();

  // Se for comentário público, notificar as partes envolvidas
  if (body.tipo === 'publico') {
    // Notificar solicitante (se não for ele próprio)
    if (chamado.solicitante_id !== user.id) {
      await criarNotificacao(
        c.env,
        chamado.solicitante_id,
        parseInt(id),
        'comentario',
        'Novo comentário',
        `${profile.nome} adicionou um comentário no chamado ${chamado.numero}`
      );

      // Enviar notificação via Telegram
      await enviarNotificacaoTelegram(
        c.env,
        chamado.solicitante_id,
        `💬 <b>Nova mensagem no chamado ${chamado.numero}</b>\n\n` +
        `<b>${profile.nome}:</b>\n${body.conteudo}`
      );
    }

    // Notificar técnico responsável (se existir e não for ele próprio)
    if (chamado.tecnico_responsavel_id && chamado.tecnico_responsavel_id !== user.id) {
      await criarNotificacao(
        c.env,
        chamado.tecnico_responsavel_id,
        parseInt(id),
        'comentario',
        'Novo comentário',
        `${profile.nome} adicionou um comentário no chamado ${chamado.numero}`
      );
    }

    // Enviar notificação no chat do Telegram onde o chamado foi criado
    await enviarNotificacaoChatTelegram(
      c.env,
      parseInt(id),
      `💬 <b>Nova mensagem no chamado ${chamado.numero}</b>\n\n` +
      `<b>${profile.nome}:</b>\n${body.conteudo}`
    );
  }

  const comentario = await c.env.DB.prepare(
    "SELECT * FROM comentarios WHERE id = ?"
  ).bind(result.meta.last_row_id).first<Comentario>();

  return c.json(comentario, 201);
});

// Listar comentários
router.get("/:id/comentarios", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  if (!chamado) {
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  let query = "SELECT * FROM comentarios WHERE chamado_id = ?";
  
  // Solicitante vê apenas comentários públicos e do sistema
  if (profile?.perfil === 'solicitante') {
    query += " AND tipo IN ('publico', 'sistema')";
  }

  query += " ORDER BY created_at ASC";

  const { results } = await c.env.DB.prepare(query).bind(id).all<Comentario>();

  return c.json(results);
});

// Avaliar chamado
router.post("/:id/avaliacao", authMiddleware, async (c) => {
  const user = c.get("user");
  
  console.log('Avaliação - User:', user ? 'OK' : 'NULL');
  
  if (!user) {
    console.log('Avaliação - Usuário não autenticado');
    return c.json({ error: "Não autenticado" }, 401);
  }
  
  const id = c.req.param("id");
  const body: AvaliacaoChamadoDTO = await c.req.json();

  console.log('Avaliação - ID:', id, 'Body:', body);

  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  if (!chamado) {
    console.log('Avaliação - Chamado não encontrado');
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  console.log('Avaliação - Chamado:', chamado.numero, 'Solicitante:', chamado.solicitante_id, 'User:', user.id);

  // Apenas o solicitante pode avaliar
  if (chamado.solicitante_id !== user.id) {
    console.log('Avaliação - Acesso negado: não é o solicitante');
    return c.json({ error: "Apenas o solicitante pode avaliar o chamado" }, 403);
  }

  // Apenas chamados resolvidos podem ser avaliados
  if (chamado.status !== 'Resolvido' && chamado.status !== 'Fechado') {
    console.log('Avaliação - Status inválido:', chamado.status);
    return c.json({ error: "Apenas chamados resolvidos podem ser avaliados" }, 400);
  }

  console.log('Avaliação - Atualizando avaliação...');

  await c.env.DB.prepare(
    `UPDATE chamados 
     SET avaliacao_nota = ?, avaliacao_comentario = ?, avaliacao_nps = ?, 
         avaliacao_resolveu = ?, avaliacao_data = ?, status = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    body.nota, 
    body.comentario || null, 
    body.nps || null, 
    body.resolveu,
    getDataHoraBrasil(),
    'Fechado',
    getDataHoraBrasil(),
    id
  ).run();

  // Registrar no histórico o fechamento automático após avaliação
  await c.env.DB.prepare(`
    INSERT INTO historico (chamado_id, user_id, user_nome, tipo, acao, detalhes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    user.id,
    user.google_user_data?.name || user.email,
    'mudanca_status',
    'Status alterado: Aguardando Avaliação → Fechado',
    JSON.stringify({
      status_anterior: 'Aguardando Avaliação',
      status_novo: 'Fechado',
      motivo: 'Ticket fechado automaticamente após avaliação',
      avaliacao_nota: body.nota,
      avaliacao_nps: body.nps
    }),
    getDataHoraBrasil()
  ).run();

  const updated = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  console.log('Avaliação - Sucesso!');

  // Calcular pontos por feedback positivo
  if (updated) {
    await calcularPontosFeedback(c.env.DB, updated);
  }

  return c.json(updated);
});

// Obter histórico
router.get("/:id/historico", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM historico WHERE chamado_id = ? ORDER BY created_at DESC"
  ).bind(id).all<Historico>();

  return c.json(results);
});

// Transferir chamado para outro técnico
router.post("/:id/transferir", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json<{ novo_tecnico_id: string; motivo?: string }>();

  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || profile.perfil === 'solicitante') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  if (!chamado) {
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  // Buscar nome e setor do novo técnico
  const novoTecnico = await c.env.DB.prepare(
    "SELECT nome, perfil, setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(body.novo_tecnico_id).first<{ nome: string; perfil: string; setor_id: number | null }>();

  if (!novoTecnico) {
    return c.json({ error: "Técnico não encontrado" }, 404);
  }

  if (novoTecnico.perfil === 'solicitante') {
    return c.json({ error: "Usuário selecionado não é um técnico" }, 400);
  }

  // Buscar nome do técnico anterior (se houver)
  let tecnicoAnteriorNome = 'Nenhum técnico';
  if (chamado.tecnico_responsavel_id) {
    const tecnicoAnterior = await c.env.DB.prepare(
      "SELECT nome FROM user_profiles WHERE user_id = ?"
    ).bind(chamado.tecnico_responsavel_id).first<{ nome: string }>();
    
    if (tecnicoAnterior) {
      tecnicoAnteriorNome = tecnicoAnterior.nome;
    }
  }

  // Buscar nome do setor anterior e novo
  let setorAnteriorNome = 'Não especificado';
  let setorNovoNome = 'Não especificado';
  
  if (chamado.setor_destino_id) {
    const setorAnterior = await c.env.DB.prepare(
      "SELECT nome FROM setores WHERE id = ?"
    ).bind(chamado.setor_destino_id).first<{ nome: string }>();
    if (setorAnterior) {
      setorAnteriorNome = setorAnterior.nome;
    }
  }
  
  if (novoTecnico.setor_id) {
    const setorNovo = await c.env.DB.prepare(
      "SELECT nome FROM setores WHERE id = ?"
    ).bind(novoTecnico.setor_id).first<{ nome: string }>();
    if (setorNovo) {
      setorNovoNome = setorNovo.nome;
    }
  }

  // Atualizar chamado - incluindo o setor do novo técnico
  await c.env.DB.prepare(
    `UPDATE chamados 
     SET tecnico_responsavel_id = ?, setor_destino_id = ?, updated_at = ?
     WHERE id = ?`
  ).bind(body.novo_tecnico_id, novoTecnico.setor_id, getDataHoraBrasil(), id).run();

  // Registrar histórico - transferência de técnico
  await registrarHistorico(
    c.env.DB,
    parseInt(id),
    user.id,
    profile.nome,
    'acao_tecnica',
    'Chamado transferido',
    {
      resumo: body.motivo || 'Transferência de responsabilidade'
    },
    'tecnico_responsavel_id',
    tecnicoAnteriorNome,
    novoTecnico.nome
  );

  // Registrar histórico - mudança de setor (se houve mudança)
  if (chamado.setor_destino_id !== novoTecnico.setor_id) {
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'acao_tecnica',
      'Setor alterado automaticamente',
      {
        resumo: 'Setor atualizado devido à transferência para técnico de outro setor'
      },
      'setor_destino_id',
      setorAnteriorNome,
      setorNovoNome
    );
  }

  // Criar comentário do sistema
  const motivoTexto = body.motivo ? `\n\nMotivo: ${body.motivo}` : '';
  const mudouSetor = chamado.setor_destino_id !== novoTecnico.setor_id;
  const setorTexto = mudouSetor ? `\nSetor alterado de "${setorAnteriorNome}" para "${setorNovoNome}"` : '';
  
  await c.env.DB.prepare(
    `INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    parseInt(id),
    user.id,
    'Sistema',
    'sistema',
    `${profile.nome} transferiu o chamado de "${tecnicoAnteriorNome}" para "${novoTecnico.nome}"${setorTexto}${motivoTexto}`,
    getDataHoraBrasil()
  ).run();

  // Notificar o novo técnico
  await criarNotificacao(
    c.env,
    body.novo_tecnico_id,
    parseInt(id),
    'transferencia',
    'Chamado transferido para você',
    `${profile.nome} transferiu o chamado ${chamado.numero} para você`
  );

  // Notificar o técnico anterior (se houver e não for o mesmo que está transferindo)
  if (chamado.tecnico_responsavel_id && chamado.tecnico_responsavel_id !== user.id) {
    await criarNotificacao(
      c.env,
      chamado.tecnico_responsavel_id,
      parseInt(id),
      'transferencia',
      'Chamado transferido',
      `${profile.nome} transferiu o chamado ${chamado.numero} para ${novoTecnico.nome}`
    );
  }

  // Notificar o solicitante
  await criarNotificacao(
    c.env,
    chamado.solicitante_id,
    parseInt(id),
    'transferencia',
    'Técnico do chamado alterado',
    `Seu chamado ${chamado.numero} foi transferido para ${novoTecnico.nome}`
  );

  // Enviar notificação via Telegram
  await enviarNotificacaoTelegram(
    c.env,
    chamado.solicitante_id,
    `🔄 <b>Chamado Transferido - ${chamado.numero}</b>\n\n` +
    `Seu chamado foi transferido para <b>${novoTecnico.nome}</b>`
  );

  // Enviar notificação no chat do Telegram onde o chamado foi criado
  const mudouSetorMsg = chamado.setor_destino_id !== novoTecnico.setor_id 
    ? `\nSetor: ${setorAnteriorNome} → <b>${setorNovoNome}</b>` 
    : '';
  
  await enviarNotificacaoChatTelegram(
    c.env,
    parseInt(id),
    `🔄 <b>Chamado Transferido - ${chamado.numero}</b>\n\n` +
    `Técnico anterior: ${tecnicoAnteriorNome}\n` +
    `Novo técnico: <b>${novoTecnico.nome}</b>` +
    mudouSetorMsg +
    (body.motivo ? `\n\nMotivo: ${body.motivo}` : '')
  );

  const updated = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  return c.json(updated);
});

// Agendar chamado
router.put("/:id/agendar", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json<{ 
    data_agendamento: string; 
    observacoes_agendamento?: string;
  }>();

  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || profile.perfil === 'solicitante') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  if (!chamado) {
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE chamados 
     SET agendado = TRUE, data_agendamento = ?, observacoes_agendamento = ?, updated_at = ?
     WHERE id = ?`
  ).bind(body.data_agendamento, body.observacoes_agendamento || null, getDataHoraBrasil(), id).run();

  // Registrar histórico
  await registrarHistorico(
    c.env.DB,
    parseInt(id),
    user.id,
    profile.nome,
    'acao_tecnica',
    'Chamado agendado',
    {
      resumo: `Agendado para ${new Date(body.data_agendamento).toLocaleString('pt-BR')}`,
      procedimento: body.observacoes_agendamento || 'Sem observações'
    }
  );

  // Criar comentário do sistema
  const dataFormatada = new Date(body.data_agendamento).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
  const observacoesTexto = body.observacoes_agendamento ? `\n\nObservações: ${body.observacoes_agendamento}` : '';
  
  await c.env.DB.prepare(
    `INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    parseInt(id),
    user.id,
    'Sistema',
    'sistema',
    `${profile.nome} agendou o atendimento para ${dataFormatada}${observacoesTexto}`,
    getDataHoraBrasil()
  ).run();

  // Notificar solicitante
  await criarNotificacao(
    c.env,
    chamado.solicitante_id,
    parseInt(id),
    'agendamento',
    'Chamado agendado',
    `Seu chamado ${chamado.numero} foi agendado para ${dataFormatada}`
  );

  // Notificar técnico responsável se houver e não for ele próprio que agendou
  if (chamado.tecnico_responsavel_id && chamado.tecnico_responsavel_id !== user.id) {
    await criarNotificacao(
      c.env,
      chamado.tecnico_responsavel_id,
      parseInt(id),
      'agendamento',
      'Chamado agendado',
      `${profile.nome} agendou o chamado ${chamado.numero} para ${dataFormatada}`
    );
  }

  // Enviar notificação via Telegram
  await enviarNotificacaoTelegram(
    c.env,
    chamado.solicitante_id,
    `📅 <b>Atendimento Agendado - Chamado ${chamado.numero}</b>\n\n` +
    `Data/Hora: <b>${dataFormatada}</b>${observacoesTexto ? `\n\n${observacoesTexto}` : ''}`
  );

  // Enviar notificação no chat do Telegram onde o chamado foi criado
  await enviarNotificacaoChatTelegram(
    c.env,
    parseInt(id),
    `📅 <b>Atendimento Agendado - Chamado ${chamado.numero}</b>\n\n` +
    `Data/Hora: <b>${dataFormatada}</b>` +
    `\nAgendado por: ${profile.nome}` +
    (body.observacoes_agendamento ? `\n\nObservações: ${body.observacoes_agendamento}` : '')
  );

  const updated = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  return c.json(updated);
});

// Cancelar agendamento
router.delete("/:id/agendar", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || profile.perfil === 'solicitante') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  if (!chamado) {
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE chamados 
     SET agendado = FALSE, data_agendamento = NULL, observacoes_agendamento = NULL, updated_at = ?
     WHERE id = ?`
  ).bind(getDataHoraBrasil(), id).run();

  // Criar comentário do sistema
  await c.env.DB.prepare(
    `INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    parseInt(id),
    user.id,
    'Sistema',
    'sistema',
    `${profile.nome} cancelou o agendamento do chamado`,
    getDataHoraBrasil()
  ).run();

  // Notificar solicitante
  await criarNotificacao(
    c.env,
    chamado.solicitante_id,
    parseInt(id),
    'cancelamento_agendamento',
    'Agendamento cancelado',
    `O agendamento do chamado ${chamado.numero} foi cancelado`
  );

  // Notificar técnico responsável se houver e não for ele próprio
  if (chamado.tecnico_responsavel_id && chamado.tecnico_responsavel_id !== user.id) {
    await criarNotificacao(
      c.env,
      chamado.tecnico_responsavel_id,
      parseInt(id),
      'cancelamento_agendamento',
      'Agendamento cancelado',
      `${profile.nome} cancelou o agendamento do chamado ${chamado.numero}`
    );
  }

  const updated = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  return c.json(updated);
});

// Reabrir chamado fechado
router.post("/:id/reabrir", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json<{ motivo?: string }>();

  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  if (!chamado) {
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  // Apenas chamados resolvidos ou fechados podem ser reabertos
  if (chamado.status !== 'Fechado' && chamado.status !== 'Resolvido') {
    return c.json({ error: "Apenas chamados resolvidos ou fechados podem ser reabertos" }, 400);
  }

  // Solicitante pode reabrir seu próprio chamado, técnicos podem reabrir qualquer chamado
  const podReabrir = 
    chamado.solicitante_id === user.id || 
    profile.perfil !== 'solicitante';

  if (!podReabrir) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  // Reabrir o chamado (volta para status Em atendimento se tinha técnico, senão volta para Novo)
  const novoStatus = chamado.tecnico_responsavel_id ? 'Em atendimento' : 'Novo';

  // Recalcular SLA do zero quando reabre o chamado
  const dataInicio = new Date();
  let prazoResposta = chamado.prazo_resposta;
  let prazoSolucao = chamado.prazo_solucao;
  let slaId = chamado.sla_id;

  // Buscar SLA do chamado (mesma lógica da criação)
  let sla = null;
  
  // 1. Tentar buscar SLA pelo item_id
  if (chamado.item_id) {
    sla = await c.env.DB.prepare(
      `SELECT * FROM slas WHERE categoria_id = ? AND ativo = TRUE LIMIT 1`
    ).bind(chamado.item_id).first<any>();
  }

  // 2. Se não encontrou, tentar pela subcategoria_id
  if (!sla && chamado.subcategoria_id) {
    sla = await c.env.DB.prepare(
      `SELECT * FROM slas WHERE categoria_id = ? AND ativo = TRUE LIMIT 1`
    ).bind(chamado.subcategoria_id).first<any>();
  }

  // 3. Se não encontrou, tentar pela categoria_id
  if (!sla && chamado.categoria_id) {
    sla = await c.env.DB.prepare(
      `SELECT * FROM slas WHERE categoria_id = ? AND ativo = TRUE LIMIT 1`
    ).bind(chamado.categoria_id).first<any>();
  }

  // 4. Se não encontrou, buscar SLA genérico por tipo + prioridade + setor
  if (!sla) {
    // Mapear "Problema" para "Incidente" para compatibilidade com SLAs cadastrados
    const tipoChamadoParaSLA = chamado.tipo === 'Problema' ? 'Incidente' : chamado.tipo;
    
    sla = await c.env.DB.prepare(
      `SELECT * FROM slas 
       WHERE tipo_chamado = ? 
       AND prioridade = ? 
       AND (setor_id = ? OR setor_id IS NULL)
       AND ativo = TRUE 
       ORDER BY setor_id DESC
       LIMIT 1`
    ).bind(tipoChamadoParaSLA, chamado.prioridade, chamado.setor_destino_id).first<any>();
  }

  // Se encontrou SLA, recalcular prazos
  if (sla) {
    slaId = sla.id;
    prazoResposta = (sla.tempo_resposta_minutos > 0)
      ? (await calcularPrazoSLA(c.env.DB, chamado.setor_destino_id, dataInicio, sla.tempo_resposta_minutos)).toISOString()
      : null;
    prazoSolucao = (await calcularPrazoSLA(c.env.DB, chamado.setor_destino_id, dataInicio, sla.tempo_solucao_minutos)).toISOString();
  }

  await c.env.DB.prepare(
    `UPDATE chamados 
     SET status = ?, 
         data_fechamento = NULL, 
         data_resolucao = NULL,
         data_primeira_resposta = NULL,
         prazo_resposta = ?,
         prazo_solucao = ?,
         sla_id = ?,
         sla_pausado_em = NULL,
         sla_pausado_motivo = NULL,
         tempo_pausado_minutos = 0,
         updated_at = ?
     WHERE id = ?`
  ).bind(novoStatus, prazoResposta, prazoSolucao, slaId, getDataHoraBrasil(), id).run();

  // Registrar histórico
  await registrarHistorico(
    c.env.DB,
    parseInt(id),
    user.id,
    profile.nome,
    'mudanca_status',
    `Chamado reaberto por ${profile.nome}`,
    {
      motivo: body.motivo || 'Chamado necessita de revisão',
      justificativa: 'Reabertura solicitada'
    },
    'status',
    'Fechado',
    novoStatus
  );

  // Criar comentário do sistema
  const motivoTexto = body.motivo ? `\n\nMotivo: ${body.motivo}` : '';
  await c.env.DB.prepare(
    `INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    parseInt(id),
    user.id,
    'Sistema',
    'sistema',
    `${profile.nome} reabriu o chamado${motivoTexto}`,
    getDataHoraBrasil()
  ).run();

  // Notificar técnico responsável se houver
  if (chamado.tecnico_responsavel_id) {
    await criarNotificacao(
      c.env,
      chamado.tecnico_responsavel_id,
      parseInt(id),
      'reabertura',
      'Chamado reaberto',
      `${profile.nome} reabriu o chamado ${chamado.numero}`
    );
  }

  // Se foi o solicitante que reabriu, notificar técnico. Se foi técnico, notificar solicitante
  if (chamado.solicitante_id !== user.id) {
    await criarNotificacao(
      c.env,
      chamado.solicitante_id,
      parseInt(id),
      'reabertura',
      'Chamado reaberto',
      `${profile.nome} reabriu seu chamado ${chamado.numero}`
    );

    // Enviar notificação via Telegram ao solicitante
    await enviarNotificacaoTelegram(
      c.env,
      chamado.solicitante_id,
      `🔄 <b>Chamado Reaberto - ${chamado.numero}</b>\n\n` +
      `Seu chamado foi reaberto por <b>${profile.nome}</b>` +
      (body.motivo ? `\n\nMotivo: ${body.motivo}` : '')
    );
  }

  // Enviar notificação no chat do Telegram onde o chamado foi criado
  await enviarNotificacaoChatTelegram(
    c.env,
    parseInt(id),
    `🔄 <b>Chamado Reaberto - ${chamado.numero}</b>\n\n` +
    `Reaberto por: <b>${profile.nome}</b>\n` +
    `Novo status: <b>${novoStatus}</b>` +
    (body.motivo ? `\n\nMotivo: ${body.motivo}` : '')
  );

  const updated = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  return c.json(updated);
});

// Marcar chamado como projeto
router.post("/:id/marcar-como-projeto", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json();

  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  // Apenas técnicos, gestores e admins da TI podem marcar como projeto
  if (!['tecnico', 'gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const chamado = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  if (!chamado) {
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  // Verificar se é setor TI (id 1)
  if (chamado.setor_destino_id !== 1) {
    return c.json({ error: "Apenas chamados da TI podem ser marcados como projeto" }, 400);
  }

  if (chamado.is_projeto) {
    return c.json({ error: "Chamado já está marcado como projeto" }, 400);
  }

  const dataHoraAtual = getDataHoraBrasil();

  // Se o chamado estiver pausado, retomar antes de fechar
  if (chamado.sla_pausado_em) {
    // Calcular tempo pausado
    const pausadoEm = new Date(chamado.sla_pausado_em);
    const agora = new Date(dataHoraAtual);
    const tempoPausadoMs = agora.getTime() - pausadoEm.getTime();
    const tempoPausadoMinutos = Math.floor(tempoPausadoMs / 60000);

    // Estender prazos se houver SLA
    if (chamado.prazo_resposta) {
      const novoPrazoResposta = new Date(new Date(chamado.prazo_resposta).getTime() + tempoPausadoMs);
      await c.env.DB.prepare(
        `UPDATE chamados SET prazo_resposta = ? WHERE id = ?`
      ).bind(novoPrazoResposta.toISOString(), id).run();
    }

    if (chamado.prazo_solucao) {
      const novoPrazoSolucao = new Date(new Date(chamado.prazo_solucao).getTime() + tempoPausadoMs);
      await c.env.DB.prepare(
        `UPDATE chamados SET prazo_solucao = ? WHERE id = ?`
      ).bind(novoPrazoSolucao.toISOString(), id).run();
    }

    // Limpar pausa
    await c.env.DB.prepare(
      `UPDATE chamados 
       SET sla_pausado_em = NULL,
           sla_pausado_motivo = NULL,
           tempo_pausado_minutos = tempo_pausado_minutos + ?
       WHERE id = ?`
    ).bind(tempoPausadoMinutos, id).run();

    // Registrar retomada no histórico
    await registrarHistorico(
      c.env.DB,
      parseInt(id),
      user.id,
      profile.nome,
      'mudanca_status',
      `SLA retomado automaticamente para conversão em projeto`,
      {
        motivo: 'Retomado automaticamente antes de marcar como projeto'
      }
    );
  }

  // Não fechar o chamado - ele continua visível para o solicitante com status atual

  // Criar projeto a partir do chamado
  const nomeProjeto = body.nome_projeto || `Projeto - ${chamado.titulo}`;
  const descricaoProjeto = body.descricao_projeto || chamado.descricao;
  const escopoProjeto = body.escopo || '';
  
  const projetoResult = await c.env.DB.prepare(
    `INSERT INTO projetos (
      nome, descricao, escopo, status, gerente_id, data_inicio, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    nomeProjeto,
    descricaoProjeto,
    escopoProjeto,
    'Planejamento',
    chamado.tecnico_responsavel_id || user.id,
    dataHoraAtual.split('T')[0], // Apenas a data
    dataHoraAtual,
    dataHoraAtual
  ).run();

  const projetoId = projetoResult.meta.last_row_id;

  // Marcar chamado como projeto
  await c.env.DB.prepare(
    `UPDATE chamados 
     SET is_projeto = TRUE, 
         projeto_id = ?,
         updated_at = ?
     WHERE id = ?`
  ).bind(projetoId, dataHoraAtual, id).run();

  // Registrar histórico
  await registrarHistorico(
    c.env.DB,
    parseInt(id),
    user.id,
    profile.nome,
    'acao_tecnica',
    `Chamado convertido em projeto por ${profile.nome}`,
    {
      projeto_id: projetoId,
      projeto_nome: nomeProjeto
    }
  );

  // Criar comentário do sistema
  await c.env.DB.prepare(
    `INSERT INTO comentarios (chamado_id, autor_id, autor_nome, tipo, conteudo, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    parseInt(id),
    user.id,
    'Sistema',
    'sistema',
    `Este chamado foi fechado e convertido em projeto: "${nomeProjeto}" (ID: ${projetoId})`,
    dataHoraAtual
  ).run();

  // Notificar solicitante sobre fechamento e conversão
  await criarNotificacao(
    c.env,
    chamado.solicitante_id,
    parseInt(id),
    'fechamento',
    'Chamado fechado e convertido em projeto',
    `Seu chamado ${chamado.numero} foi finalizado e convertido em projeto: "${nomeProjeto}". O projeto será gerenciado pela equipe de TI.`
  );

  // Enviar notificação via Telegram
  await enviarNotificacaoTelegram(
    c.env,
    chamado.solicitante_id,
    `✅ <b>Chamado Finalizado e Convertido em Projeto - ${chamado.numero}</b>\n\n` +
    `Seu chamado foi <b>fechado</b> e convertido em projeto: <b>${nomeProjeto}</b>\n\n` +
    `O projeto será gerenciado pela equipe de TI e você será informado sobre o andamento.`
  );

  // Enviar notificação no chat do Telegram onde o chamado foi criado
  await enviarNotificacaoChatTelegram(
    c.env,
    parseInt(id),
    `✅ <b>Chamado Finalizado e Convertido em Projeto - ${chamado.numero}</b>\n\n` +
    `Status: <b>Fechado</b>\n` +
    `Convertido em: <b>${nomeProjeto}</b>\n` +
    `Por: <b>${profile.nome}</b>`
  );

  const updated = await c.env.DB.prepare(
    "SELECT * FROM chamados WHERE id = ?"
  ).bind(id).first<Chamado>();

  return c.json({ 
    chamado: updated, 
    projeto_id: projetoId,
    projeto_nome: nomeProjeto 
  });
});

export default router;
