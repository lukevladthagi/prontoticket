import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const app = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

app.get("/verificar", authMiddleware, async (c) => {
  try {
    // Verificar colunas da tabela chamados
    const tableInfo = await c.env.DB.prepare(
      `PRAGMA table_info(chamados)`
    ).all();

    const colunasExistentes = tableInfo.results.map((col: any) => col.name);

    // Colunas que o código espera encontrar
    const colunasEsperadas = [
      'id',
      'numero',
      'tipo',
      'solicitante_id',
      'solicitante_nome',
      'solicitante_email',
      'solicitante_telefone',
      'solicitante_setor',
      'unidade_id',
      'categoria_id',
      'subcategoria_id',
      'item_id',
      'titulo',
      'descricao',
      'impacto',
      'urgencia',
      'prioridade',
      'status',
      'grupo_responsavel_id',
      'tecnico_responsavel_id',
      'ambiente',
      'passos_reproduzir',
      'sla_id',
      'data_abertura',
      'data_primeira_resposta',
      'data_resolucao',
      'data_fechamento',
      'prazo_resposta',
      'prazo_solucao',
      'violacao_sla',
      'solucao',
      'avaliacao_nota',
      'avaliacao_comentario',
      'avaliacao_nps',
      'avaliacao_resolveu',
      'avaliacao_data',
      'created_at',
      'updated_at',
      'setor_destino_id',
      'origem',
      'agendado',
      'data_agendamento',
      'observacoes_agendamento',
      'origem_recorrente_id',
      'setor_responsavel_execucao_id',
      'telegram_chat_id',
      'afeta_paciente',
      'fila_id',
      'sla_pausado_em',
      'sla_pausado_motivo',
      'tempo_pausado_minutos',
      'tipo_problema'
    ];

    // Identificar diferenças
    const colunasFaltando = colunasEsperadas.filter(col => !colunasExistentes.includes(col));
    const colunasExtras = colunasExistentes.filter(col => !colunasEsperadas.includes(col));

    // Testar uma query simples
    let testeQuery = null;
    try {
      const resultado = await c.env.DB.prepare(`
        SELECT 
          numero,
          data_abertura,
          data_primeira_resposta,
          data_resolucao,
          data_fechamento,
          prazo_resposta,
          prazo_solucao
        FROM chamados 
        LIMIT 1
      `).first();
      testeQuery = { sucesso: true, resultado };
    } catch (error) {
      testeQuery = { 
        sucesso: false, 
        erro: error instanceof Error ? error.message : String(error) 
      };
    }

    return c.json({
      total_colunas_existentes: colunasExistentes.length,
      total_colunas_esperadas: colunasEsperadas.length,
      colunas_existentes: colunasExistentes,
      colunas_faltando: colunasFaltando,
      colunas_extras: colunasExtras,
      compatibilidade: colunasFaltando.length === 0 ? 'OK' : 'INCOMPATÍVEL',
      teste_query: testeQuery
    });
  } catch (error) {
    return c.json({ 
      error: "Erro ao verificar colunas", 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

export default app;
