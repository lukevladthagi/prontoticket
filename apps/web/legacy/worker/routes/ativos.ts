import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { Ativo, MovimentacaoEstoque, UserProfile } from "../../shared/types";
import { getDataHoraBrasil } from "../utils/timezone";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  const status = c.req.query("status");
  const tipo = c.req.query("tipo");
  const unidadeId = c.req.query("unidade_id");
  const tipoPropriedade = c.req.query("tipo_propriedade");

  let query = "SELECT * FROM ativos WHERE 1=1";
  const params: any[] = [];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  if (tipo) {
    query += " AND tipo = ?";
    params.push(tipo);
  }

  if (unidadeId) {
    query += " AND unidade_id = ?";
    params.push(parseInt(unidadeId));
  }

  if (tipoPropriedade) {
    query += " AND tipo_propriedade = ?";
    params.push(tipoPropriedade);
  }

  query += " ORDER BY created_at DESC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all<Ativo>();

  return c.json(results);
});

router.post("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['tecnico', 'gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  // Verificar se o código de barras já existe
  const ativoExistente = await c.env.DB.prepare(
    "SELECT id FROM ativos WHERE codigo_barras = ?"
  ).bind(body.codigo_barras).first();

  if (ativoExistente) {
    return c.json({ error: "Este código de barras já está cadastrado no sistema" }, 400);
  }

  // Mapear status para valores compatíveis com o banco atual
  const mapearStatus = (status: string): string => {
    const mapeamento: { [key: string]: string } = {
      'Em uso': 'Em uso',
      'Com defeito': 'Manutenção',
      'Em manutenção': 'Manutenção',
      'Descartado/Baixado': 'Descartado',
      'Aguardando retirada ou devolução': 'Em uso',
      'Devolvido': 'Devolvido',
      'Disponível': 'Disponível',
      'Baixado ou descarte': 'Descartado'
    };
    return mapeamento[status] || 'Em uso';
  };

  // Calcular data de retirada automaticamente (180 dias após solicitação)
  let dataRetirada = body.data_retirada;
  if (body.data_solicitacao && body.tipo_propriedade === 'Alugado') {
    const dataSolicitacao = new Date(body.data_solicitacao);
    dataSolicitacao.setDate(dataSolicitacao.getDate() + 180);
    dataRetirada = dataSolicitacao.toISOString().split('T')[0];
  }

  // Usar o status selecionado pelo usuário diretamente, sem lógica automática
  const statusMapeado = mapearStatus(body.status);

  const result = await c.env.DB.prepare(
    `INSERT INTO ativos (
      codigo_barras, descricao, tipo, marca, modelo, numero_serie, patrimonio, status, 
      localizacao, unidade_id, setor_id, usuario_alocado_id, responsavel_nome, data_garantia,
      tipo_propriedade, fornecedor_nome, data_solicitacao, data_retirada, data_defeito, data_manutencao,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.codigo_barras,
    body.descricao,
    body.tipo || null,
    body.marca || null,
    body.modelo || null,
    body.numero_serie,
    body.patrimonio || null,
    statusMapeado,
    body.localizacao || null,
    body.unidade_id || null,
    body.setor_id || null,
    body.usuario_alocado_id || null,
    body.responsavel_nome,
    body.data_garantia || null,
    body.tipo_propriedade || 'Patrimônio',
    body.fornecedor_nome || null,
    body.data_solicitacao || null,
    dataRetirada || null,
    body.data_defeito || null,
    body.data_manutencao || null,
    getDataHoraBrasil(),
    getDataHoraBrasil()
  ).run();

  const ativoId = result.meta.last_row_id as number;

  // Registrar movimentação de entrada
  await c.env.DB.prepare(
    `INSERT INTO movimentacoes_estoque (
      ativo_id, tipo, responsavel_id, 
      origem, destino, motivo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    ativoId,
    'Entrada',
    user.id,
    null,
    body.localizacao,
    'Cadastro inicial do ativo',
    getDataHoraBrasil(),
    getDataHoraBrasil()
  ).run();

  const ativo = await c.env.DB.prepare(
    "SELECT * FROM ativos WHERE id = ?"
  ).bind(ativoId).first<Ativo>();

  return c.json(ativo, 201);
});

router.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const ativo = await c.env.DB.prepare(
    "SELECT * FROM ativos WHERE id = ?"
  ).bind(id).first<Ativo>();

  if (!ativo) {
    return c.json({ error: "Ativo não encontrado" }, 404);
  }

  return c.json(ativo);
});

