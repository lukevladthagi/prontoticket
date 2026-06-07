"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/router-shim";
import Layout from "@/components/Layout";
import { useUserProfile } from "@/hooks/useUserProfile";
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Smile,
  Target,
  Plus,
  Filter,
  X,
  ExternalLink
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DashboardStats, StatusChamado, Chamado } from "@/shared/types";

interface Setor {
  id: number;
  nome: string;
}

interface TicketModalData {
  setor: string;
  tickets: Chamado[];
}

export default function DashboardPage() {
  const { profile } = useUserProfile();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [setorFiltro, setSetorFiltro] = useState<string>('');
  const [periodoFiltro, setPeriodoFiltro] = useState<'mes' | 'total'>('mes');
  const [setores, setSetores] = useState<Setor[]>([]);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [ticketModal, setTicketModal] = useState<TicketModalData | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    fetchSetores();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [setorFiltro, periodoFiltro, dataInicio, dataFim]);

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [setorFiltro, periodoFiltro, dataInicio, dataFim]);

  const fetchSetores = async () => {
    try {
      const response = await fetch("/api/setores");
      if (response.ok) {
        const data = await response.json();
        // Mostrar apenas setores ativos que atendem tickets
        const setoresFiltrados = data.filter((s: any) => s.ativo && s.atende_ticket);
        setSetores(setoresFiltrados);
      }
    } catch (error) {
      console.error("Erro ao buscar setores:", error);
    }
  };

  const setorSelecionado = setores.find(s => s.id === Number(setorFiltro));

  const handleBarClick = async (setor: string) => {
    setLoadingTickets(true);
    setTicketModal({ setor, tickets: [] });
    
    try {
      const params = new URLSearchParams();
      params.append('setor_solicitante', setor);
      params.append('setor_destino_id', '1'); // Filtrar apenas tickets do setor TI
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);
      params.append('limit', '999');
      
      const response = await fetch(`/api/chamados?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTicketModal({ setor, tickets: data.chamados || [] });
      }
    } catch (error) {
      console.error("Erro ao buscar tickets:", error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (setorFiltro) params.append('setor_id', setorFiltro);
      params.append('periodo', periodoFiltro);
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);
      
      const url = `/api/dashboard/stats?${params.toString()}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };



  const prioridadeColors = {
    P1: 'bg-red-100 text-red-700 border-red-200',
    P2: 'bg-orange-100 text-orange-700 border-orange-200',
    P3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    P4: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const statusColors: Record<StatusChamado, string> = {
    'Novo': 'bg-blue-100 text-blue-700',
    'Em triagem': 'bg-purple-100 text-purple-700',
    'Em atendimento': 'bg-indigo-100 text-indigo-700',
    'Aguardando usuário': 'bg-yellow-100 text-yellow-700',
    'Aguardando fornecedor': 'bg-orange-100 text-orange-700',
    'Resolvido': 'bg-green-100 text-green-700',
    'Fechado': 'bg-gray-100 text-gray-700',
    'Cancelado': 'bg-red-100 text-red-700',
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 relative">
        {/* Loading Overlay */}
        {loading && stats && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col items-center gap-4 min-w-[300px]">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-200 dark:border-indigo-900 rounded-full"></div>
                <div className="w-16 h-16 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin absolute top-0"></div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Carregando dados...
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Atualizando estatísticas do dashboard
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Initial Loading State */}
        {loading && !stats && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Bem-vindo, {profile?.nome || 'Usuário'}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/chamados/novo"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
            >
              <Plus size={20} />
              Novo Chamado
            </Link>
          </div>
        </div>

        {/* Filtro de Setor */}
        {profile && profile.perfil !== 'solicitante' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Filter size={20} />
                <span className="font-medium">Filtros:</span>
              </div>
              
              {/* Filtro de Período */}
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => {
                    setPeriodoFiltro('mes');
                    setDataInicio('');
                    setDataFim('');
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    periodoFiltro === 'mes'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Mês Atual
                </button>
                <button
                  onClick={() => {
                    setPeriodoFiltro('total');
                    setDataInicio('');
                    setDataFim('');
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    periodoFiltro === 'total'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Todo Período
                </button>
                
                <div className="flex items-center gap-2 ml-4">
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => {
                      setDataInicio(e.target.value);
                      setPeriodoFiltro('total');
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Data início"
                  />
                  <span className="text-gray-500 dark:text-gray-400">até</span>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => {
                      setDataFim(e.target.value);
                      setPeriodoFiltro('total');
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Data fim"
                  />
                  {(dataInicio || dataFim) && (
                    <button
                      onClick={() => {
                        setDataInicio('');
                        setDataFim('');
                      }}
                      className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
                    >
                      Limpar Datas
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro de Setor */}
              <select
                value={setorFiltro}
                onChange={(e) => setSetorFiltro(e.target.value)}
                className="flex-1 max-w-md px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todos os Setores</option>
                {setores.map((setor) => (
                  <option key={setor.id} value={setor.id}>
                    {setor.nome}
                  </option>
                ))}
              </select>
              {setorFiltro && (
                <button
                  onClick={() => setSetorFiltro('')}
                  className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
                >
                  Limpar Filtro
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cards de Estatísticas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Total Geral de Tickets */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 border-2 border-indigo-400 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-indigo-100 mb-1 font-medium">Total de Tickets</p>
            <p className="text-3xl font-bold text-white">{stats?.total_chamados || 0}</p>
            <p className="text-xs text-indigo-100 mt-2">
              {periodoFiltro === 'mes' ? 'No período filtrado' : 'Todos os registros'}
            </p>
          </div>

          {/* NOVOS - Sem atribuição (CRÍTICO) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-red-300 dark:border-red-700 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-semibold">Chamados Novos</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats?.chamados_novos || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Sem atribuição - Aguardando atendimento
            </p>
          </div>

          {/* Em Triagem */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-purple-200 dark:border-purple-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Em Triagem</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.chamados_em_triagem || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Sendo classificados
            </p>
          </div>

          {/* Atribuídos a Técnicos */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-blue-200 dark:border-blue-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Atribuídos</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.chamados_atribuidos || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Com técnico responsável
            </p>
          </div>

          {/* Em Atendimento */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-indigo-200 dark:border-indigo-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Em Atendimento</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.chamados_em_atendimento || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Ativamente sendo resolvidos
            </p>
          </div>

          {/* Pausados */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-yellow-200 dark:border-yellow-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pausados</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.chamados_pausados || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Aguardando usuário/fornecedor
            </p>
          </div>

          {/* Agendados */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-orange-200 dark:border-orange-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Agendados</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.chamados_agendados || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Com data/hora marcada
            </p>
          </div>

          {/* Resolvidos */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-green-200 dark:border-green-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Resolvidos este Mês</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.chamados_resolvidos_mes || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              No período selecionado
            </p>
          </div>
        </div>

        {/* Cards de SLA */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${
          setorSelecionado && ['Hotelaria', 'Rouparia', 'Manutenção', 'Comercial', 'Central de navegação'].includes(setorSelecionado.nome) 
            ? 'lg:grid-cols-1' 
            : 'lg:grid-cols-2'
        }`}>
          {/* SLA de primeiro atendimento - ocultar para Hotelaria, Rouparia, Manutenção, Comercial e Central de navegação */}
          {(!setorSelecionado || !['Hotelaria', 'Rouparia', 'Manutenção', 'Comercial', 'Central de navegação'].includes(setorSelecionado.nome)) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Atendidos no SLA{setorSelecionado ? ` (${setorSelecionado.nome})` : ''}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats?.sla_resposta_percentual !== null && stats?.sla_resposta_percentual !== undefined ? `${stats.sla_resposta_percentual.toFixed(1)}%` : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {stats?.sla_resposta_dentro || 0} de {stats?.sla_resposta_total || 0} tickets
              </p>
            </div>
          )}

          {/* SLA de resolução para todos os setores */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Resolvidos no SLA{setorSelecionado ? ` (${setorSelecionado.nome})` : ''}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats?.sla_resolucao_percentual !== null && stats?.sla_resolucao_percentual !== undefined ? `${stats.sla_resolucao_percentual.toFixed(1)}%` : '--'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {stats?.sla_resolucao_dentro || 0} de {stats?.sla_resolucao_total || 0} tickets
            </p>
          </div>
        </div>

        {/* Métricas de Qualidade */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Smile className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Satisfação Média</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats?.satisfacao_media ? `${stats.satisfacao_media.toFixed(1)}/5.0` : 'N/A'}
                  </p>
                  {stats?.satisfacao_media && (
                    <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                      ({((stats.satisfacao_media / 5.0) * 100).toFixed(0)}%)
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {stats?.satisfacao_total_avaliacoes || 0} {stats?.satisfacao_total_avaliacoes === 1 ? 'avaliação' : 'avaliações'}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <div
                  key={star}
                  className={`h-2 flex-1 rounded ${
                    star <= (stats?.satisfacao_media || 0) ? 'bg-yellow-400 dark:bg-yellow-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">NPS Médio</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats?.nps_medio ? stats.nps_medio.toFixed(0) : 'N/A'}
                  </p>
                  {stats?.nps_medio !== null && stats?.nps_medio !== undefined && (
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      ({((stats.nps_medio / 10) * 100).toFixed(0)}%)
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {stats?.nps_total_avaliacoes || 0} {stats?.nps_total_avaliacoes === 1 ? 'avaliação' : 'avaliações'}
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((stats?.nps_medio || 0) / 10) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tempo Médio de Resolução</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.tempo_medio_resolucao 
                    ? (() => {
                        const minutos = Math.round(stats.tempo_medio_resolucao);
                        if (minutos < 60) return `${minutos}min`;
                        const horas = Math.floor(minutos / 60);
                        const minutosRestantes = minutos % 60;
                        return minutosRestantes > 0 ? `${horas}h ${minutosRestantes}min` : `${horas}h`;
                      })()
                    : '0h'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Distribuição por Tipo de Problema */}
        {stats?.chamados_por_tipo_problema && stats.chamados_por_tipo_problema.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-purple-500" />
              Distribuição por Tipo de Problema
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={stats.chamados_por_tipo_problema}
                barCategoryGap="25%"
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="tipo_problema" 
                  className="text-gray-600 dark:text-gray-400"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis 
                  className="text-gray-600 dark:text-gray-400"
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(31 41 55)',
                    border: '1px solid rgb(75 85 99)',
                    borderRadius: '0.5rem',
                    color: 'white'
                  }}
                />
                <Bar dataKey="total" fill="#8b5cf6" name="Total de Chamados" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Distribuição por Categoria */}
        {stats?.chamados_por_categoria && stats.chamados_por_categoria.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Top 10 Categorias Mais Solicitadas
            </h2>
            <div className="space-y-4">
              {stats.chamados_por_categoria.map((item, index) => {
                const maxTotal = stats.chamados_por_categoria[0].total;
                const percentage = (item.total / maxTotal) * 100;
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.categoria}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                        {item.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chamados por Prioridade e Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Por Prioridade */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Chamados por Prioridade</h2>
            <div className="space-y-3">
              {Object.entries(stats?.chamados_por_prioridade || {}).map(([prioridade, count]) => (
                <div key={prioridade} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${prioridadeColors[prioridade as keyof typeof prioridadeColors]}`}>
                      {prioridade}
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Por Status */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Chamados por Status</h2>
            <div className="space-y-3">
              {Object.entries(stats?.chamados_por_status || {})
                .filter(([_, count]) => count > 0)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status as StatusChamado]}`}>
                        {status}
                      </span>
                    </div>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Gráfico de Tendência Mensal */}
        {stats?.chamados_por_mes && stats.chamados_por_mes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tendência de Chamados (Últimos 12 Meses)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.chamados_por_mes.map(item => ({
                ...item,
                mesFormatado: (() => {
                  const [ano, mes] = item.mes.split('-');
                  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  return `${meses[parseInt(mes) - 1]}/${ano.substring(2)}`;
                })()
              }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="mesFormatado" 
                  className="text-gray-600 dark:text-gray-400"
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis 
                  className="text-gray-600 dark:text-gray-400"
                  tick={{ fill: 'currentColor' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(31 41 55)',
                    border: '1px solid rgb(75 85 99)',
                    borderRadius: '0.5rem',
                    color: 'white'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="novos" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Novos Chamados"
                  dot={{ fill: '#3b82f6' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="resolvidos" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Resolvidos"
                  dot={{ fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Distribuição por Subcategoria */}
        {stats?.chamados_por_subcategoria && stats.chamados_por_subcategoria.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Top 15 Subcategorias Mais Solicitadas
            </h2>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {stats.chamados_por_subcategoria.map((item, index) => {
                const maxTotal = stats.chamados_por_subcategoria[0].total;
                const percentage = (item.total / maxTotal) * 100;
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {item.subcategoria}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {item.categoria}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full ml-2 flex-shrink-0">
                        {item.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Distribuição por Setor Solicitante */}
        {stats?.chamados_por_setor_solicitante && stats.chamados_por_setor_solicitante.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              Distribuição por Setor Solicitante
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.chamados_por_setor_solicitante}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="setor_solicitante" 
                  className="text-gray-600 dark:text-gray-400"
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis 
                  className="text-gray-600 dark:text-gray-400"
                  tick={{ fill: 'currentColor' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(31 41 55)',
                    border: '1px solid rgb(75 85 99)',
                    borderRadius: '0.5rem',
                    color: 'white'
                  }}
                  labelStyle={{ color: 'white' }}
                />
                <Bar 
                  dataKey="total" 
                  fill="url(#colorSetor)" 
                  radius={[8, 8, 0, 0]}
                  name="Total de Chamados"
                  onClick={(data: any) => handleBarClick(data.setor_solicitante)}
                  cursor="pointer"
                />
                <defs>
                  <linearGradient id="colorSetor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Modal de Tickets */}
        {ticketModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Tickets - {ticketModal.setor}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {loadingTickets ? 'Carregando...' : `${ticketModal.tickets.length} ticket(s) encontrado(s)`}
                  </p>
                </div>
                <button
                  onClick={() => setTicketModal(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingTickets ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                ) : ticketModal.tickets.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">Nenhum ticket encontrado para este setor.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ticketModal.tickets.map((ticket) => (
                      <Link
                        key={ticket.id}
                        to={`/chamados/${ticket.numero}`}
                        className="block bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                                {ticket.numero}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[ticket.status]}`}>
                                {ticket.status}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${prioridadeColors[ticket.prioridade as keyof typeof prioridadeColors]}`}>
                                {ticket.prioridade}
                              </span>
                            </div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1 truncate">
                              {ticket.titulo}
                            </h4>
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                              {ticket.tipo_problema && (
                                <span className="flex items-center gap-1">
                                  <Filter size={12} />
                                  {ticket.tipo_problema}
                                </span>
                              )}
                              {ticket.tecnico_responsavel_nome && (
                                <span>• {ticket.tecnico_responsavel_nome}</span>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-1" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  onClick={() => setTicketModal(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
