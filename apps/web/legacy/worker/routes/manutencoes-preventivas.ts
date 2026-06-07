import { Hono } from 'hono';
import { authMiddleware } from '@getmocha/users-service/backend';
import type { MochaUser } from '@getmocha/users-service/shared';

const app = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar manutenções preventivas
app.get('/', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { status, setor_id, unidade_id } = c.req.query();

  let query = `
    SELECT 
      mp.*,
      s.nome as setor_nome,
      u.nome as unidade_nome,
      g.nome as grupo_nome
    FROM manutencoes_preventivas mp
    LEFT JOIN setores s ON mp.setor_id = s.id
    LEFT JOIN unidades u ON mp.unidade_id = u.id
    LEFT JOIN grupos_atendimento g ON mp.grupo_responsavel_id = g.id
    WHERE mp.ativo = 1
  `;

  const params: any[] = [];

  if (status) {
    query += ' AND mp.status = ?';
    params.push(status);
  }

  if (setor_id) {
    query += ' AND mp.setor_id = ?';
    params.push(setor_id);
  }

  if (unidade_id) {
    query += ' AND mp.unidade_id = ?';
    params.push(unidade_id);
  }

  query += ' ORDER BY mp.proxima_manutencao_data ASC';

  const { results } = await db.prepare(query).bind(...params).all();

  return c.json(results);
});

