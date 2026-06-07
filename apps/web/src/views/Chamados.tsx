"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/router-shim";
import Layout from "@/components/Layout";
import { Plus, Search, Filter, Clock, AlertCircle, UserCheck, UserX, FileText } from "lucide-react";
import type { Chamado, StatusChamado, Prioridade } from "@/shared/types";
import { gerarRelatorioPendentes } from "@/utils/relatorio-pdf";
import { useUserProfile } from "@/hooks/useUserProfile";
import { converterParaHorarioBrasil, formatarDataBrasil, formatarHorarioBrasil } from "@/utils/timezone";
import { getTiposProblemaParaSetor } from "@/shared/tipos-problema-setor";

interface Setor {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

type ViewFilter = "todos" | "meus" | "novos" | "atribuidos" | "pausados" | "em_atendimento" | "resolvido" | "fechado";

export default function ChamadosPage() {
  const { profile } = useUserProfile();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewAtiva, setViewAtiva] = useState<ViewFilter>("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>("");
  const [filtroSetor, setFiltroSetor] = useState<string>("");
  const [filtroTipoProblema, setFiltroTipoProblema] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setoresMap, setSetoresMap] = useState<Map<number, string>>(new Map());
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date());
  const [novosChamados, setNovosChamados] = useState<number>(0);
  const [mostrarAlerta, setMostrarAlerta] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tiposProblemaUsuario, setTiposProblemaUsuario] = useState<string[]>([]);
  
  // Verificar se usuário pode ver filtro de setores (gestores e admins)
  const podeVerTodosSetores = profile?.perfil === 'gestor' || profile?.perfil === 'admin';

  // Definir tipos de problema baseado no setor do usuário
  useEffect(() => {
    if (profile && profile.setor_nome) {
      const tipos = getTiposProblemaParaSetor(profile.setor_nome);
      // Remover exemplos dos tipos (ex: "Hardware (ex: Teclado...)" -> "Hardware")
      const tiposLimpos = tipos.map(tipo => tipo.split(' (ex:')[0].trim());
      setTiposProblemaUsuario(tiposLimpos);
    }
  }, [profile]);

  useEffect(() => {
    fetchSetores();
  }, []);

  useEffect(() => {
    setPaginaAtual(1); // Reset para primeira página quando filtros mudam
    fetchChamados();
  }, [viewAtiva, filtroPrioridade, filtroSetor, filtroTipoProblema, dataInicio, dataFim, busca]);

  useEffect(() => {
    fetchChamados();
  }, [paginaAtual]);

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchChamados(true); // true = é refresh automático
    }, 30000);

    return () => clearInterval(interval);
  }, [viewAtiva, filtroPrioridade, filtroSetor, filtroTipoProblema, dataInicio, dataFim, busca, paginaAtual]);

  const fetchSetores = async () => {
    try {
      const response = await fetch("/api/setores");
      if (response.ok) {
        const data = await response.json();
        const setoresAtivos = data.filter((s: Setor) => s.ativo);
        setSetores(setoresAtivos);
        
        // Criar mapa de ID -> Nome para lookup rápido
        const map = new Map<number, string>();
        data.forEach((s: Setor) => {
          map.set(s.id, s.nome);
        });
        setSetoresMap(map);
      }
    } catch (error) {
      console.error("Erro ao buscar setores:", error);
    }
  };

  const fetchChamados = async (isAutoRefresh = false) => {
    try {
      const params = new URLSearchParams();
      params.append("view", viewAtiva);
      params.append("page", paginaAtual.toString());
      params.append("limit", "20");
      if (filtroPrioridade) params.append("prioridade", filtroPrioridade);
      if (filtroSetor) params.append("setor_destino_id", filtroSetor);
      if (filtroTipoProblema) params.append("tipo_problema", filtroTipoProblema);
      if (dataInicio) params.append("data_inicio", dataInicio);
      if (dataFim) params.append("data_fim", dataFim);
      if (busca) params.append("busca", busca);

      const response = await fetch(`/api/chamados?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        
        // Verificar se retornou formato com paginação
        const chamadosData = data.chamados || data;
        const paginacaoData = data.paginacao;
        
        // Atualizar informações de paginação
        if (paginacaoData) {
          setTotalPaginas(paginacaoData.total_paginas);
        }
        
        // Detectar novos chamados
        if (isAutoRefresh && chamados.length > 0) {
          const chamadosAntigos = new Set(chamados.map(c => c.id));
          const chamadosNovos = chamadosData.filter((c: Chamado) => !chamadosAntigos.has(c.id));
          
          if (chamadosNovos.length > 0) {
            setNovosChamados(chamadosNovos.length);
            setMostrarAlerta(true);
            
            // Esconder alerta após 5 segundos
            setTimeout(() => setMostrarAlerta(false), 5000);
          }
        }
        
        setChamados(chamadosData);
        setUltimaAtualizacao(new Date());
      }
    } catch (error) {
      console.error("Erro ao buscar chamados:", error);
    } finally {
      setLoading(false);
    }
  };

  // A busca agora é feita no backend, não precisa filtrar no frontend
  const chamadosFiltrados = chamados;

  const prioridadeColors = {
    P1: 'bg-red-100 text-red-700 border-red-200',
    P2: 'bg-orange-100 text-orange-700 border-orange-200',
    P3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    P4: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const statusColors: Record<StatusChamado, string> = {
    'Novo': 'bg-blue-500',
    'Em triagem': 'bg-purple-500',
    'Em atendimento': 'bg-indigo-500',
    'Aguardando usuário': 'bg-yellow-500',
    'Aguardando fornecedor': 'bg-orange-500',
    'Resolvido': 'bg-green-500',
    'Fechado': 'bg-gray-500',
    'Cancelado': 'bg-red-500',
  };

  // Função para obter horário atual de Brasília (UTC-3)
  const getHorarioBrasil = () => {
    const now = new Date();
    // Converter UTC para Brasil (UTC-3)
    return new Date(now.getTime() - (3 * 60 * 60 * 1000));
  };

  const formatarTempoRestante = (milissegundos: number) => {
    const segundos = Math.floor(milissegundos / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (dias > 0) {
      const horasRestantes = horas % 24;
      return dias === 1 
        ? `${dias} dia${horasRestantes > 0 ? ` ${horasRestantes}h` : ''}`
        : `${dias} dias${horasRestantes > 0 ? ` ${horasRestantes}h` : ''}`;
    }
    if (horas > 0) {
      const minutosRestantes = minutos % 60;
      return `${horas}h${minutosRestantes > 0 ? ` ${minutosRestantes}min` : ''}`;
    }
    if (minutos > 0) {
      return `${minutos} min`;
    }
    return `${segundos} seg`;
  };

  const calcularStatusSLA = (chamado: Chamado) => {
    // Tickets já resolvidos/fechados não têm status SLA ativo
    if (['Resolvido', 'Fechado', 'Cancelado'].includes(chamado.status)) {
      return null;
    }

    // Verificar se o SLA está pausado (usando o campo sla_pausado_em)
    if (chamado.sla_pausado_em) {
      // Retornar status especial para pausado
      const prazo = chamado.prazo_resposta && !chamado.data_primeira_resposta 
        ? converterParaHorarioBrasil(chamado.prazo_resposta)
        : chamado.prazo_solucao 
        ? converterParaHorarioBrasil(chamado.prazo_solucao)
        : null;
      
      if (prazo) {
        return { 
          tipo: chamado.prazo_resposta && !chamado.data_primeira_resposta ? 'resposta' : 'solucao', 
          status: 'pausado', 
          prazo, 
          tempoRestante: 0 
        };
      }
      return null;
    }

    const agora = getHorarioBrasil();
    
    // Verificar SLA de resposta (se ainda não foi respondido)
    if (chamado.prazo_resposta && !chamado.data_primeira_resposta) {
      const prazoResposta = converterParaHorarioBrasil(chamado.prazo_resposta);
      const tempoRestante = prazoResposta.getTime() - agora.getTime();
      
      if (tempoRestante < 0) {
        return { tipo: 'resposta', status: 'estourado', prazo: prazoResposta, tempoRestante: Math.abs(tempoRestante) };
      }
      
      // Calcular % de tempo decorrido
      const dataAbertura = converterParaHorarioBrasil(chamado.data_abertura);
      const tempoTotal = prazoResposta.getTime() - dataAbertura.getTime();
      const tempoDecorrido = agora.getTime() - dataAbertura.getTime();
      const percentual = (tempoDecorrido / tempoTotal) * 100;
      
      // Retornar sempre com tempo restante
      if (percentual >= 80) {
        return { tipo: 'resposta', status: 'proximo', prazo: prazoResposta, tempoRestante };
      }
      
      // Mesmo que não esteja próximo, retornar para mostrar o contador
      return { tipo: 'resposta', status: 'normal', prazo: prazoResposta, tempoRestante };
    }
    
    // Verificar SLA de solução
    if (chamado.prazo_solucao) {
      const prazoSolucao = converterParaHorarioBrasil(chamado.prazo_solucao);
      const tempoRestante = prazoSolucao.getTime() - agora.getTime();
      
      if (tempoRestante < 0) {
        return { tipo: 'solucao', status: 'estourado', prazo: prazoSolucao, tempoRestante: Math.abs(tempoRestante) };
      }
      
      // Calcular % de tempo decorrido
      const dataAbertura = converterParaHorarioBrasil(chamado.data_abertura);
      const tempoTotal = prazoSolucao.getTime() - dataAbertura.getTime();
      const tempoDecorrido = agora.getTime() - dataAbertura.getTime();
      const percentual = (tempoDecorrido / tempoTotal) * 100;
      
      // Retornar sempre com tempo restante
      if (percentual >= 80) {
        return { tipo: 'solucao', status: 'proximo', prazo: prazoSolucao, tempoRestante };
      }
      
      // Mesmo que não esteja próximo, retornar para mostrar o contador
      return { tipo: 'solucao', status: 'normal', prazo: prazoSolucao, tempoRestante };
    }
    
    return null;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Alerta de Novos Chamados */}
        {mostrarAlerta && (
          <div className="fixed top-4 right-4 z-50 animate-bounce">
            <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border-2 border-green-400">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <div>
                <p className="font-bold text-lg">🎫 {novosChamados} Novo{novosChamados > 1 ? 's' : ''} Chamado{novosChamados > 1 ? 's' : ''}!</p>
                <p className="text-sm text-green-100">Atualizado agora mesmo</p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Chamados</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              🔄 Atualização automática • Última: {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => gerarRelatorioPendentes(chamados, setoresMap)}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg"
              title="Gerar relatório PDF de chamados pendentes"
            >
              <FileText size={20} />
              Relatório Pendentes
            </button>
            <Link
              to="/chamados/novo"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
            >
              <Plus size={20} />
              Novo Chamado
            </Link>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            <button
              onClick={() => setViewAtiva("todos")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                viewAtiva === "todos"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              📋 Todos
            </button>
            <button
              onClick={() => setViewAtiva("meus")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                viewAtiva === "meus"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              👤 Meus Chamados
            </button>
            <button
              onClick={() => setViewAtiva("novos")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                viewAtiva === "novos"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              🆕 Novos
            </button>
            <button
              onClick={() => setViewAtiva("atribuidos")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                viewAtiva === "atribuidos"
                  ? "border-green-600 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              👥 Atribuídos
            </button>
            <button
              onClick={() => setViewAtiva("pausados")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                viewAtiva === "pausados"
                  ? "border-orange-600 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              ⏸️ Pausados
            </button>
            <button
              onClick={() => setViewAtiva("em_atendimento")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                viewAtiva === "em_atendimento"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              ⚙️ Em Atendimento
            </button>
            <button
              onClick={() => setViewAtiva("resolvido")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                viewAtiva === "resolvido"
                  ? "border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              ⭐ Aguardando Avaliação
            </button>
            <button
              onClick={() => setViewAtiva("fechado")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                viewAtiva === "fechado"
                  ? "border-gray-600 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              🔒 Fechado
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="space-y-4">
            {/* Linha 1: Busca e Datas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                <input
                  type="text"
                  placeholder="Buscar por número, título..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  placeholder="Data Início"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  placeholder="Data Fim"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            
            {/* Linha 2: Filtros */}
            <div className={`grid grid-cols-1 ${podeVerTodosSetores ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>

            {podeVerTodosSetores && (
              <select
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todos os Setores</option>
                {setores.map((setor) => (
                  <option key={setor.id} value={setor.id}>
                    {setor.nome}
                  </option>
                ))}
              </select>
            )}

            {tiposProblemaUsuario.length > 0 && (
              <select
                value={filtroTipoProblema}
                onChange={(e) => setFiltroTipoProblema(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todos os Tipos de Problema</option>
                {tiposProblemaUsuario.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            )}

            <select
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Todas as Prioridades</option>
              <option value="P1">P1 - Crítica</option>
              <option value="P2">P2 - Alta</option>
              <option value="P3">P3 - Média</option>
              <option value="P4">P4 - Baixa</option>
            </select>
            </div>
            
            {/* Botão de limpar filtros */}
            {(dataInicio || dataFim || busca || filtroPrioridade || filtroSetor || filtroTipoProblema) && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setDataInicio("");
                    setDataFim("");
                    setBusca("");
                    setFiltroPrioridade("");
                    setFiltroSetor("");
                    setFiltroTipoProblema("");
                    setPaginaAtual(1);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Limpar Filtros
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lista de Chamados */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : chamadosFiltrados.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="text-gray-400 dark:text-gray-500" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhum chamado encontrado</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {busca || filtroPrioridade || filtroSetor
                ? "Tente ajustar os filtros de busca"
                : "Crie seu primeiro chamado para começar"}
            </p>
            <Link
              to="/chamados/novo"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              <Plus size={20} />
              Novo Chamado
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {chamadosFiltrados.map((chamado) => {
              const statusSLA = calcularStatusSLA(chamado);
              
              return (
                <div
                  key={chamado.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg border-2 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                    statusSLA?.status === 'pausado'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : statusSLA?.status === 'estourado' 
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                      : statusSLA?.status === 'proximo'
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  onClick={() => window.location.href = `/chamados/${chamado.id}`}
                >
                  <div className="p-4">
                    {/* Linha 1: Número, Título e SLA */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                          {chamado.numero}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                            {chamado.titulo}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                            {chamado.descricao}
                          </p>
                        </div>
                      </div>
                      
                      {/* Indicador de SLA */}
                      {statusSLA && (
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm ${
                            statusSLA.status === 'pausado'
                              ? 'bg-blue-600 text-white'
                              : statusSLA.status === 'estourado'
                              ? 'bg-red-600 text-white'
                              : statusSLA.status === 'proximo'
                              ? 'bg-yellow-500 text-gray-900'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          }`}>
                            <AlertCircle size={18} />
                            <span>
                              {statusSLA.status === 'pausado' ? 'SLA PAUSADO' : statusSLA.status === 'estourado' ? 'SLA ESTOURADO' : statusSLA.status === 'proximo' ? 'SLA PRÓXIMO' : 'SLA OK'}
                            </span>
                          </div>
                          {statusSLA.status !== 'pausado' && (
                            <div className={`text-xs font-semibold ${
                              statusSLA.status === 'estourado'
                                ? 'text-red-700 dark:text-red-400'
                                : statusSLA.status === 'proximo'
                                ? 'text-yellow-700 dark:text-yellow-400'
                                : 'text-green-700 dark:text-green-400'
                            }`}>
                              {statusSLA.status === 'estourado' ? '⏱️ Atrasado: ' : '⏱️ Falta: '}
                              {formatarTempoRestante(statusSLA.tempoRestante)}
                            </div>
                          )}
                          {statusSLA.status === 'pausado' && (
                            <div className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                              ⏸️ Tempo pausado não conta no SLA
                            </div>
                          )}
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {statusSLA.tipo === 'resposta' ? 'SLA Resposta' : 'SLA Resolução'}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Linha 2: Informações principais */}
                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Solicitante</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {chamado.solicitante_nome}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {chamado.solicitante_setor || '-'}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Setor Responsável</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {chamado.setor_destino_id ? setoresMap.get(chamado.setor_destino_id) || '-' : '-'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {chamado.tipo}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Abertura</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatarDataBrasil(chamado.data_abertura)}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {formatarHorarioBrasil(chamado.data_abertura)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Atendimento</p>
                        {chamado.agendado && chamado.data_agendamento ? (
                          <div className="flex items-center gap-1 text-blue-600">
                            <Clock size={14} />
                            <div>
                              <p className="text-sm font-medium">Agendado</p>
                              <p className="text-xs">
                                {formatarDataBrasil(chamado.data_agendamento)} {formatarHorarioBrasil(chamado.data_agendamento)}
                              </p>
                            </div>
                          </div>
                        ) : chamado.tecnico_responsavel_id ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <UserCheck size={14} />
                            <div>
                              <p className="text-sm font-medium">Atribuído</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {chamado.tecnico_responsavel_nome || '-'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-orange-600">
                            <UserX size={14} />
                            <span className="text-sm font-medium">Aguardando</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Linha 3: Status e Prioridade */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusColors[chamado.status]}`} />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{chamado.status}</span>
                      </div>
                      
                      {chamado.prioridade && (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${prioridadeColors[chamado.prioridade as Prioridade]}`}>
                          {chamado.prioridade}
                        </span>
                      )}

                      {/* Indicador de Projeto */}
                      {chamado.is_projeto && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg border border-purple-300 dark:border-purple-700 text-xs font-bold">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z"></path>
                            <path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8"></path>
                            <path d="M15 2v5h5"></path>
                          </svg>
                          Convertido em Projeto (ID: {chamado.projeto_id})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Paginação */}
        {!loading && chamadosFiltrados.length > 0 && totalPaginas > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Página {paginaAtual} de {totalPaginas}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaginaAtual(1)}
                  disabled={paginaAtual === 1}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Primeira
                </button>
                
                <button
                  onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                  disabled={paginaAtual === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Anterior
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    let pageNum;
                    if (totalPaginas <= 5) {
                      pageNum = i + 1;
                    } else if (paginaAtual <= 3) {
                      pageNum = i + 1;
                    } else if (paginaAtual >= totalPaginas - 2) {
                      pageNum = totalPaginas - 4 + i;
                    } else {
                      pageNum = paginaAtual - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPaginaAtual(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          paginaAtual === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                  disabled={paginaAtual === totalPaginas}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Próxima
                </button>
                
                <button
                  onClick={() => setPaginaAtual(totalPaginas)}
                  disabled={paginaAtual === totalPaginas}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Última
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
