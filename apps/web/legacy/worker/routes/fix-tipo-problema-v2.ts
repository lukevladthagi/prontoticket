import { Hono } from "hono";

const app = new Hono();

// Endpoint para corrigir tipo_problema dos chamados existentes
app.post("/corrigir", async (c: any) => {
  try {
    // Remover verificação de autenticação para debug
    console.log("[FIX TIPO PROBLEMA V2] Iniciando correção automática...");

    // Buscar todos os chamados que não têm tipo_problema definido
    const chamadosSemTipo = await c.env.DB.prepare(`
      SELECT c.id, c.numero, c.categoria_id, c.subcategoria_id, c.item_id, c.setor_destino_id
      FROM chamados c
      WHERE c.tipo_problema IS NULL OR c.tipo_problema = 'null' OR c.tipo_problema = '' OR TRIM(c.tipo_problema) = ''
    `).all();

    if (!chamadosSemTipo.results || chamadosSemTipo.results.length === 0) {
      return c.json({ 
        message: "Nenhum chamado para corrigir",
        total: 0
      });
    }

    let corrigidos = 0;
    let erros = 0;

    for (const chamado of chamadosSemTipo.results as any[]) {
      try {
        let tipoProblemaDeduzido = null;

        // Para setor TI (id 1), deduzir tipo_problema baseado nas categorias
        if (chamado.setor_destino_id === 1) {
          // Tentar deduzir pelo item_id primeiro
          if (chamado.item_id) {
            const item = await c.env.DB.prepare(
              "SELECT tipo_problema FROM categorias WHERE id = ?"
            ).bind(chamado.item_id).first() as { tipo_problema: string | null } | null;
            
            if (item?.tipo_problema) {
              tipoProblemaDeduzido = item.tipo_problema;
            }
          }

          // Se não encontrou, tentar pela subcategoria_id
          if (!tipoProblemaDeduzido && chamado.subcategoria_id) {
            const subcategoria = await c.env.DB.prepare(
              "SELECT tipo_problema FROM categorias WHERE id = ?"
            ).bind(chamado.subcategoria_id).first() as { tipo_problema: string | null } | null;
            
            if (subcategoria?.tipo_problema) {
              tipoProblemaDeduzido = subcategoria.tipo_problema;
            }
          }

          // Se não encontrou, tentar pela categoria_id
          if (!tipoProblemaDeduzido && chamado.categoria_id) {
            const categoria = await c.env.DB.prepare(
              "SELECT tipo_problema FROM categorias WHERE id = ?"
            ).bind(chamado.categoria_id).first() as { tipo_problema: string | null } | null;
            
            if (categoria?.tipo_problema) {
              tipoProblemaDeduzido = categoria.tipo_problema;
            }
          }
        }

        // Para outros setores, definir tipo padrão baseado no setor
        if (!tipoProblemaDeduzido) {
          const setor = await c.env.DB.prepare(
            "SELECT nome FROM setores WHERE id = ?"
          ).bind(chamado.setor_destino_id).first() as { nome: string } | null;

          // Mapear setor para tipo de problema padrão
          const tiposPorSetor: Record<string, string> = {
            'Hotelaria': 'Hotelaria',
            'Rouparia': 'Rouparia',
            'Manutenção': 'Predial',
            'Marketing': 'Marketing',
            'Comercial': 'Comercial',
          };

          if (setor && tiposPorSetor[setor.nome]) {
            tipoProblemaDeduzido = tiposPorSetor[setor.nome];
          } else if (!tipoProblemaDeduzido) {
            // Valor padrão genérico
            tipoProblemaDeduzido = 'Outros';
          }
        }

        // Atualizar chamado
        if (tipoProblemaDeduzido) {
          await c.env.DB.prepare(
            "UPDATE chamados SET tipo_problema = ? WHERE id = ?"
          ).bind(tipoProblemaDeduzido, chamado.id).run();

          console.log(`[FIX] Chamado ${chamado.numero}: tipo_problema = "${tipoProblemaDeduzido}"`);
          corrigidos++;
        } else {
          console.log(`[FIX] Chamado ${chamado.numero}: não foi possível deduzir tipo_problema`);
          erros++;
        }
      } catch (error) {
        console.error(`[FIX] Erro ao processar chamado ${chamado.numero}:`, error);
        erros++;
      }
    }

    return c.json({
      message: `Correção concluída`,
      total: chamadosSemTipo.results.length,
      corrigidos,
      erros,
      detalhes: `${corrigidos} chamados foram corrigidos com sucesso${erros > 0 ? `, ${erros} erros` : ''}`
    });

  } catch (error) {
    console.error("[FIX TIPO PROBLEMA V2] Erro:", error);
    return c.json({ 
      error: "Erro ao executar correção",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Endpoint de diagnóstico
app.get("/diagnostico", async (c: any) => {
  try {
    // Remover verificação de autenticação para debug

    // Contar por tipo_problema
    const porTipo = await c.env.DB.prepare(`
      SELECT 
        COALESCE(tipo_problema, 'NULL/Vazio') as tipo,
        COUNT(*) as quantidade
      FROM chamados
      GROUP BY tipo_problema
      ORDER BY quantidade DESC
    `).all();

    // Total de chamados
    const total = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM chamados"
    ).first() as { total: number } | null;

    return c.json({
      total_chamados: total?.total || 0,
      distribuicao: porTipo.results,
    });

  } catch (error) {
    console.error("[DIAGNOSTICO] Erro:", error);
    return c.json({ error: "Erro ao gerar diagnóstico" }, 500);
  }
});

export default app;
