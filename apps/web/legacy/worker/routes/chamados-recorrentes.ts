import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { UserProfile } from "../../shared/types";

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

interface CreateRecorrenteDTO {
  titulo: string;
  descricao: string;
  tipo: string;
  tipo_problema?: string;
  categoria_id?: number;
  subcategoria_id?: number;
  item_id?: number;
  setor_destino_id?: number;
  setor_responsavel_execucao_id?: number;
  solicitante_setor?: string;
  impacto?: string;
  urgencia?: string;
  grupo_responsavel_id?: number;
  tecnico_responsavel_id?: string;
  frequencia: 'Diária' | 'Semanal' | 'Mensal' | 'Anual';
  dias_semana?: string;
  dia_mes?: number;
  hora_execucao?: string;
}

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

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
      // Se já passou hoje (no horário BR), agenda para amanhã
      if (proximoBr <= agoraBr) {
        proximoBr.setDate(proximoBr.getDate() + 1);
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

// Listar chamados recorrentes
router.get("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil === 'solicitante') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM chamados_recorrentes ORDER BY created_at DESC"
  ).all<ChamadoRecorrente>();

  return c.json(results);
});

// Criar chamado recorrente
router.post("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || profile.perfil === 'solicitante') {
    return c.json({ error: "Apenas gestores e técnicos podem criar chamados recorrentes" }, 403);
  }

  const body: CreateRecorrenteDTO = await c.req.json();

  // Criar o recorrente
  const result = await c.env.DB.prepare(
    `INSERT INTO chamados_recorrentes (
      titulo, descricao, tipo, tipo_problema, categoria_id, subcategoria_id, item_id,
      setor_destino_id, setor_responsavel_execucao_id, solicitante_setor, impacto, urgencia, grupo_responsavel_id,
      tecnico_responsavel_id, frequencia, dias_semana, dia_mes,
      hora_execucao, ativo, criador_id, criador_nome
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.titulo,
    body.descricao,
    body.tipo,
    body.tipo_problema || null,
    body.categoria_id || null,
    body.subcategoria_id || null,
    body.item_id || null,
    body.setor_destino_id || null,
    body.setor_responsavel_execucao_id || null,
    body.solicitante_setor || null,
    body.impacto || null,
    body.urgencia || null,
    body.grupo_responsavel_id || null,
    body.tecnico_responsavel_id || null,
    body.frequencia,
    body.dias_semana || null,
    body.dia_mes || null,
    body.hora_execucao || null,
    1, // ativo = true
    user.id,
    profile.nome
  ).run();

  const recorrente = await c.env.DB.prepare(
    "SELECT * FROM chamados_recorrentes WHERE id = ?"
  ).bind(result.meta.last_row_id).first<ChamadoRecorrente>();

  if (recorrente) {
    // Calcular próximo horário
    const proximoHorario = calcularProximoHorario(recorrente);
    
    await c.env.DB.prepare(
      "UPDATE chamados_recorrentes SET proximo_chamado_em = ? WHERE id = ?"
    ).bind(proximoHorario.toISOString(), recorrente.id).run();

    // Recarregar com o próximo horário atualizado
    const updated = await c.env.DB.prepare(
      "SELECT * FROM chamados_recorrentes WHERE id = ?"
    ).bind(recorrente.id).first<ChamadoRecorrente>();
    
    return c.json(updated, 201);
  }

  return c.json(recorrente, 201);
});

// Obter chamado recorrente
router.get("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil === 'solicitante') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const recorrente = await c.env.DB.prepare(
    "SELECT * FROM chamados_recorrentes WHERE id = ?"
  ).bind(id).first<ChamadoRecorrente>();

  if (!recorrente) {
    return c.json({ error: "Chamado recorrente não encontrado" }, 404);
  }

  return c.json(recorrente);
});

// Atualizar chamado recorrente
router.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body: Partial<CreateRecorrenteDTO> = await c.req.json();

  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil === 'solicitante') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const recorrente = await c.env.DB.prepare(
    "SELECT * FROM chamados_recorrentes WHERE id = ?"
  ).bind(id).first<ChamadoRecorrente>();

  if (!recorrente) {
    return c.json({ error: "Chamado recorrente não encontrado" }, 404);
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (body.titulo !== undefined) {
    updates.push("titulo = ?");
    params.push(body.titulo);
  }
  if (body.descricao !== undefined) {
    updates.push("descricao = ?");
    params.push(body.descricao);
  }
  if (body.tipo !== undefined) {
    updates.push("tipo = ?");
    params.push(body.tipo);
  }
  if (body.tipo_problema !== undefined) {
    updates.push("tipo_problema = ?");
    params.push(body.tipo_problema);
  }
  if (body.categoria_id !== undefined) {
    updates.push("categoria_id = ?");
    params.push(body.categoria_id);
  }
  if (body.subcategoria_id !== undefined) {
    updates.push("subcategoria_id = ?");
    params.push(body.subcategoria_id);
  }
  if (body.item_id !== undefined) {
    updates.push("item_id = ?");
    params.push(body.item_id);
  }
  if (body.setor_destino_id !== undefined) {
    updates.push("setor_destino_id = ?");
    params.push(body.setor_destino_id);
  }
  if (body.setor_responsavel_execucao_id !== undefined) {
    updates.push("setor_responsavel_execucao_id = ?");
    params.push(body.setor_responsavel_execucao_id);
  }
  if (body.solicitante_setor !== undefined) {
    updates.push("solicitante_setor = ?");
    params.push(body.solicitante_setor);
  }
  if (body.tecnico_responsavel_id !== undefined) {
    updates.push("tecnico_responsavel_id = ?");
    params.push(body.tecnico_responsavel_id);
  }
  if (body.frequencia !== undefined) {
    updates.push("frequencia = ?");
    params.push(body.frequencia);
  }
  if (body.dias_semana !== undefined) {
    updates.push("dias_semana = ?");
    params.push(body.dias_semana);
  }
  if (body.dia_mes !== undefined) {
    updates.push("dia_mes = ?");
    params.push(body.dia_mes);
  }
  if (body.hora_execucao !== undefined) {
    updates.push("hora_execucao = ?");
    params.push(body.hora_execucao);
  }

  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    await c.env.DB.prepare(
      `UPDATE chamados_recorrentes SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...params).run();

    // Recalcular próximo horário
    const updated = await c.env.DB.prepare(
      "SELECT * FROM chamados_recorrentes WHERE id = ?"
    ).bind(id).first<ChamadoRecorrente>();

    if (updated) {
      const proximoHorario = calcularProximoHorario(updated);
      await c.env.DB.prepare(
        "UPDATE chamados_recorrentes SET proximo_chamado_em = ? WHERE id = ?"
      ).bind(proximoHorario.toISOString(), id).run();
    }
  }

  const recorrenteAtualizado = await c.env.DB.prepare(
    "SELECT * FROM chamados_recorrentes WHERE id = ?"
  ).bind(id).first<ChamadoRecorrente>();

  return c.json(recorrenteAtualizado);
});

// Ativar/desativar chamado recorrente
router.patch("/:id/toggle", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil === 'solicitante') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const recorrente = await c.env.DB.prepare(
    "SELECT * FROM chamados_recorrentes WHERE id = ?"
  ).bind(id).first<ChamadoRecorrente>();

  if (!recorrente) {
    return c.json({ error: "Chamado recorrente não encontrado" }, 404);
  }

  const novoEstado = !recorrente.ativo;

  await c.env.DB.prepare(
    "UPDATE chamados_recorrentes SET ativo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(novoEstado, id).run();

  const updated = await c.env.DB.prepare(
    "SELECT * FROM chamados_recorrentes WHERE id = ?"
  ).bind(id).first<ChamadoRecorrente>();

  return c.json(updated);
});

// Deletar chamado recorrente
router.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || (profile.perfil !== 'gestor' && profile.perfil !== 'admin' && profile.perfil !== 'tecnico')) {
    return c.json({ error: "Apenas gestores, admins e técnicos podem deletar chamados recorrentes" }, 403);
  }

  await c.env.DB.prepare(
    "DELETE FROM chamados_recorrentes WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true });
});

export default router;
