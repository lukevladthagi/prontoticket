import { adicionarPontos, REGRAS_PONTUACAO } from "./gamificacao";
import type { Projeto } from "../../shared/types";

// Função para calcular pontos ao concluir um projeto
export async function calcularPontosProjeto(
  db: D1Database,
  projeto: Projeto
): Promise<void> {
  if (!projeto.gerente_id) return;

  const pontosGanhos: { tipo: string; pontos: number; descricao: string }[] = [];

  // 1. Projeto entregue (sempre quando status = Concluído)
  if (projeto.status === 'Concluído') {
    pontosGanhos.push(REGRAS_PONTUACAO.projeto_entregue);
  }

  // 2. Entrega dentro do prazo
  if (projeto.data_fim_prevista && projeto.data_fim_real) {
    const prazo = new Date(projeto.data_fim_prevista).getTime();
    const entrega = new Date(projeto.data_fim_real).getTime();
    if (entrega <= prazo) {
      pontosGanhos.push(REGRAS_PONTUACAO.projeto_no_prazo);
    }
  }

  // 3. Projeto com impacto assistencial (verificar keywords no escopo/justificativa)
  const textoCompleto = `${projeto.escopo || ''} ${projeto.justificativa || ''}`.toLowerCase();
  const keywordsAssistenciais = ['assistencial', 'paciente', 'atendimento', 'clínico', 'médico', 'enfermagem', 'tratamento', 'diagnóstico'];
  const temImpacto = keywordsAssistenciais.some(keyword => textoCompleto.includes(keyword));
  if (temImpacto) {
    pontosGanhos.push(REGRAS_PONTUACAO.projeto_impacto);
  }

  // 4. Documentação completa (verificar se tem análise de viabilidade preenchida)
  if (projeto.analise_viabilidade && projeto.analise_viabilidade.length > 50) {
    pontosGanhos.push(REGRAS_PONTUACAO.projeto_documentacao);
  }

  // 5. Verificar se tem registro de treinamento (comentário ou tarefa com "treinamento")
  const tarefasTreinamento = await db.prepare(
    `SELECT COUNT(*) as total FROM projeto_tarefas 
     WHERE projeto_id = ? AND (
       LOWER(titulo) LIKE '%treinamento%' OR 
       LOWER(descricao) LIKE '%treinamento%' OR
       LOWER(titulo) LIKE '%capacitação%' OR
       LOWER(descricao) LIKE '%capacitação%'
     ) AND concluido = TRUE`
  ).bind(projeto.id).first<{ total: number }>();

  if (tarefasTreinamento && tarefasTreinamento.total > 0) {
    pontosGanhos.push(REGRAS_PONTUACAO.projeto_treinamento);
  }

  // 6. Redução de risco (verificar se riscos foram documentados e mitigados)
  if (projeto.riscos && projeto.riscos.length > 50) {
    const riscoTexto = projeto.riscos.toLowerCase();
    const keywordsMitigacao = ['mitigado', 'reduzido', 'eliminado', 'controlado', 'minimizado'];
    const temMitigacao = keywordsMitigacao.some(keyword => riscoTexto.includes(keyword));
    if (temMitigacao) {
      pontosGanhos.push(REGRAS_PONTUACAO.projeto_reduzir_risco);
    }
  }

  // Adicionar todos os pontos
  for (const regra of pontosGanhos) {
    await adicionarPontos(
      db,
      projeto.gerente_id,
      regra.tipo,
      regra.pontos,
      regra.descricao,
      undefined,
      projeto.id!
    );
  }
}
