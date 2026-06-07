import { adicionarPontos, REGRAS_PONTUACAO } from "./gamificacao";

interface Treinamento {
  id?: number;
  user_id: string;
  tipo: string;
  status: string;
  validado: boolean;
}

interface Aplicacao {
  id?: number;
  treinamento_id: number;
  user_id: string;
  tipo_aplicacao: string;
  aprovado: boolean;
}

// Função para calcular pontos ao validar treinamento
export async function calcularPontosTreinamento(
  db: D1Database,
  treinamento: Treinamento
): Promise<void> {
  // Só dar pontos se estiver concluído E validado pelo gestor
  if (!treinamento.user_id || treinamento.status !== 'Concluído' || !treinamento.validado) return;

  // Apenas treinamentos pagos ganham pontos na conclusão
  if (treinamento.tipo === 'Curso pago') {
    await adicionarPontos(
      db,
      treinamento.user_id,
      REGRAS_PONTUACAO.treinamento_concluido.tipo,
      REGRAS_PONTUACAO.treinamento_concluido.pontos,
      REGRAS_PONTUACAO.treinamento_concluido.descricao,
      undefined,
      undefined,
      treinamento.id
    );
  }
}

// Função para calcular pontos ao aprovar aplicação
export async function calcularPontosAplicacao(
  db: D1Database,
  aplicacao: Aplicacao
): Promise<void> {
  if (!aplicacao.user_id || !aplicacao.aprovado) return;

  let regra;
  switch (aplicacao.tipo_aplicacao) {
    case 'Aplicar no trabalho':
      regra = REGRAS_PONTUACAO.aplicar_trabalho;
      break;
    case 'Resolver problema real':
      regra = REGRAS_PONTUACAO.resolver_problema;
      break;
    case 'Criar melhoria/processo':
      regra = REGRAS_PONTUACAO.criar_melhoria;
      break;
    case 'Compartilhar com equipe':
      regra = REGRAS_PONTUACAO.compartilhar_equipe;
      break;
    case 'Documentar aprendizado':
      regra = REGRAS_PONTUACAO.documentar_aprendizado;
      break;
    default:
      return;
  }

  await adicionarPontos(
    db,
    aplicacao.user_id,
    regra.tipo,
    regra.pontos,
    regra.descricao,
    undefined,
    undefined,
    aplicacao.treinamento_id,
    aplicacao.id
  );
}
