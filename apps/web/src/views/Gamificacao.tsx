"use client";

import { useState, useEffect } from "react";
import { Trophy, Star, TrendingUp, Award, Calendar, Medal, Users } from "lucide-react";
import { useUserProfile } from "../hooks/useUserProfile";
import { Badge } from "@/components/ui/badge";
import Layout from "@/components/Layout";

interface RankingUsuario {
  user_id: string;
  user_nome: string;
  total_pontos: number;
  mes_atual: number;
  nivel: number;
}

interface HistoricoPonto {
  id: number;
  tipo_acao: string;
  pontos: number;
  descricao: string;
  chamado_numero?: string;
  chamado_titulo?: string;
  projeto_nome?: string;
  created_at: string;
}

interface BadgeItem {
  id: number;
  nome: string;
  descricao: string;
  icone: string;
  criterio: string;
}

interface UserBadge extends BadgeItem {
  data_conquista: string;
}

interface BadgeConquista {
  id: number;
  nome: string;
  descricao: string;
  icone: string;
  conquistadores: {
    user_id: string;
    user_nome: string;
    data_conquista: string;
    total_pontos?: number;
    pontos_mes?: number;
  }[];
}

interface TecnicoBadges {
  user_id: string;
  user_nome: string;
  total_pontos: number;
  mes_atual: number;
  pontos_periodo?: number;
  nivel: number;
  badges: {
    id: number;
    nome: string;
    descricao: string;
    icone: string;
    data_conquista: string;
  }[];
}

interface DetalhamentoChamado {
  id: number;
  numero: string;
  titulo: string;
  prioridade: string;
  status: string;
  data_resolucao: string;
  categoria_nome: string;
  pontos_ganhos: number;
  composicao: {
    pontos_base: number;
    multiplicador_categoria: number;
    tipo_categoria: string;
    bonus_sla: number;
    dentro_sla: boolean;
    is_auto_atendimento: boolean;
    multiplicador_auto: number;
    pontos_antes_auto: number;
    pontos_final: number;
  };
}

interface DetalhamentoAvaliacao {
  id: number;
  numero: string;
  titulo: string;
  avaliacao_nota: number;
  avaliacao_data: string;
  avaliacao_comentario: string;
  pontos_ganhos: number;
  solicitante_nome: string;
}

interface DetalhamentoTecnico {
  tecnico: {
    user_id: string;
    user_nome: string;
    total_pontos: number;
    mes_atual: number;
    nivel: number;
  };
  chamados: DetalhamentoChamado[];
  avaliacoes: DetalhamentoAvaliacao[];
  estatisticas: {
    total_chamados: number;
    total_avaliacoes: number;
    pontos_resolucao: number;
    pontos_avaliacoes: number;
    pontos_total: number;
  };
}