// Obter detalhes de uma manutenção preventiva
app.get('/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const manutencao = await db.prepare(`
    SELECT 
      mp.*,
      s.nome as setor_nome,
      u.nome as unidade_nome,
      g.nome as grupo_nome
    FROM manutencoes_preventivas mp
    LEFT JOIN setores s ON mp.setor_id = s.id
    LEFT JOIN unidades u ON mp.unidade_id = u.id
    LEFT JOIN grupos_atendimento g ON mp.grupo_responsavel_id = g.id
    WHERE mp.id = ?
  `).bind(id).first();

  if (!manutencao) {
    return c.json({ error: 'Manutenção não encontrada' }, 404);
  }

  // Buscar histórico de manutenções realizadas
  const { results: historico } = await db.prepare(`
    SELECT 
      mr.*,
      c.numero as chamado_numero
    FROM manutencoes_realizadas mr
    LEFT JOIN chamados c ON mr.chamado_id = c.id
    WHERE mr.manutencao_preventiva_id = ?
    ORDER BY mr.data_execucao DESC
  `).bind(id).all();

  return c.json({ ...manutencao, historico });
});

// Criar nova manutenção preventiva
app.post('/', authMiddleware, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const {
    ativo_id,
    nome_equipamento,
    tipo_equipamento,
    patrimonio,
    modelo,
    numero_serie,
    local,
    unidade_id,
    setor_id,
    periodicidade_dias,
    dias_aviso_antecipado = 7,
    ultima_manutencao_data,
    proxima_manutencao_data,
    responsavel_id,
    grupo_responsavel_id,
    checklist,
    observacoes,
    gerar_chamado_automatico = true
  } = body;

  if (!nome_equipamento || !tipo_equipamento || !periodicidade_dias || !proxima_manutencao_data) {
    return c.json({ error: 'Campos obrigatórios: nome_equipamento, tipo_equipamento, periodicidade_dias, proxima_manutencao_data' }, 400);
  }

  // Calcular status inicial
  const hoje = new Date();
  const dataProxima = new Date(proxima_manutencao_data);
  const diasParaVencimento = Math.floor((dataProxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  
  let status = 'Em dia';
  if (diasParaVencimento < 0) {
    status = 'Atrasado';
  } else if (diasParaVencimento <= dias_aviso_antecipado) {
    status = 'Próximo do vencimento';
  }

  // Como ativo_id é NOT NULL no schema, vamos criar um ativo temporário se não for fornecido
  let finalAtivoId = ativo_id;
  
  if (!finalAtivoId) {
    try {
      // Gerar identificadores únicos para evitar conflitos
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const uniqueNumeroSerie = numero_serie || `MANU-${timestamp}-${random}`;
      const uniquePatrimonio = patrimonio || `MANU-${timestamp}-${random}`;
      
      console.log('Criando ativo automático:', {
        tipo_equipamento,
        modelo,
        uniqueNumeroSerie,
        uniquePatrimonio,
        local,
        unidade_id,
        setor_id
      });
      
      // Criar um ativo "virtual" para a manutenção
      const ativoResult = await db.prepare(`
        INSERT INTO ativos (
          tipo, marca, modelo, numero_serie, patrimonio, status, 
          localizacao, unidade_id, observacoes
        ) VALUES (?, ?, ?, ?, ?, 'Em uso', ?, ?, 'Ativo criado automaticamente para manutenção preventiva')
      `).bind(
        tipo_equipamento,
        null,
        modelo || null,
        uniqueNumeroSerie,
        uniquePatrimonio,
        local || null,
        unidade_id || null
      ).run();
      
      finalAtivoId = ativoResult.meta.last_row_id;
      console.log('Ativo criado com sucesso, ID:', finalAtivoId);
    } catch (error: any) {
      console.error('Erro ao criar ativo:', error);
      console.error('Stack:', error?.stack);
      console.error('Message:', error?.message);
      return c.json({ 
        error: 'Erro ao criar ativo vinculado à manutenção',
        details: error?.message || 'Erro desconhecido'
      }, 500);
    }
  }

  try {
    console.log('Inserindo manutenção preventiva:', {
      finalAtivoId,
      nome_equipamento,
      tipo_equipamento,
      periodicidade_dias,
      proxima_manutencao_data,
      status
    });

    const result = await db.prepare(`
      INSERT INTO manutencoes_preventivas (
        ativo_id, nome_equipamento, tipo_equipamento, patrimonio, modelo, numero_serie,
        local, unidade_id, setor_id, periodicidade_dias, dias_aviso_antecipado,
        ultima_manutencao_data, proxima_manutencao_data, status, responsavel_id,
        grupo_responsavel_id, checklist, observacoes, gerar_chamado_automatico
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      finalAtivoId, nome_equipamento, tipo_equipamento, patrimonio, modelo, numero_serie,
      local, unidade_id, setor_id, periodicidade_dias, dias_aviso_antecipado,
      ultima_manutencao_data, proxima_manutencao_data, status, responsavel_id,
      grupo_responsavel_id, checklist, observacoes, gerar_chamado_automatico ? 1 : 0
    ).run();

    console.log('Manutenção preventiva criada com sucesso, ID:', result.meta.last_row_id);
    return c.json({ id: result.meta.last_row_id, status }, 201);
  } catch (error: any) {
    console.error('Erro ao criar manutenção preventiva:', error);
    console.error('Stack:', error?.stack);
    console.error('Message:', error?.message);
    return c.json({ 
      error: 'Erro ao criar manutenção preventiva',
      details: error?.message || 'Erro desconhecido'
    }, 500);
  }
});

