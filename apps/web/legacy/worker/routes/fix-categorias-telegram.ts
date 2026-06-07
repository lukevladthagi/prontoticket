import { Hono } from 'hono';
import type { MochaUser } from "@getmocha/users-service/shared";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Diagnóstico - ver tickets da TI sem categoria
router.get('/diagnostico', async (c) => {
  const env = c.env;
  
  try {
    // Buscar tickets da TI sem categoria (todas as origens)
    const ticketsTISemCategoria = await env.DB.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.tipo_problema,
        c.origem,
        c.setor_destino_id,
        s.nome as setor_nome,
        c.titulo,
        c.created_at
      FROM chamados c
      LEFT JOIN setores s ON c.setor_destino_id = s.id
      WHERE c.setor_destino_id = 1
        AND c.categoria_id IS NULL
      ORDER BY c.created_at DESC
    `).all();

    // Buscar total de tickets da TI
    const totalTI = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM chamados WHERE setor_destino_id = 1
    `).first();

    // Buscar tickets da TI COM categoria
    const ticketsTIComCategoria = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM chamados WHERE setor_destino_id = 1 AND categoria_id IS NOT NULL
    `).first();

    return c.json({
      observacao: 'Apenas tickets da TI precisam de categoria. Outros setores (Rouparia, Marketing, Manutenção, Comercial) não utilizam categorias.',
      total_tickets_ti: (totalTI as any)?.total || 0,
      tickets_com_categoria: (ticketsTIComCategoria as any)?.total || 0,
      tickets_sem_categoria: ticketsTISemCategoria.results.length,
      tickets: ticketsTISemCategoria.results
    });
  } catch (error) {
    console.error('Erro no diagnóstico:', error);
    return c.json({ 
      error: 'Erro ao executar diagnóstico',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Função auxiliar para validar e obter categoria (com criação automática se necessário)
async function validarOuCriarCategoria(
  db: D1Database, 
  nomeCategoria: string, 
  setorId: number
): Promise<{ 
  categoriaId: number; 
  criada: boolean; 
  fallbackUsado: boolean;
  avisos: string[];
}> {
  const avisos: string[] = [];
  
  // Normalizar nome (trim e case-insensitive)
  const nomeNormalizado = nomeCategoria.trim();
  
  // ETAPA 1: Buscar categoria existente (case-insensitive e trimmed)
  const categoriaExistente = await db.prepare(`
    SELECT id, nome, ativo FROM categorias 
    WHERE LOWER(TRIM(nome)) = LOWER(?) 
      AND setor_id = ? 
      AND tipo = 'categoria'
    LIMIT 1
  `).bind(nomeNormalizado, setorId).first() as any;

  if (categoriaExistente) {
    if (!categoriaExistente.ativo) {
      avisos.push(`Categoria "${categoriaExistente.nome}" está inativa mas será utilizada`);
    }
    return { 
      categoriaId: categoriaExistente.id, 
      criada: false, 
      fallbackUsado: false,
      avisos 
    };
  }

  // ETAPA 2: Categoria não existe - criar automaticamente
  avisos.push(`Categoria "${nomeNormalizado}" não encontrada - criando automaticamente`);
  
  try {
    const resultCategoria = await db.prepare(`
      INSERT INTO categorias (nome, descricao, tipo, setor_id, tipo_problema, ativo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      nomeNormalizado,
      `Categoria criada automaticamente para chamados sem classificação específica`,
      'categoria',
      setorId,
      nomeNormalizado // Usa o nome como tipo_problema também
    ).run();
    
    const categoriaId = resultCategoria.meta?.last_row_id;
    
    if (!categoriaId) {
      throw new Error('Falha ao obter ID da categoria criada');
    }
    
    // Criar SLAs padrão para a categoria (P1-P4)
    const prioridades = ['P1', 'P2', 'P3', 'P4'];
    for (const prioridade of prioridades) {
      await db.prepare(`
        INSERT INTO slas (
          nome, prioridade, tipo_chamado, tempo_resposta_minutos, tempo_solucao_minutos,
          setor_id, categoria_id, ativo, created_at, updated_at
        ) VALUES (?, ?, 'Incidente', 60, 240, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        `${nomeNormalizado} - ${prioridade}`,
        prioridade,
        setorId,
        categoriaId
      ).run();
    }
    
    avisos.push(`SLAs padrão criados para categoria "${nomeNormalizado}"`);
    
    return { 
      categoriaId, 
      criada: true, 
      fallbackUsado: false,
      avisos 
    };
  } catch (error) {
    // ETAPA 3: Falha ao criar - usar fallback "Geral"
    avisos.push(`Erro ao criar categoria "${nomeNormalizado}" - usando fallback "Geral"`);
    console.warn(`Erro ao criar categoria:`, error);
    
    // Buscar ou criar categoria "Geral" como fallback
    const fallback = await db.prepare(`
      SELECT id FROM categorias 
      WHERE LOWER(TRIM(nome)) = 'geral'
        AND setor_id = ? 
        AND tipo = 'categoria'
      LIMIT 1
    `).bind(setorId).first() as any;
    
    if (fallback) {
      return { 
        categoriaId: fallback.id, 
        criada: false, 
        fallbackUsado: true,
        avisos 
      };
    }
    
    // Criar "Geral" se não existir
    const resultGeral = await db.prepare(`
      INSERT INTO categorias (nome, descricao, tipo, setor_id, tipo_problema, ativo, created_at, updated_at)
      VALUES ('Geral', 'Categoria padrão para chamados sem classificação', 'categoria', ?, 'Outros', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(setorId).run();
    
    return { 
      categoriaId: resultGeral.meta?.last_row_id || 0, 
      criada: true, 
      fallbackUsado: true,
      avisos 
    };
  }
}

// Corrigir - associar categorias aos tickets da TI
router.post('/corrigir', async (c) => {
  const env = c.env;
  const setorId = 1; // TI
  const avisosTotais: string[] = [];
  
  try {
    // ETAPA 1: Definir tipo_problema = 'Outros' para tickets sem tipo_problema
    const ticketsSemTipo = await env.DB.prepare(`
      SELECT id, numero
      FROM chamados
      WHERE setor_destino_id = ?
        AND (tipo_problema IS NULL OR TRIM(tipo_problema) = '')
    `).bind(setorId).all();

    let tiposAtualizados = 0;
    if (ticketsSemTipo.results.length > 0) {
      avisosTotais.push(`Encontrados ${ticketsSemTipo.results.length} tickets sem tipo de problema`);
      
      for (const ticket of ticketsSemTipo.results) {
        const t = ticket as any;
        await env.DB.prepare(`
          UPDATE chamados 
          SET tipo_problema = 'Outros', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(t.id).run();
        tiposAtualizados++;
      }
    }

    // ETAPA 2: Validar ou criar categoria "Outros"
    const { categoriaId, criada, fallbackUsado, avisos } = await validarOuCriarCategoria(
      env.DB, 
      'Outros', 
      setorId
    );
    
    avisosTotais.push(...avisos);

    // Verificar se categoria foi obtida com sucesso
    if (!categoriaId) {
      throw new Error('Não foi possível obter ou criar categoria para os tickets');
    }

    // ETAPA 3: Atualizar TODOS os tickets da TI sem categoria
    const resultado = await env.DB.prepare(`
      UPDATE chamados 
      SET categoria_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE setor_destino_id = ?
        AND categoria_id IS NULL
    `).bind(categoriaId, setorId).run();

    const ticketsAtualizados = resultado.meta?.changes || 0;

    return c.json({
      success: true,
      created_category: criada,
      fallback_used: fallbackUsado,
      tickets_sem_tipo_atualizados: tiposAtualizados,
      tickets_categorizados: ticketsAtualizados,
      categoria_utilizada_id: categoriaId,
      avisos: avisosTotais,
      mensagem: `${ticketsAtualizados} tickets foram categorizados com sucesso`
    });
    
  } catch (error) {
    console.error('Erro crítico na correção:', error);
    avisosTotais.push(`Erro crítico: ${error instanceof Error ? error.message : String(error)}`);
    
    // Retornar erro mas com estrutura consistente
    return c.json({ 
      success: false,
      created_category: false,
      fallback_used: false,
      error: 'Erro ao executar correção',
      details: error instanceof Error ? error.message : String(error),
      avisos: avisosTotais
    }, 500);
  }
});

export default router;
