// Tipos compartilhados entre frontend e backend

export type PerfilUsuario = 'solicitante' | 'tecnico' | 'gestor' | 'admin';

export type TipoChamado = 'Incidente' | 'Requisição' | 'Problema' | 'Mudança';

export type StatusChamado = 
  | 'Novo' 
  | 'Em triagem' 
  | 'Em atendimento' 
  | 'Aguardando usuário' 
  | 'Aguardando fornecedor' 
  | 'Resolvido' 
  | 'Fechado' 
  | 'Cancelado';

export type Impacto = 'Baixo' | 'Médio' | 'Alto';
export type Urgencia = 'Baixa' | 'Média' | 'Alta';
export type Prioridade = 'P1' | 'P2' | 'P3' | 'P4';

export type TipoComentario = 'publico' | 'interno' | 'sistema';

export interface UserProfile {
  id: number;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  perfil: PerfilUsuario;
  unidade_id: number | null;
  setor: string | null;
  setor_id: number | null;
  setor_nome?: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  telegram_link_code: string | null;
  telegram_link_expires_at: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Unidade {
  id: number;
  nome: string;
  codigo: string | null;
  endereco: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Setor {
  id: number;
  nome: string;
  descricao: string | null;
  responsavel_id: string | null;
  email: string | null;
  ramal: string | null;
  ativo: boolean;
  atende_ticket: boolean;
  created_at: string;
  updated_at: string;
}

export interface FilaAtendimento {
  id: number;
  nome: string;
  descricao: string | null;
  setor_id: number;
  responsavel_id: string | null;
  responsavel_nome?: string;
  tipo: 'helpdesk' | 'tecnico';
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: number;
  nome: string;
  descricao: string | null;
  categoria_pai_id: number | null;
  tipo: 'categoria' | 'subcategoria' | 'item';
  setor_id: number | null;
  tipo_problema: string | null;
  prioridade_automatica?: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SLA {
  id: number;
  nome: string;
  prioridade: Prioridade;
  tipo_chamado: TipoChamado;
  tempo_resposta_minutos: number;
  tempo_solucao_minutos: number;
  horario_comercial: boolean;
  setor_id: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface GrupoAtendimento {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Chamado {
  id: number;
  numero: string;
  tipo: TipoChamado;
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email: string;
  solicitante_telefone: string | null;
  solicitante_setor: string | null;
  unidade_id: number | null;
  setor_destino_id: number | null;
  categoria_id: number | null;
  subcategoria_id: number | null;
  item_id: number | null;
  titulo: string;
  descricao: string;
  impacto: Impacto | null;
  urgencia: Urgencia | null;
  prioridade: Prioridade | null;
  status: StatusChamado;
  grupo_responsavel_id: number | null;
  tecnico_responsavel_id: string | null;
  tecnico_responsavel_nome?: string | null;
  ambiente: string | null;
  passos_reproduzir: string | null;
  sla_id: number | null;
  data_abertura: string;
  data_primeira_resposta: string | null;
  data_resolucao: string | null;
  data_fechamento: string | null;
  prazo_resposta: string | null;
  prazo_solucao: string | null;
  violacao_sla: boolean;
  solucao: string | null;
  avaliacao_nota: number | null;
  avaliacao_comentario: string | null;
  avaliacao_nps: number | null;
  avaliacao_resolveu: boolean | null;
  avaliacao_data: string | null;
  agendado: boolean;
  data_agendamento: string | null;
  observacoes_agendamento: string | null;
  telegram_chat_id: string | null;
  afeta_paciente: boolean;
  fila_id: number | null;
  sla_pausado_em: string | null;
  sla_pausado_motivo: string | null;
  tempo_pausado_minutos: number;
  tipo_problema: string | null;
  is_projeto: boolean;
  projeto_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Comentario {
  id: number;
  chamado_id: number;
  autor_id: string;
  autor_nome: string;
  tipo: TipoComentario;
  conteudo: string;
  is_evidencia: boolean;
  tag_evidencia: string | null;
  created_at: string;
  updated_at: string;
}

export interface Anexo {
  id: number;
  chamado_id: number;
  comentario_id: number | null;
  nome_arquivo: string;
  url: string;
  tipo_arquivo: string | null;
  tamanho: number | null;
  autor_id: string;
  created_at: string;
  updated_at: string;
}

export type TipoHistorico = 
  | 'acao_tecnica'          // Ações técnicas objetivas
  | 'mudanca_status'        // Mudanças de status
  | 'comunicacao'           // Comunicação com usuário/área
  | 'dependencia_terceiro'  // Dependência de fornecedores
  | 'decisao'               // Decisões e autorizações
  | 'reclassificacao'       // Reclassificação do chamado
  | 'evidencia'             // Evidências técnicas
  | 'encerramento';         // Encerramento técnico

export interface HistoricoDetalhes {
  // Para ações técnicas
  local?: string;
  equipamento?: string;
  procedimento?: string;
  
  // Para mudanças de status
  motivo?: string;
  justificativa?: string;
  
  // Para comunicação
  destinatario?: string;
  meio?: string;
  resumo?: string;
  
  // Para dependências de terceiros
  fornecedor?: string;
  protocolo?: string;
  data_contato?: string;
  data_previsao?: string;
  status_terceiro?: string;
  
  // Para decisões
  aprovador?: string;
  tipo_decisao?: string;
  impacto_decisao?: string;
  
  // Para evidências
  tipo_evidencia?: string;
  arquivo_url?: string;
  
  // Para encerramento
  causa_raiz?: string;
  solucao_aplicada?: string;
  resultado?: string;
  validado_por?: string;
  data_validacao?: string;
  
  // Para projetos
  projeto_id?: number;
  projeto_nome?: string;
}

export interface Historico {
  id: number;
  chamado_id: number;
  user_id: string;
  user_nome: string;
  tipo: TipoHistorico;
  acao: string;
  campo_alterado: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  detalhes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHistoricoDTO {
  tipo: TipoHistorico;
  acao: string;
  detalhes?: HistoricoDetalhes;
  campo_alterado?: string;
  valor_anterior?: string;
  valor_novo?: string;
}

export interface Notificacao {
  id: number;
  destinatario_id: string;
  chamado_id: number | null;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  via_email: boolean;
  email_enviado: boolean;
  created_at: string;
  updated_at: string;
}

export type TipoDocumento = 
  | 'Artigo'
  | 'Tutorial' 
  | 'Guia'
  | 'FAQ'
  | 'Procedimento'
  | 'Checklist'
  | 'Política'
  | 'Manual';

export interface ArtigoKB {
  id: number;
  titulo: string;
  conteudo: string;
  tipo_documento: TipoDocumento;
  categoria_id: number | null;
  setor_id: number | null;
  palavras_chave: string | null;
  autor_id: string;
  visualizacoes: number;
  util_sim: number;
  util_nao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogoServico {
  id: number;
  nome: string;
  descricao: string | null;
  categoria_id: number | null;
  sla_id: number | null;
  grupo_responsavel_id: number | null;
  campos_extras: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type StatusProjeto = 
  | 'Aguardando Aprovação'
  | 'Planejamento' 
  | 'Em andamento' 
  | 'Pausado' 
  | 'Concluído' 
  | 'Cancelado';

export interface Projeto {
  id: number;
  nome: string;
  descricao: string | null;
  escopo: string | null;
  status: StatusProjeto | null;
  sponsor: string | null;
  gerente_id: string | null;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  data_fim_real: string | null;
  orcamento: number | null;
  riscos: string | null;
  justificativa: string | null;
  analise_viabilidade: string | null;
  aprovador_id: string | null;
  data_aprovacao: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjetoAprovacao {
  id: number;
  projeto_id: number;
  aprovador_id: string;
  aprovador_nome: string;
  acao: 'Aprovado' | 'Rejeitado' | 'Em espera';
  comentario: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjetoTarefa {
  id: number;
  projeto_id: number;
  titulo: string;
  descricao: string | null;
  status: 'A fazer' | 'Fazendo' | 'Concluído' | null;
  responsavel_id: string | null;
  prioridade: string | null;
  prazo: string | null;
  duracao_minutos: number | null;
  concluido: boolean;
  data_inicio: string | null;
  data_fim: string | null;
  chamado_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Fornecedor {
  id: number;
  nome: string;
  cnpj: string | null;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  endereco: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contrato {
  id: number;
  fornecedor_id: number;
  setor_id: number | null;
  numero_contrato: string | null;
  descricao: string | null;
  tipo: string | null;
  valor: number | null;
  data_inicio: string;
  data_fim: string;
  data_reajuste: string | null;
  percentual_reajuste: number | null;
  sla_contratado: string | null;
  renovacao_automatica: boolean;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ativo {
  id: number;
  codigo_barras?: string | null;
  descricao?: string | null;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  patrimonio: string | null;
  status: 'Disponível' | 'Em uso' | 'Manutenção' | 'Descartado' | 'Com defeito' | 'Em manutenção' | 'Descartado/Baixado' | 'Aguardando retirada' | 'Devolvido' | null;
  data_aquisicao: string | null;
  data_garantia: string | null;
  valor: number | null;
  localizacao: string | null;
  unidade_id: number | null;
  setor_id: number | null;
  usuario_alocado_id: string | null;
  responsavel_nome?: string | null;
  fornecedor_id: number | null;
  fornecedor_nome?: string | null;
  observacoes: string | null;
  tipo_propriedade?: 'Alugado' | 'Patrimônio' | null;
  data_solicitacao?: string | null;
  data_retirada?: string | null;
  data_defeito?: string | null;
  data_manutencao?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemEstoque {
  id: number;
  nome: string;
  descricao: string | null;
  codigo: string | null;
  quantidade_atual: number;
  quantidade_minima: number;
  unidade_medida: string;
  valor_unitario: number | null;
  setor_id: number | null;
  localizacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChamadoMaterial {
  id: number;
  chamado_id: number;
  estoque_id: number;
  quantidade: number;
  valor_unitario: number | null;
  observacao: string | null;
  responsavel_id: string;
  responsavel_nome: string;
  created_at: string;
  updated_at: string;
}

export interface EstoqueMovimentacao {
  id: number;
  estoque_id: number;
  tipo: 'Entrada' | 'Saída' | 'Ajuste' | 'Transferência';
  quantidade: number;
  quantidade_anterior: number | null;
  quantidade_nova: number | null;
  chamado_id: number | null;
  motivo: string | null;
  responsavel_id: string;
  responsavel_nome: string;
  created_at: string;
  updated_at: string;
}

export interface MovimentacaoEstoque {
  id: number;
  ativo_id: number;
  tipo: 'Entrada' | 'Saída' | 'Transferência' | 'Baixa';
  quantidade: number;
  origem: string | null;
  destino: string | null;
  responsavel_id: string;
  motivo: string | null;
  data_movimentacao: string;
  created_at: string;
  updated_at: string;
}

// DTOs para criação e atualização
export interface CreateChamadoDTO {
  tipo: TipoChamado;
  titulo: string;
  descricao: string;
  categoria_id?: number;
  subcategoria_id?: number;
  item_id?: number;
  impacto?: Impacto;
  urgencia?: Urgencia;
  ambiente?: string;
  passos_reproduzir?: string;
  unidade_id?: number;
  setor_destino_id?: number;
  setor_solicitante?: string;
  afeta_paciente?: boolean;
  tipo_problema?: string;
  is_projeto?: boolean;
  projeto_id?: number;
}

export interface UpdateChamadoDTO {
  status?: StatusChamado;
  grupo_responsavel_id?: number;
  tecnico_responsavel_id?: string;
  solucao?: string;
  agendado?: boolean;
  data_agendamento?: string;
  observacoes_agendamento?: string;
  sla_pausado_motivo?: string;
  tipo?: TipoChamado;
  tipo_problema?: string;
  categoria_id?: number | null;
  subcategoria_id?: number | null;
  item_id?: number | null;
  impacto?: Impacto;
  urgencia?: Urgencia;
}

export interface CreateComentarioDTO {
  conteudo: string;
  tipo: TipoComentario;
  is_evidencia?: boolean;
  tag_evidencia?: string;
}

export interface AvaliacaoChamadoDTO {
  nota: number;
  comentario?: string;
  nps?: number;
  resolveu: boolean;
}

export interface ChamadoRecorrente {
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

export interface DashboardStats {
  total_chamados: number;
  chamados_abertos: number;
  chamados_novos: number;
  chamados_em_triagem: number;
  chamados_atribuidos: number;
  chamados_em_atendimento: number;
  chamados_pausados: number;
  chamados_agendados: number;
  chamados_aguardando: number;
  chamados_resolvidos_mes: number;
  satisfacao_media: number | null;
  satisfacao_total_avaliacoes: number;
  nps_medio: number | null;
  nps_total_avaliacoes: number;
  tempo_medio_resolucao: number | null;
  violacoes_sla: number;
  sla_resposta_percentual: number | null;
  sla_resposta_dentro: number;
  sla_resposta_total: number;
  sla_resolucao_percentual: number | null;
  sla_resolucao_dentro: number;
  sla_resolucao_total: number;
  chamados_por_prioridade: {
    P1: number;
    P2: number;
    P3: number;
    P4: number;
  };
  chamados_por_status: Record<StatusChamado, number>;
  chamados_por_mes: Array<{
    mes: string;
    total: number;
    novos: number;
    resolvidos: number;
  }>;
  chamados_por_tipo_problema: Array<{
    tipo_problema: string;
    total: number;
  }>;
  chamados_por_categoria: Array<{
    categoria: string;
    total: number;
  }>;
  chamados_por_subcategoria: Array<{
    subcategoria: string;
    categoria: string;
    total: number;
  }>;
  chamados_por_setor_solicitante: Array<{
    setor_solicitante: string;
    total: number;
  }>;
}
