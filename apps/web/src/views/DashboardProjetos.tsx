"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/router-shim";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Target,
  Activity,
  Calendar,
} from "lucide-react";
import { Projeto } from "@/shared/types";
import Layout from "@/components/Layout";

interface ProjetoStats {
  total: number;
  aguardandoAprovacao: number;
  planejamento: number;
  emAndamento: number;
  pausado: number;
  concluido: number;
  cancelado: number;
  prazoRisco: number;
  orcamentoTotal: number;
  tempoMedioExecucao: number;
}

export default function DashboardProjetos() {
  const [stats, setStats] = useState<ProjetoStats | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/projetos");
      const data = await response.json();
      setProjetos(data);
      calculateStats(data);
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (projetos: Projeto[]) => {
    const hoje = new Date();
    const projetosComRisco = projetos.filter((p) => {
      if (!p.data_fim_prevista || p.status === "Concluído" || p.status === "Cancelado") return false;
      const dataFim = new Date(p.data_fim_prevista);
      const diasRestantes = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return diasRestantes < 30 && diasRestantes > 0;
    });

    const projetosConcluidos = projetos.filter((p) => p.status === "Concluído");
    const tempoMedio = projetosConcluidos.reduce((acc, p) => {
      if (p.data_inicio && p.data_fim_real) {
        const inicio = new Date(p.data_inicio);
        const fim = new Date(p.data_fim_real);
        const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        return acc + dias;
      }
      return acc;
    }, 0) / (projetosConcluidos.length || 1);

    setStats({
      total: projetos.length,
      aguardandoAprovacao: projetos.filter((p) => p.status === "Aguardando Aprovação").length,
      planejamento: projetos.filter((p) => p.status === "Planejamento").length,
      emAndamento: projetos.filter((p) => p.status === "Em andamento").length,
      pausado: projetos.filter((p) => p.status === "Pausado").length,
      concluido: projetosConcluidos.length,
      cancelado: projetos.filter((p) => p.status === "Cancelado").length,
      prazoRisco: projetosComRisco.length,
      orcamentoTotal: projetos.reduce((acc, p) => acc + (p.orcamento || 0), 0),
      tempoMedioExecucao: Math.round(tempoMedio),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const cards = [
    {
      title: "Total de Projetos",
      value: stats?.total || 0,
      icon: Target,
      color: "bg-blue-50 text-blue-600",
      bgColor: "bg-blue-500",
    },
    {
      title: "Em Andamento",
      value: stats?.emAndamento || 0,
      icon: Activity,
      color: "bg-indigo-50 text-indigo-600",
      bgColor: "bg-indigo-500",
    },
    {
      title: "Concluídos",
      value: stats?.concluido || 0,
      icon: CheckCircle,
      color: "bg-green-50 text-green-600",
      bgColor: "bg-green-500",
    },
    {
      title: "Prazo em Risco",
      value: stats?.prazoRisco || 0,
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-600",
      bgColor: "bg-amber-500",
    },
  ];

  const statusCards = [
    {
      title: "Aguardando Aprovação",
      value: stats?.aguardandoAprovacao || 0,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Em Planejamento",
      value: stats?.planejamento || 0,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100",
    },
    {
      title: "Em Andamento",
      value: stats?.emAndamento || 0,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
    {
      title: "Pausado",
      value: stats?.pausado || 0,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
  ];

  const performanceCards = [
    {
      title: "Orçamento Total",
      value: `R$ ${((stats?.orcamentoTotal || 0) / 1000).toFixed(1)}k`,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Tempo Médio de Execução",
      value: `${stats?.tempoMedioExecucao || 0} dias`,
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Taxa de Sucesso",
      value: `${stats?.total ? Math.round((stats.concluido / stats.total) * 100) : 0}%`,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard de Projetos</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Indicadores e métricas de gerenciamento de projetos (PMBOK)
          </p>
        </div>
        <Link
          to="/projetos"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          Ver Kanban
        </Link>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg ${card.color} dark:opacity-90 flex items-center justify-center`}>
                <card.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status dos Projetos */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-indigo-600 dark:text-indigo-400" />
          Distribuição por Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusCards.map((card, index) => (
            <div key={index} className="text-center p-4 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700">
              <div className={`text-4xl font-bold ${card.color} dark:opacity-90 mb-2`}>{card.value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{card.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Métricas de Performance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-indigo-600 dark:text-indigo-400" />
          Métricas de Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {performanceCards.map((card, index) => (
            <div key={index} className={`${card.bgColor} dark:opacity-80 rounded-lg p-6`}>
              <div className="flex items-center gap-3 mb-3">
                <card.icon size={24} className={card.color} />
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-800">{card.title}</h3>
              </div>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Projetos em Risco */}
      {stats && stats.prazoRisco > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-300 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
            Projetos com Prazo em Risco (próximos 30 dias)
          </h2>
          <div className="space-y-3">
            {projetos
              .filter((p) => {
                if (!p.data_fim_prevista || p.status === "Concluído" || p.status === "Cancelado") return false;
                const hoje = new Date();
                const dataFim = new Date(p.data_fim_prevista);
                const diasRestantes = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                return diasRestantes < 30 && diasRestantes > 0;
              })
              .map((projeto) => {
                const hoje = new Date();
                const dataFim = new Date(projeto.data_fim_prevista!);
                const diasRestantes = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={projeto.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <Link
                        to={`/projetos/${projeto.id}`}
                        className="font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {projeto.nome}
                      </Link>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{projeto.descricao}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Calendar size={14} />
                          <span className="text-sm font-medium">{diasRestantes} dias</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(projeto.data_fim_prevista!).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
}