export default function Gamificacao() {
  const { profile } = useUserProfile();
  const [periodo, setPeriodo] = useState<'total' | 'mes' | 'personalizado'>('mes');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState<string>('');
  const [rankingHistorico, setRankingHistorico] = useState<any[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'ranking' | 'conquistas'>('ranking');
  const [conquistasMes, setConquistasMes] = useState<BadgeConquista[]>([]);
  const [tecnicosBadges, setTecnicosBadges] = useState<TecnicoBadges[]>([]);
  const [visualizacaoConquistas, setVisualizacaoConquistas] = useState<'badges' | 'tecnicos'>('badges');
  const [mesSelecionadoConquistas, setMesSelecionadoConquistas] = useState<string>('');
  const [periodoTecnicos, setPeriodoTecnicos] = useState<'total' | 'mes' | 'personalizado'>('mes');
  const [dataInicioTecnicos, setDataInicioTecnicos] = useState<string>('');
  const [dataFimTecnicos, setDataFimTecnicos] = useState<string>('');
  const [processandoRecalculo, setProcessandoRecalculo] = useState(false);
  const [tecnicoDetalhado, setTecnicoDetalhado] = useState<DetalhamentoTecnico | null>(null);
  const [modalDetalhamentoAberto, setModalDetalhamentoAberto] = useState(false);
  const [carregandoDetalhamento, setCarregandoDetalhamento] = useState(false);
  const [abaDetalhamento, setAbaDetalhamento] = useState<'tickets' | 'avaliacoes'>('tickets');
  const [mostrarRegras, setMostrarRegras] = useState(false);
  
  // Verificar se usuário é do setor TI (id = 1)
  if (profile && profile.setor_id !== 1) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-8 text-center">
            <Trophy className="mx-auto mb-4 text-yellow-600 dark:text-yellow-500" size={48} />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Gamificação disponível apenas para TI
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              O sistema de gamificação está disponível exclusivamente para membros do setor de Tecnologia da Informação.
            </p>
          </div>
        </div>
      </Layout>
    );
  }
  const [ranking, setRanking] = useState<RankingUsuario[]>([]);
  const [meusPontos, setMeusPontos] = useState<RankingUsuario | null>(null);
  const [historico, setHistorico] = useState<HistoricoPonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [meusBadges, setMeusBadges] = useState<UserBadge[]>([]);
  const [processandoRetroativo, setProcessandoRetroativo] = useState(false);
  const [processandoReset, setProcessandoReset] = useState(false);

  useEffect(() => {
    carregarDados();
    carregarMesesDisponiveis();
  }, [periodo, profile, dataInicio, dataFim]);

  useEffect(() => {
    if (mesSelecionado) {
      carregarRankingHistorico(mesSelecionado);
    }
  }, [mesSelecionado]);

  useEffect(() => {
    if (abaAtiva === 'conquistas') {
      carregarConquistasMes(mesSelecionadoConquistas);
      if (visualizacaoConquistas === 'tecnicos' && (profile?.perfil === 'admin' || profile?.perfil === 'gestor')) {
        carregarTecnicosBadges();
      }
    }
  }, [mesSelecionadoConquistas, abaAtiva, visualizacaoConquistas, periodoTecnicos, dataInicioTecnicos, dataFimTecnicos]);

  const carregarConquistasMes = async (mesAno: string) => {
    try {
      const url = mesAno 
        ? `/api/badges/conquistas-mes?mes_ano=${mesAno}`
        : '/api/badges/conquistas-mes';
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setConquistasMes(data);
      }
    } catch (error) {
      console.error('Erro ao carregar conquistas do mês:', error);
    }
  };

  const carregarTecnicosBadges = async () => {
    try {
      let url = '/api/badges/todos-tecnicos';
      
      // Calcular datas baseado no período
      if (periodoTecnicos === 'mes') {
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const inicio = primeiroDiaMes.toISOString().split('T')[0];
        const fim = hoje.toISOString().split('T')[0];
        url += `?data_inicio=${inicio}&data_fim=${fim}`;
      } else if (periodoTecnicos === 'personalizado' && dataInicioTecnicos && dataFimTecnicos) {
        url += `?data_inicio=${dataInicioTecnicos}&data_fim=${dataFimTecnicos}`;
      }
      // Se for 'total', não adiciona filtro de data
      
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTecnicosBadges(data);
      }
    } catch (error) {
      console.error('Erro ao carregar técnicos com badges:', error);
    }
  };

  const carregarMesesDisponiveis = async () => {
    try {
      const res = await fetch('/api/gamificacao/historico-mensal/meses');
      if (res.ok) {
        const meses = await res.json();
        setMesesDisponiveis(meses);
      }
    } catch (error) {
      console.error('Erro ao carregar meses disponíveis:', error);
    }
  };

  const carregarRankingHistorico = async (mesAno: string) => {
    try {
      const res = await fetch(`/api/gamificacao/historico-mensal/${mesAno}?limite=10`);
      if (res.ok) {
        const data = await res.json();
        setRankingHistorico(data);
      }
    } catch (error) {
      console.error('Erro ao carregar ranking histórico:', error);
    }
  };

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Construir URL com filtros de data
      let rankingUrl = `/api/gamificacao/ranking?periodo=${periodo}&limite=10`;
      if (periodo === 'personalizado' && dataInicio && dataFim) {
        rankingUrl = `/api/gamificacao/ranking?data_inicio=${dataInicio}&data_fim=${dataFim}&limite=10`;
      }

      // Carregar ranking
      const rankingRes = await fetch(rankingUrl);
      const rankingData = await rankingRes.json();
      setRanking(rankingData);

      // Carregar meus pontos
      if (profile?.user_id) {
        const pontosRes = await fetch(`/api/gamificacao/usuario/${profile.user_id}`);
        const pontosData = await pontosRes.json();
        setMeusPontos(pontosData);

        // Carregar histórico
        const historicoRes = await fetch(`/api/gamificacao/usuario/${profile.user_id}/historico?limit=10`);
        const historicoData = await historicoRes.json();
        setHistorico(historicoData);
      }

      // Carregar badges
      const [badgesRes, meusBadgesRes] = await Promise.all([
        fetch('/api/badges'),
        fetch('/api/badges/meus')
      ]);
      
      if (badgesRes.ok) {
        const badgesData = await badgesRes.json();
        setBadges(badgesData);
      }
      
      if (meusBadgesRes.ok) {
        const meusBadgesData = await meusBadgesRes.json();
        setMeusBadges(meusBadgesData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de gamificação:', error);
    } finally {
      setLoading(false);
    }
  };

  const processarRetroativo = async () => {
    if (!confirm('Processar pontos retroativos para todos os tickets resolvidos sem pontos?')) {
      return;
    }

    try {
      setProcessandoRetroativo(true);
      const res = await fetch('/api/gamificacao/processar-retroativo', {
        method: 'POST'
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detalhes || errorData.error || 'Erro ao processar');
      }

      const data = await res.json();
      
      let mensagem = 
        `Processamento concluído!\n\n` +
        `Total de tickets: ${data.total_tickets}\n` +
        `Tickets com pontos: ${data.tickets_com_pontos}\n` +
        `Tickets processados: ${data.tickets_processados}`;
      
      if (data.erros && data.erros.length > 0) {
        mensagem += `\n\nErros encontrados:\n${data.erros.join('\n')}`;
      }
      
      alert(mensagem);

      // Recarregar dados
      carregarDados();
    } catch (error) {
      console.error('Erro ao processar retroativo:', error);
      alert(`Erro ao processar pontos retroativos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setProcessandoRetroativo(false);
    }
  };

  const resetarPontosMensais = async () => {
    const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (!confirm(`Tem certeza que deseja resetar os pontos mensais?\n\nEsta ação irá:\n- Salvar o histórico de ${mesAtual}\n- Zerar os pontos mensais de todos os técnicos\n- Manter os pontos totais intactos\n\nEsta operação não pode ser desfeita.`)) {
      return;
    }

    try {
      setProcessandoReset(true);
      const res = await fetch('/api/gamificacao/resetar-mensal', {
        method: 'POST'
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detalhes || errorData.error || 'Erro ao resetar');
      }

      const data = await res.json();
      alert(`Reset concluído com sucesso!\n\n${data.mensagem}`);

      // Recarregar dados
      carregarDados();
      carregarMesesDisponiveis();
    } catch (error) {
      console.error('Erro ao resetar pontos mensais:', error);
      alert(`Erro ao resetar pontos mensais: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setProcessandoReset(false);
    }
  };

  const recalcularCompleto = async () => {
    if (!confirm(`ATENÇÃO: Esta operação vai recalcular TODOS os pontos do zero!\n\nIsto irá:\n- Apagar todos os pontos atuais e ranking\n- Preservar o histórico mensal existente\n- Recalcular aplicando as regras atuais de pontuação justa\n- Reconstruir o ranking do zero\n\nEsta operação pode demorar alguns minutos e NÃO PODE SER DESFEITA.\n\nTem certeza que deseja continuar?`)) {
      return;
    }

    try {
      setProcessandoRecalculo(true);
      const res = await fetch('/api/gamificacao/recalcular-completo', {
        method: 'POST'
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detalhes || errorData.error || 'Erro ao recalcular');
      }

      const data = await res.json();
      
      let mensagem = 
        `Recálculo completo concluído!\n\n` +
        `Total de chamados: ${data.total_chamados}\n` +
        `Chamados processados: ${data.chamados_processados}\n` +
        `Meses no histórico: ${data.meses_historico}\n` +
        `Técnicos atualizados: ${data.tecnicos_atualizados}`;
      
      if (data.erros && data.erros.length > 0) {
        mensagem += `\n\nErros encontrados:\n${data.erros.slice(0, 5).join('\n')}`;
        if (data.erros.length > 5) {
          mensagem += `\n... e mais ${data.erros.length - 5} erros`;
        }
      }
      
      alert(mensagem);

      // Recarregar dados
      carregarDados();
      carregarMesesDisponiveis();
    } catch (error) {
      console.error('Erro ao recalcular completo:', error);
      alert(`Erro ao recalcular pontos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setProcessandoRecalculo(false);
    }
  };

  const obterPosicao = () => {
    if (!meusPontos || !profile) return null;
    const posicao = ranking.findIndex(u => u.user_id === profile.user_id);
    return posicao >= 0 ? posicao + 1 : null;
  };

  const obterMedalha = (posicao: number) => {
    if (posicao === 1) return { icon: Trophy, color: 'text-yellow-500', label: '🥇' };
    if (posicao === 2) return { icon: Medal, color: 'text-gray-400', label: '🥈' };
    if (posicao === 3) return { icon: Medal, color: 'text-amber-600', label: '🥉' };
    return null;
  };

  const abrirDetalhamento = async (userId: string) => {
    try {
      console.log('[FRONTEND] Iniciando abrirDetalhamento para userId:', userId);
      setCarregandoDetalhamento(true);
      
      const url = `/api/gamificacao/usuario/${userId}/detalhamento`;
      console.log('[FRONTEND] Fazendo fetch para:', url);
      
      const res = await fetch(url);
      console.log('[FRONTEND] Response status:', res.status);
      console.log('[FRONTEND] Response ok:', res.ok);
      
      if (res.ok) {
        console.log('[FRONTEND] Parseando JSON...');
        const data = await res.json();
        console.log('[FRONTEND] Dados recebidos:', data);
        console.log('[FRONTEND] Técnico:', data.tecnico);
        console.log('[FRONTEND] Chamados length:', data.chamados?.length);
        console.log('[FRONTEND] Avaliações length:', data.avaliacoes?.length);
        
        setTecnicoDetalhado(data);
        setAbaDetalhamento('tickets');
        setModalDetalhamentoAberto(true);
      } else {
        console.log('[FRONTEND] Response não OK, lendo texto...');
        const errorText = await res.text();
        console.error('[FRONTEND] Error response text:', errorText);
        throw new Error(`Erro ao carregar dados: ${res.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('[FRONTEND] ERRO CAPTURADO em abrirDetalhamento:', error);
      console.error('[FRONTEND] Error tipo:', typeof error);
      console.error('[FRONTEND] Error name:', error instanceof Error ? error.name : 'N/A');
      console.error('[FRONTEND] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[FRONTEND] Error stack:', error instanceof Error ? error.stack : 'N/A');
      alert(`Erro ao carregar detalhamento do técnico: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCarregandoDetalhamento(false);
    }
  };

  const fecharDetalhamento = () => {
    setModalDetalhamentoAberto(false);
    setTecnicoDetalhado(null);
    setAbaDetalhamento('tickets');
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const posicao = obterPosicao();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
              <Trophy className="text-yellow-500" size={36} />
              Sistema de Gamificação
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Acompanhe seu desempenho e compete com a equipe</p>
          </div>
          {profile && ['gestor', 'admin'].includes(profile.perfil) && (
            <div className="flex gap-3">
              <button
                onClick={() => setMostrarRegras(!mostrarRegras)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {mostrarRegras ? 'Ocultar Regras' : 'Como Funciona'}
              </button>
              <button
                onClick={processarRetroativo}
                disabled={processandoRetroativo || processandoReset || processandoRecalculo}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processandoRetroativo ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processando...
                  </>
                ) : (
                  'Processar Pontos Retroativos'
                )}
              </button>
              <button
                onClick={recalcularCompleto}
                disabled={processandoRetroativo || processandoReset || processandoRecalculo}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processandoRecalculo ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Recalculando...
                  </>
                ) : (
                  <>
                    <TrendingUp size={18} />
                    Recalcular Tudo
                  </>
                )}
              </button>
              <button
                onClick={resetarPontosMensais}
                disabled={processandoRetroativo || processandoReset || processandoRecalculo}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processandoReset ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Resetando...
                  </>
                ) : (
                  <>
                    <Calendar size={18} />
                    Resetar Mês
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        </div>

        {/* Painel de Regras de Pontuação */}
        {mostrarRegras && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Como Funciona a Pontuação
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pontos por Resolução */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pontos por Resolução de Tickets
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">1. Pontos Base por Prioridade:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="text-sm text-gray-700 dark:text-gray-300">• <span className="font-semibold text-red-600 dark:text-red-400">P1 (Crítico)</span>: 20 pontos</li>
                      <li className="text-sm text-gray-700 dark:text-gray-300">• <span className="font-semibold text-orange-600 dark:text-orange-400">P2 (Alto)</span>: 15 pontos</li>
                      <li className="text-sm text-gray-700 dark:text-gray-300">• <span className="font-semibold text-yellow-600 dark:text-yellow-400">P3 (Médio)</span>: 10 pontos</li>
                      <li className="text-sm text-gray-700 dark:text-gray-300">• <span className="font-semibold text-green-600 dark:text-green-400">P4 (Baixo)</span>: 5 pontos</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">2. Multiplicador de Complexidade:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="text-sm text-gray-700 dark:text-gray-300">• <span className="font-semibold text-purple-600 dark:text-purple-400">Alta</span> (BI, Infra, Servidor): <strong>×3.0</strong></li>
                      <li className="text-sm text-gray-700 dark:text-gray-300">• <span className="font-semibold text-blue-600 dark:text-blue-400">Média</span> (Hardware, Software): <strong>×2.0</strong></li>
                      <li className="text-sm text-gray-700 dark:text-gray-300">• <span className="font-semibold text-gray-600 dark:text-gray-400">Baixa</span> (Outros): <strong>×1.0</strong></li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">3. Bônus:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="text-sm text-gray-700 dark:text-gray-300">• Resolver dentro do SLA: <strong className="text-green-600 dark:text-green-400">+5 pts</strong></li>
                      <li className="text-sm text-gray-700 dark:text-gray-300">• Ticket próprio: <strong className="text-amber-600 dark:text-amber-400">×0.5</strong></li>
                    </ul>
                  </div>

                  <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
                    <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">📊 Exemplos:</p>
                    <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                      <li>• <strong>P1 Infra (SLA OK)</strong>: 20×3.0+5 = <span className="text-indigo-600 dark:text-indigo-400 font-bold">65 pts</span></li>
                      <li>• <strong>P2 Hardware</strong>: 15×2.0+5 = <span className="text-indigo-600 dark:text-indigo-400 font-bold">35 pts</span></li>
                      <li>• <strong>P3 próprio</strong>: (10×1.0)×0.5 = <span className="text-indigo-600 dark:text-indigo-400 font-bold">5 pts</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Pontos por Avaliação */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <h3 className="text-lg font-bold text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Avaliações do Cliente
                </h3>

                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">Pontos por Estrelas:</p>
                    <ul className="space-y-2 ml-4">
                      <li className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <span className="text-yellow-500">⭐⭐⭐⭐⭐</span>
                        <strong className="text-green-600 dark:text-green-400">+10 pts</strong>
                      </li>
                      <li className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <span className="text-yellow-500">⭐⭐⭐⭐</span>
                        <strong className="text-blue-600 dark:text-blue-400 ml-3">+5 pts</strong>
                      </li>
                      <li className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <span className="text-yellow-500">⭐⭐⭐</span>
                        <strong className="text-amber-600 dark:text-amber-400 ml-5">+2 pts</strong>
                      </li>
                      <li className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <span className="text-gray-400">⭐⭐ / ⭐</span>
                        <strong className="text-red-600 dark:text-red-400">0 pts</strong>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                    <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-1">⚠️ Importante:</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      Auto-avaliações <strong>não contam</strong> para pontos nem NPS.
                    </p>
                  </div>

                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-sm font-semibold text-green-900 dark:text-green-300 mb-2">💡 Dica:</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      Qualidade {'>'} Quantidade! Uma avaliação 5★ vale 2x mais que resolver um P3 simples.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border-2 border-blue-300 dark:border-blue-600">
              <p className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-2">
                ⚖️ Sistema Justo e Equilibrado
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                3 tickets P1 de infraestrutura (195 pts) superam 15 tickets P4 simples (75 pts). 
                Competição justa baseada em <strong>valor entregue</strong>, não volume.
              </p>
            </div>
          </div>
        )}

        {/* Tabs de Navegação */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-2 flex gap-2">
          <button
            onClick={() => setAbaAtiva('ranking')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
              abaAtiva === 'ranking'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            <Trophy className="inline mr-2" size={20} />
            Ranking e Pontos
          </button>
          <button
            onClick={() => setAbaAtiva('conquistas')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
              abaAtiva === 'conquistas'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            <Medal className="inline mr-2" size={20} />
            Conquistas do Mês
          </button>
        </div>

        {/* Conteúdo da Aba Ranking */}
        {abaAtiva === 'ranking' && (
        <>
        {/* Meus Pontos */}
      {meusPontos && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Star size={24} />
              <span className="text-sm opacity-90">Nível</span>
            </div>
            <div className="text-4xl font-bold">{meusPontos.nivel}</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Trophy size={24} />
              <span className="text-sm opacity-90">Pontos Totais</span>
            </div>
            <div className="text-4xl font-bold">{meusPontos.total_pontos}</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Calendar size={24} />
              <span className="text-sm opacity-90">Mês Atual</span>
            </div>
            <div className="text-4xl font-bold">{meusPontos.mes_atual}</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Award size={24} />
              <span className="text-sm opacity-90">Posição</span>
            </div>
            <div className="text-4xl font-bold">{posicao ? `#${posicao}` : '-'}</div>
          </div>
        </div>
      )}

      {/* Filtro de Período */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => {
              const hoje = new Date().toISOString().split('T')[0];
              setPeriodo('personalizado');
              setDataInicio(hoje);
              setDataFim(hoje);
              setMesSelecionado('');
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              periodo === 'personalizado' && dataInicio === dataFim && dataInicio === new Date().toISOString().split('T')[0]
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => {
              const hoje = new Date();
              const inicioSemana = new Date(hoje);
              inicioSemana.setDate(hoje.getDate() - hoje.getDay());
              setPeriodo('personalizado');
              setDataInicio(inicioSemana.toISOString().split('T')[0]);
              setDataFim(hoje.toISOString().split('T')[0]);
              setMesSelecionado('');
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              periodo === 'personalizado' && dataInicio !== dataFim && dataInicio !== new Date().toISOString().split('T')[0]
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Esta Semana
          </button>
          <button
            onClick={() => {
              setPeriodo('mes');
              setDataInicio('');
              setDataFim('');
              setMesSelecionado('');
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              periodo === 'mes' && !mesSelecionado
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Mês Atual
          </button>
          <button
            onClick={() => {
              setPeriodo('total');
              setDataInicio('');
              setDataFim('');
              setMesSelecionado('');
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              periodo === 'total' && !mesSelecionado
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Total Geral
          </button>

          {mesesDisponiveis.length > 0 && (
            <>
              <span className="text-gray-500 dark:text-gray-400 mx-2">|</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Mês anterior:</span>
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione um mês</option>
                {mesesDisponiveis.map((mes) => (
                  <option key={mes} value={mes}>
                    {new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Período Personalizado */}
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-400">Período personalizado:</span>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => {
              setDataInicio(e.target.value);
              if (e.target.value && dataFim) {
                setPeriodo('personalizado');
                setMesSelecionado('');
              }
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-gray-500 dark:text-gray-400">até</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => {
              setDataFim(e.target.value);
              if (dataInicio && e.target.value) {
                setPeriodo('personalizado');
                setMesSelecionado('');
              }
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
          {periodo === 'personalizado' && dataInicio && dataFim && (
            <button
              onClick={() => {
                setPeriodo('mes');
                setDataInicio('');
                setDataFim('');
              }}
              className="px-3 py-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ranking */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="text-indigo-600 dark:text-indigo-400" size={24} />
            {mesSelecionado 
              ? `Ranking - ${new Date(mesSelecionado + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
              : periodo === 'personalizado' && dataInicio && dataFim
                ? `Ranking - ${new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`
                : 'Ranking Top 10'}
          </h2>

          <div className="space-y-3">
            {(mesSelecionado ? rankingHistorico : ranking).map((usuario, index) => {
              const medalha = obterMedalha(index + 1);
              const pontosExibir = mesSelecionado 
                ? usuario.pontos 
                : periodo === 'personalizado'
                  ? usuario.mes_atual
                  : (periodo === 'mes' ? usuario.mes_atual : usuario.total_pontos);

              return (
                <div
                  key={usuario.user_id}
                  onClick={() => abrirDetalhamento(usuario.user_id)}
                  title="Clique para ver o detalhamento completo dos pontos"
                  className={`flex items-center gap-4 p-4 rounded-lg transition-all cursor-pointer group ${
                    usuario.user_id === profile?.user_id
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-300 dark:border-indigo-600 hover:shadow-lg'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 hover:shadow-md'
                  }`}
                >
                  <div className="flex-shrink-0 w-12 text-center">
                    {medalha ? (
                      <span className="text-3xl">{medalha.label}</span>
                    ) : (
                      <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">#{index + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{usuario.user_nome}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Nível {usuario.nivel}</p>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{pontosExibir}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">pontos</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}

            {(mesSelecionado ? rankingHistorico : ranking).length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Nenhum ponto registrado ainda
              </div>
            )}
          </div>
        </div>

        {/* Histórico */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Star className="text-indigo-600 dark:text-indigo-400" size={24} />
            Meu Histórico
          </h2>

          <div className="space-y-3">
            {historico.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400 font-bold">+{item.pontos}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{item.descricao}</p>
                  {item.chamado_numero && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Chamado: {item.chamado_numero}
                      {item.chamado_titulo && ` - ${item.chamado_titulo}`}
                    </p>
                  )}
                  {item.projeto_nome && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Projeto: {item.projeto_nome}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {new Date(item.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}

            {historico.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Nenhum ponto registrado ainda
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Minhas Conquistas (Badges) */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <Medal className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Conquistas da TIC (Badges)</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Badges conquistados: {meusBadges.length}/{badges.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {badges.map((badge) => {
            const conquistado = meusBadges.find((mb) => mb.id === badge.id);
            return (
              <div
                key={badge.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  conquistado
                    ? "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border-purple-300 dark:border-purple-600 shadow-md"
                    : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 opacity-60"
                }`}
              >
                <div className="text-5xl mb-3 text-center">{badge.icone}</div>
                <h3 className="font-bold text-sm text-center text-gray-900 dark:text-white mb-1">
                  {badge.nome}
                </h3>
                <p className="text-xs text-center text-gray-600 dark:text-gray-400 mb-2 min-h-[32px]">
                  {badge.descricao}
                </p>
                {conquistado ? (
                  <Badge variant="secondary" className="w-full justify-center text-xs bg-purple-100 text-purple-700">
                    {new Date(conquistado.data_conquista).toLocaleDateString('pt-BR')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="w-full justify-center text-xs text-gray-400">
                    Bloqueado
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Como Funciona a Pontuação - SISTEMA JUSTO */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-8 border-2 border-blue-300 dark:border-blue-600 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-600 rounded-xl">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Como Funciona a Pontuação</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Sistema justo e automático - chamados complexos valem MUITO mais!</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-blue-200 dark:border-blue-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🔄 Cálculo Automático</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            Os pontos são calculados <strong>automaticamente</strong> quando você:
          </p>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-1">✓</span>
              <span><strong>Resolve um ticket</strong> (status muda para "Resolvido")</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-1">✓</span>
              <span><strong>Recebe avaliação</strong> do usuário (após fechamento)</span>
            </li>
          </ul>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-3 font-semibold">
            Não é necessário apertar nenhum botão - o sistema funciona sozinho!
          </p>

          {/* Alertas Importantes sobre Auto-Atendimento */}
          <div className="mt-6 space-y-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-300 mb-1">Auto-Atendimento</h4>
                  <p className="text-sm text-amber-800 dark:text-amber-400">
                    Tickets que você abre para si mesmo valem <strong>50% dos pontos</strong> (multiplicador 0.5x).
                    Exemplo: Se um ticket normal vale 20 pontos, auto-atendimento vale 10 pontos.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚫</span>
                <div>
                  <h4 className="font-bold text-red-900 dark:text-red-300 mb-1">Auto-Avaliações Não Contam</h4>
                  <p className="text-sm text-red-800 dark:text-red-400">
                    Se você avaliar um ticket que você mesmo abriu e resolveu, <strong>NÃO serão contabilizados pontos</strong> pela avaliação ou NPS.
                    Apenas avaliações de outros usuários contam pontos.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-1">NPS e Satisfação</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    Além dos pontos por resolução, você ganha pontos extras quando o usuário avalia seu atendimento positivamente.
                    O NPS do setor também é calculado baseado nas avaliações recebidas (excluindo auto-avaliações).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Coluna 1: Pontos por Resolução */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🎯 Pontos por Resolução de Tickets</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-indigo-600 dark:text-indigo-400 mb-2">1️⃣ Pontos Base (por prioridade)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300">P1 (Crítico)</span>
                    <span className="font-bold text-red-600 dark:text-red-400">20 pontos</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300">P2 (Alto)</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">15 pontos</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300">P3 (Médio)</span>
                    <span className="font-bold text-yellow-600 dark:text-yellow-400">10 pontos</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300">P4 (Baixo)</span>
                    <span className="font-bold text-green-600 dark:text-green-400">5 pontos</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-indigo-600 dark:text-indigo-400 mb-2">2️⃣ Multiplicador de Complexidade</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300">BI, Infraestrutura, Servidor, Rede</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">×3.0</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300">Hardware, Software, Sistema</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">×2.0</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-gray-700 dark:text-gray-300">Outras categorias</span>
                    <span className="font-bold text-gray-600 dark:text-gray-400">×1.0</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-indigo-600 dark:text-indigo-400 mb-2">3️⃣ Bônus Adicional</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300">Resolvido dentro do SLA</span>
                    <span className="font-bold text-green-600 dark:text-green-400">+5 pontos</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-1 text-sm">⚠️ Penalidade</h4>
                <p className="text-xs text-gray-700 dark:text-gray-300">Auto-atendimento (técnico resolve próprio ticket): <strong>50% dos pontos</strong></p>
              </div>
            </div>
          </div>

          {/* Coluna 2: Exemplos Práticos */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📊 Exemplos Práticos</h3>
            
            <div className="space-y-4 text-sm">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border-l-4 border-purple-500">
                <p className="font-bold text-gray-900 dark:text-white mb-2">🏆 Chamado COMPLEXO</p>
                <p className="text-gray-600 dark:text-gray-400 mb-2">P1 + Infraestrutura (Servidor caiu) + Dentro do SLA</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Cálculo: (20 × 3.0) + 5 = <strong>65 pontos</strong></p>
                <p className="text-purple-600 dark:text-purple-400 font-bold text-lg">= 65 pontos 🎉</p>
              </div>

              <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border-l-4 border-blue-500">
                <p className="font-bold text-gray-900 dark:text-white mb-2">💼 Chamado MÉDIO</p>
                <p className="text-gray-600 dark:text-gray-400 mb-2">P2 + Hardware (Trocar HD) + Dentro do SLA</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Cálculo: (15 × 2.0) + 5 = <strong>35 pontos</strong></p>
                <p className="text-blue-600 dark:text-blue-400 font-bold text-lg">= 35 pontos 👍</p>
              </div>

              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border-l-4 border-green-500">
                <p className="font-bold text-gray-900 dark:text-white mb-2">📝 Chamado SIMPLES</p>
                <p className="text-gray-600 dark:text-gray-400 mb-2">P3 + Outros (Dúvida geral) + Fora do SLA</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Cálculo: (10 × 1.0) + 0 = <strong>10 pontos</strong></p>
                <p className="text-green-600 dark:text-green-400 font-bold text-lg">= 10 pontos ✓</p>
              </div>

              <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-300 dark:border-amber-700">
                <p className="font-bold text-amber-900 dark:text-amber-300 mb-2">🎯 Por que é justo?</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  1 chamado P1 de Infraestrutura = <strong>65 pontos</strong><br/>
                  6 chamados P3 simples = <strong>60 pontos</strong>
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 italic">
                  Chamados difíceis valem muito mais que muitos chamados simples!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pontos por Avaliação */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">⭐ Pontos por Avaliação do Usuário</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Quando um usuário avalia seu atendimento, você ganha pontos extras além dos pontos de resolução:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center border border-green-200 dark:border-green-700">
              <div className="text-2xl mb-1">⭐⭐⭐⭐⭐</div>
              <p className="font-bold text-green-600 dark:text-green-400">+10 pontos</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Excelente</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center border border-blue-200 dark:border-blue-700">
              <div className="text-2xl mb-1">⭐⭐⭐⭐</div>
              <p className="font-bold text-blue-600 dark:text-blue-400">+5 pontos</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Bom</p>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center border border-yellow-200 dark:border-yellow-700">
              <div className="text-2xl mb-1">⭐⭐⭐</div>
              <p className="font-bold text-yellow-600 dark:text-yellow-400">+2 pontos</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Regular</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center border border-gray-200 dark:border-gray-600">
              <div className="text-2xl mb-1">⭐⭐ / ⭐</div>
              <p className="font-bold text-gray-600 dark:text-gray-400">0 pontos</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Insatisfeito</p>
            </div>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🚫</span>
              <div>
                <h4 className="font-bold text-red-900 dark:text-red-300 mb-2">IMPORTANTE: Auto-avaliações NÃO contam!</h4>
                <ul className="space-y-1 text-sm text-red-800 dark:text-red-400">
                  <li>• Se você avaliar um ticket que você mesmo abriu e resolveu: <strong>0 pontos</strong></li>
                  <li>• A auto-avaliação <strong>NÃO conta</strong> para o NPS do setor</li>
                  <li>• A auto-avaliação <strong>NÃO conta</strong> para a satisfação média</li>
                  <li>• Somente avaliações de <strong>outros usuários</strong> geram pontos e contam para métricas</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📈</span>
              <div>
                <h4 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2">NPS (Net Promoter Score)</h4>
                <p className="text-sm text-indigo-800 dark:text-indigo-400">
                  O NPS do setor é calculado com base nas avaliações recebidas pelos técnicos.
                  Avaliações 9-10 = Promotores, 7-8 = Neutros, 0-6 = Detratores.
                  <strong> Auto-avaliações são excluídas do cálculo do NPS.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Conteúdo da Aba Conquistas */}
      {abaAtiva === 'conquistas' && (
        <div className="space-y-6">
          {/* Filtro de Mês e Visualização */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filtrar por período:
                </label>
                <div className="flex gap-2 items-center flex-wrap">
                  <button
                    onClick={() => setMesSelecionadoConquistas('')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      !mesSelecionadoConquistas
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Mês Atual
                  </button>
                  {mesesDisponiveis.length > 0 && (
                    <select
                      value={mesSelecionadoConquistas}
                      onChange={(e) => setMesSelecionadoConquistas(e.target.value)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Selecione um período anterior</option>
                      {mesesDisponiveis.map((mes) => (
                        <option key={mes} value={mes}>
                          {new Date(mes + '-01').toLocaleDateString('pt-BR', {
                            month: 'long',
                            year: 'numeric'
                          })}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              
              {/* Botões de alternância de visualização (apenas para admin/gestor) */}
              {(profile?.perfil === 'admin' || profile?.perfil === 'gestor') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Visualização:
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVisualizacaoConquistas('badges')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        visualizacaoConquistas === 'badges'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Medal size={18} />
                      Por Badge
                    </button>
                    <button
                      onClick={() => setVisualizacaoConquistas('tecnicos')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        visualizacaoConquistas === 'tecnicos'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Users size={18} />
                      Por Técnico
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Visualização por Badges */}
          {visualizacaoConquistas === 'badges' && (
          <div className="space-y-6">
            {conquistasMes.map((badge) => (
              <div
                key={badge.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="text-5xl flex-shrink-0">{badge.icone}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {badge.nome}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {badge.descricao}
                    </p>
                    
                    {badge.conquistadores.length === 0 ? (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          Nenhum técnico conquistou este badge ainda
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Conquistado por {badge.conquistadores.length} técnico{badge.conquistadores.length !== 1 ? 's' : ''}:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {badge.conquistadores.map((conquistador) => (
                            <div
                              key={conquistador.user_id}
                              className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-3"
                            >
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {conquistador.user_nome}
                              </p>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {new Date(conquistador.data_conquista).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </p>
                                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                  {conquistador.total_pontos || 0} pts
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {conquistasMes.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-12 text-center">
                <Medal className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhuma conquista registrada para este período
                </p>
              </div>
            )}
          </div>
          )}

          {/* Visualização por Técnico */}
          {visualizacaoConquistas === 'tecnicos' && (profile?.perfil === 'admin' || profile?.perfil === 'gestor') && (
            <div className="space-y-4">
              {/* Filtros de Período */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Período:</span>
                  <button
                    onClick={() => {
                      const hoje = new Date().toISOString().split('T')[0];
                      setPeriodoTecnicos('personalizado');
                      setDataInicioTecnicos(hoje);
                      setDataFimTecnicos(hoje);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      periodoTecnicos === 'personalizado' && dataInicioTecnicos === dataFimTecnicos && dataInicioTecnicos === new Date().toISOString().split('T')[0]
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => {
                      const hoje = new Date();
                      const diaSemana = hoje.getDay();
                      const domingo = new Date(hoje);
                      domingo.setDate(hoje.getDate() - diaSemana);
                      setPeriodoTecnicos('personalizado');
                      setDataInicioTecnicos(domingo.toISOString().split('T')[0]);
                      setDataFimTecnicos(hoje.toISOString().split('T')[0]);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      periodoTecnicos === 'personalizado' && (() => {
                        const hoje = new Date();
                        const diaSemana = hoje.getDay();
                        const domingo = new Date(hoje);
                        domingo.setDate(hoje.getDate() - diaSemana);
                        return dataInicioTecnicos === domingo.toISOString().split('T')[0] && dataFimTecnicos === hoje.toISOString().split('T')[0];
                      })()
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Esta Semana
                  </button>
                  <button
                    onClick={() => setPeriodoTecnicos('mes')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      periodoTecnicos === 'mes'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Mês Atual
                  </button>
                  <button
                    onClick={() => setPeriodoTecnicos('total')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      periodoTecnicos === 'total'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Total Geral
                  </button>
                  
                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="date"
                      value={dataInicioTecnicos}
                      onChange={(e) => {
                        setDataInicioTecnicos(e.target.value);
                        if (e.target.value) setPeriodoTecnicos('personalizado');
                      }}
                      className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <span className="text-gray-500">até</span>
                    <input
                      type="date"
                      value={dataFimTecnicos}
                      onChange={(e) => {
                        setDataFimTecnicos(e.target.value);
                        if (e.target.value) setPeriodoTecnicos('personalizado');
                      }}
                      className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    {(dataInicioTecnicos || dataFimTecnicos) && (
                      <button
                        onClick={() => {
                          setDataInicioTecnicos('');
                          setDataFimTecnicos('');
                          setPeriodoTecnicos('mes');
                        }}
                        className="px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
                {periodoTecnicos === 'personalizado' && dataInicioTecnicos && dataFimTecnicos && (
                  <div className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">
                    Exibindo badges e pontos de {new Date(dataInicioTecnicos + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(dataFimTecnicos + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
              
              {tecnicosBadges.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-12 text-center">
                  <Users className="mx-auto mb-4 text-gray-400" size={48} />
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhum técnico encontrado
                  </p>
                </div>
              ) : (
                tecnicosBadges.map((tecnico) => (
                  <div
                    key={tecnico.user_id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                          {tecnico.user_nome?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {tecnico.user_nome}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Star size={14} className="text-yellow-500" />
                              Nível {tecnico.nivel}
                            </span>
                            <span className="flex items-center gap-1">
                              <Trophy size={14} className="text-indigo-500" />
                              {tecnico.total_pontos} pts total
                            </span>
                            {periodoTecnicos === 'personalizado' && tecnico.pontos_periodo !== undefined ? (
                              <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                                <Calendar size={14} className="text-indigo-500" />
                                {tecnico.pontos_periodo} pts período
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Calendar size={14} className="text-green-500" />
                                {tecnico.mes_atual} pts mês
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold">
                          <Medal size={16} />
                          {tecnico.badges.length} badge{tecnico.badges.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    
                    {tecnico.badges.length === 0 ? (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          Nenhum badge conquistado ainda
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {tecnico.badges.map((badge) => (
                          <div
                            key={badge.id}
                            className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 text-center"
                            title={badge.descricao}
                          >
                            <div className="text-3xl mb-1">{badge.icone}</div>
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {badge.nome}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(badge.data_conquista).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short'
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalhamento do Técnico */}
      {modalDetalhamentoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-xl border-b border-indigo-700 z-10">
              <div className="flex items-center justify-between">
                <div>
                  {tecnicoDetalhado ? (
                    <>
                      <h2 className="text-2xl font-bold">{tecnicoDetalhado.tecnico.user_nome}</h2>
                      <p className="text-indigo-100 mt-1">
                        Nível {tecnicoDetalhado.tecnico.nivel} • {tecnicoDetalhado.tecnico.total_pontos} pontos totais • {tecnicoDetalhado.tecnico.mes_atual} pontos no mês
                      </p>
                    </>
                  ) : (
                    <h2 className="text-2xl font-bold">Detalhamento de Pontos</h2>
                  )}
                </div>
                <button
                  onClick={fecharDetalhamento}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <span className="text-2xl">✕</span>
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              {carregandoDetalhamento ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Carregando detalhamento...</p>
                </div>
              ) : tecnicoDetalhado ? (
                <div className="space-y-6">
                  {/* Estatísticas Resumidas */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tickets Resolvidos</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{tecnicoDetalhado.estatisticas.total_chamados}</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pontos por Resolução</p>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{tecnicoDetalhado.estatisticas.pontos_resolucao}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avaliações Recebidas</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{tecnicoDetalhado.estatisticas.total_avaliacoes}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pontos por Avaliação</p>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{tecnicoDetalhado.estatisticas.pontos_avaliacoes}</p>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="border-b border-gray-200 dark:border-gray-700">
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setAbaDetalhamento('tickets')}
                        className={`px-4 py-2 font-semibold transition-colors ${
                          abaDetalhamento === 'tickets'
                            ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        Tickets Resolvidos ({tecnicoDetalhado.chamados.length})
                      </button>
                      <button 
                        onClick={() => setAbaDetalhamento('avaliacoes')}
                        className={`px-4 py-2 font-semibold transition-colors ${
                          abaDetalhamento === 'avaliacoes'
                            ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        Avaliações ({tecnicoDetalhado.avaliacoes.length})
                      </button>
                    </div>
                  </div>

                  {/* Tabela de Tickets */}
                  {abaDetalhamento === 'tickets' && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Ticket</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Prioridade</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Categoria</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Composição</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Pontos</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">Resolvido em</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {tecnicoDetalhado.chamados.map((chamado) => (
                          <tr key={chamado.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{chamado.numero}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">{chamado.titulo}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                chamado.prioridade === 'P1' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                chamado.prioridade === 'P2' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                chamado.prioridade === 'P3' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                {chamado.prioridade}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                chamado.status === 'Fechado' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                {chamado.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-gray-900 dark:text-white">{chamado.categoria_nome || 'N/A'}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{chamado.composicao.tipo_categoria}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs space-y-1">
                                <p className="text-gray-700 dark:text-gray-300">
                                  Base: {chamado.composicao.pontos_base} pts
                                </p>
                                {chamado.composicao.multiplicador_categoria > 1 && (
                                  <p className="text-purple-600 dark:text-purple-400">
                                    × {chamado.composicao.multiplicador_categoria.toFixed(1)} (complexidade)
                                  </p>
                                )}
                                {chamado.composicao.bonus_sla > 0 && (
                                  <p className="text-green-600 dark:text-green-400">
                                    + {chamado.composicao.bonus_sla} (SLA)
                                  </p>
                                )}
                                {chamado.composicao.is_auto_atendimento && (
                                  <p className="text-amber-600 dark:text-amber-400">
                                    × 0.5 (auto)
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                +{chamado.pontos_ganhos}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {new Date(chamado.data_resolucao).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit'
                                })}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {tecnicoDetalhado.chamados.length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Nenhum ticket resolvido ainda
                      </div>
                    )}
                  </div>
                  )}

                  {/* Seção de Avaliações */}
                  {abaDetalhamento === 'avaliacoes' && (
                    <div>
                      {tecnicoDetalhado.avaliacoes.length > 0 ? (
                      <>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        ⭐ Avaliações Recebidas
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tecnicoDetalhado.avaliacoes.map((avaliacao) => (
                          <div key={avaliacao.id} className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{avaliacao.numero}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">{avaliacao.titulo}</p>
                              </div>
                              <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                +{avaliacao.pontos_ganhos}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <span key={i} className={i < avaliacao.avaliacao_nota ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}>
                                    ⭐
                                  </span>
                                ))}
                              </div>
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {avaliacao.avaliacao_nota}/5
                              </span>
                            </div>
                            {avaliacao.avaliacao_comentario && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                                "{avaliacao.avaliacao_comentario}"
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                              <span>Por: {avaliacao.solicitante_nome}</span>
                              <span>
                                {new Date(avaliacao.avaliacao_data).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      </>
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-500 dark:text-gray-400 text-lg">
                            Nenhuma avaliação recebida ainda
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      </div>
    </Layout>
  );
}