router.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['tecnico', 'gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  // Verificar se o código de barras já existe em outro item
  const ativoExistente = await c.env.DB.prepare(
    "SELECT id FROM ativos WHERE codigo_barras = ? AND id != ?"
  ).bind(body.codigo_barras, id).first();

  if (ativoExistente) {
    return c.json({ error: "Este código de barras já está sendo usado em outro item" }, 400);
  }

  // Mapear status para valores compatíveis com o banco atual
  const mapearStatus = (status: string): string => {
    const mapeamento: { [key: string]: string } = {
      'Em uso': 'Em uso',
      'Com defeito': 'Manutenção',
      'Em manutenção': 'Manutenção',
      'Descartado/Baixado': 'Descartado',
      'Aguardando retirada ou devolução': 'Em uso',
      'Devolvido': 'Devolvido',
      'Disponível': 'Disponível',
      'Baixado ou descarte': 'Descartado'
    };
    return mapeamento[status] || 'Em uso';
  };

  // Recalcular data de retirada se data de solicitação mudou
  let dataRetirada = body.data_retirada;
  if (body.data_solicitacao && body.tipo_propriedade === 'Alugado') {
    const dataSolicitacao = new Date(body.data_solicitacao);
    dataSolicitacao.setDate(dataSolicitacao.getDate() + 180);
    dataRetirada = dataSolicitacao.toISOString().split('T')[0];
  }

  // Usar o status selecionado pelo usuário diretamente, sem lógica automática
  const statusMapeado = mapearStatus(body.status);

  await c.env.DB.prepare(
    `UPDATE ativos SET 
      codigo_barras = ?, descricao = ?, tipo = ?, marca = ?, modelo = ?, numero_serie = ?, 
      patrimonio = ?, status = ?, localizacao = ?, responsavel_nome = ?,
      unidade_id = ?, setor_id = ?, usuario_alocado_id = ?, data_garantia = ?,
      tipo_propriedade = ?, fornecedor_nome = ?, data_solicitacao = ?, data_retirada = ?,
      data_defeito = ?, data_manutencao = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    body.codigo_barras,
    body.descricao,
    body.tipo || null,
    body.marca || null,
    body.modelo || null,
    body.numero_serie,
    body.patrimonio || null,
    statusMapeado,
    body.localizacao || null,
    body.responsavel_nome,
    body.unidade_id || null,
    body.setor_id || null,
    body.usuario_alocado_id || null,
    body.data_garantia || null,
    body.tipo_propriedade,
    body.fornecedor_nome || null,
    body.data_solicitacao || null,
    dataRetirada || null,
    body.data_defeito || null,
    body.data_manutencao || null,
    getDataHoraBrasil(),
    id
  ).run();

  const ativo = await c.env.DB.prepare(
    "SELECT * FROM ativos WHERE id = ?"
  ).bind(id).first<Ativo>();

  return c.json(ativo);
});

router.get("/:id/movimentacoes", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM movimentacoes_estoque WHERE ativo_id = ? ORDER BY data_movimentacao DESC"
  ).bind(id).all<MovimentacaoEstoque>();

  return c.json(results);
});

router.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['tecnico', 'gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM ativos WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

router.post("/:id/movimentar", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['tecnico', 'gestor_ti', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  const ativo = await c.env.DB.prepare(
    "SELECT * FROM ativos WHERE id = ?"
  ).bind(id).first<Ativo>();

  if (!ativo) {
    return c.json({ error: "Ativo não encontrado" }, 404);
  }

  // Registrar movimentação
  await c.env.DB.prepare(
    `INSERT INTO movimentacoes_estoque (
      ativo_id, tipo, responsavel_id, 
      origem, destino, motivo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.tipo_movimentacao === 'transferencia' ? 'Transferência' : body.tipo_movimentacao === 'baixa' ? 'Baixa' : 'Saída',
    user.id,
    ativo.unidade_id?.toString(),
    body.unidade_destino_id?.toString(),
    body.observacoes || null,
    getDataHoraBrasil(),
    getDataHoraBrasil()
  ).run();

  // Atualizar localização do ativo se for transferência
  if (body.tipo_movimentacao === 'transferencia' && body.unidade_destino_id) {
    await c.env.DB.prepare(
      "UPDATE ativos SET unidade_id = ?, updated_at = ? WHERE id = ?"
    ).bind(body.unidade_destino_id, getDataHoraBrasil(), id).run();
  }

  // Atualizar status se for baixa
  if (body.tipo_movimentacao === 'baixa') {
    await c.env.DB.prepare(
      "UPDATE ativos SET status = 'Descartado', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(id).run();
  }

  return c.json({ success: true });
});

export default router;