// Atualizar manutenção preventiva
app.put('/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();

  const {
    nome_equipamento,
    tipo_equipamento,
    patrimonio,
    modelo,
    local,
    unidade_id,
    setor_id,
    periodicidade_dias,
    dias_aviso_antecipado,
    proxima_manutencao_data,
    responsavel_id,
    grupo_responsavel_id,
    checklist,
    observacoes,
    gerar_chamado_automatico
  } = body;

  // Calcular novo status se a data da próxima manutenção mudou
  let status;
  if (proxima_manutencao_data) {
    const hoje = new Date();
    const dataProxima = new Date(proxima_manutencao_data);
    const diasParaVencimento = Math.floor((dataProxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    status = 'Em dia';
    if (diasParaVencimento < 0) {
      status = 'Atrasado';
    } else if (diasParaVencimento <= (dias_aviso_antecipado || 7)) {
      status = 'Próximo do vencimento';
    }
  }

  await db.prepare(`
    UPDATE manutencoes_preventivas 
    SET 
      nome_equipamento = COALESCE(?, nome_equipamento),
      tipo_equipamento = COALESCE(?, tipo_equipamento),
      patrimonio = ?,
      modelo = ?,
      local = COALESCE(?, local),
      unidade_id = ?,
      setor_id = ?,
      periodicidade_dias = COALESCE(?, periodicidade_dias),
      dias_aviso_antecipado = COALESCE(?, dias_aviso_antecipado),
      proxima_manutencao_data = COALESCE(?, proxima_manutencao_data),
      responsavel_id = ?,
      grupo_responsavel_id = ?,
      checklist = ?,
      observacoes = ?,
      gerar_chamado_automatico = COALESCE(?, gerar_chamado_automatico),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    nome_equipamento,
    tipo_equipamento,
    patrimonio,
    modelo,
    local,
    unidade_id,
    setor_id,
    periodicidade_dias,
    dias_aviso_antecipado,
    proxima_manutencao_data,
    responsavel_id,
    grupo_responsavel_id,
    checklist,
    observacoes,
    gerar_chamado_automatico !== undefined ? (gerar_chamado_automatico ? 1 : 0) : null,
    status,
    id
  ).run();

  return c.json({ success: true });
});

// Registrar manutenção realizada
app.post('/:id/realizar', authMiddleware, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');

  const id = c.req.param('id');
  const body = await c.req.json();
  const {
    data_execucao,
    chamado_id,
    checklist_completo = false,
    itens_checklist,
    observacoes
  } = body;

  if (!data_execucao) {
    return c.json({ error: 'Campo obrigatório: data_execucao' }, 400);
  }

  // Buscar dados da manutenção preventiva
  const manutencao = await db.prepare(`
    SELECT periodicidade_dias, dias_aviso_antecipado FROM manutencoes_preventivas WHERE id = ?
  `).bind(id).first<any>();

  if (!manutencao) {
    return c.json({ error: 'Manutenção não encontrada' }, 404);
  }

  // Calcular próxima data
  const dataExecucao = new Date(data_execucao);
  const proximaData = new Date(dataExecucao);
  proximaData.setDate(proximaData.getDate() + manutencao.periodicidade_dias);
  const proximaDataStr = proximaData.toISOString().split('T')[0];

  // Buscar perfil do usuário
  const profile = await db.prepare(
    'SELECT nome FROM user_profiles WHERE user_id = ?'
  ).bind(user!.id).first<{ nome: string }>();

  // Registrar manutenção realizada
  await db.prepare(`
    INSERT INTO manutencoes_realizadas (
      manutencao_preventiva_id, chamado_id, data_execucao, tecnico_id, tecnico_nome,
      checklist_completo, itens_checklist, observacoes, proxima_data_calculada
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, chamado_id || null, data_execucao, user!.id, profile?.nome || user!.email,
    checklist_completo ? 1 : 0, itens_checklist, observacoes, proximaDataStr
  ).run();

  // Atualizar manutenção preventiva
  const hoje = new Date();
  const diasParaVencimento = Math.floor((proximaData.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  
  let status = 'Em dia';
  if (diasParaVencimento < 0) {
    status = 'Atrasado';
  } else if (diasParaVencimento <= manutencao.dias_aviso_antecipado) {
    status = 'Próximo do vencimento';
  }

  await db.prepare(`
    UPDATE manutencoes_preventivas 
    SET 
      ultima_manutencao_data = ?,
      proxima_manutencao_data = ?,
      status = ?,
      chamado_gerado_id = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data_execucao, proximaDataStr, status, id).run();

  return c.json({ success: true, proxima_manutencao_data: proximaDataStr });
});

export default app;
